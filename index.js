const core = require('@actions/core');
const aws = require('aws-sdk');
const smoketail = require('smoketail')

const main = async () => {
    try {
        // Setup AWS clients
        const ecs = new aws.ECS({
            customUserAgent: 'github-action-aws-ecs-run-task'
        });

        // Inputs: Required
        const cluster = core.getInput('cluster', {required: true});
        const taskDefinition = core.getInput('task-definition', {required: true});
        const subnets = core.getMultilineInput('subnet-ids', {required: true});
        const securityGroups = core.getMultilineInput('security-group-ids', {required: true});

        // Inputs: Optional
        const tailLogs = core.getBooleanInput('tail-logs', {required: false});
        const assignPublicIp = core.getInput('assign-public-ip', {required: false});
        const overrideContainer = core.getInput('override-container', {required: false});
        const overrideContainerCommand = core.getMultilineInput('override-container-command', {required: false});

        // Build Task parameters
        const taskRequestParams = {
            count: 1,
            cluster,
            taskDefinition,
            launchType: 'FARGATE',
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets,
                    assignPublicIp,
                    securityGroups
                },
            },
        };

        // Override command if defined
        if (overrideContainerCommand && overrideContainer) {
            core.debug(`overrideContainer and overrideContainerCommand has been specified. Overriding.`);
            taskRequestParams.overrides = {
                containerOverrides: [
                    {
                        name: overrideContainer,
                        command: overrideContainerCommand,
                    }
                ]
            };
        }

        // Start task
        core.debug(JSON.stringify(taskRequestParams))
        core.debug(`Starting task.`)
        let task = await ecs.runTask(taskRequestParams).promise();

        // Get taskArn and taskId
        const taskArn = task.tasks[0].taskArn;
        const taskId = taskArn.split('/').pop();
        core.exportVariable('task-arn', taskArn);
        core.exportVariable('task-id', taskId);
        core.info(`Task started with ARN: ${taskArn}`);

        // Wait for task to be in running state
        core.info(`Waiting for task to be in running state...`)
        await ecs.waitFor('tasksRunning', {cluster, tasks: [taskArn]}).promise();

        // Get logging configuration
        let logFilterStream = null;
        if (tailLogs) {
            core.debug(`Logging enabled. Getting logConfiguration from TaskDefinition.`)
            let taskDef = await ecs.describeTaskDefinition({taskDefinition: taskDefinition}).promise();
            taskDef = taskDef.taskDefinition

            // Iterate all containers in TaskDef and search for given container with awslogs driver
            if (taskDef && taskDef.containerDefinitions) {
                taskDef.containerDefinitions.some((container) => {
                    core.debug(`Looking for logConfiguration in container '${container.name}'.`);

                    // If overrideContainer is passed, we want the logConfiguration for that container
                    if (overrideContainer && container.name !== overrideContainer) {
                        return false;
                    }

                    // Create a WLogFilterStream if logOptions are found
                    if (container.logConfiguration && container.logConfiguration.logDriver === 'awslogs') {
                        const logStreamName = [container.logConfiguration.options['awslogs-stream-prefix'], container.name, taskId].join('/')
                        core.debug(`Found matching container with 'awslogs' logDriver. Creating LogStream for '${logStreamName}'`);

                        logFilterStream = new smoketail.CWLogFilterEventStream(
                            {
                                logGroupName: container.logConfiguration.options['awslogs-group'],
                                logStreamNames: [logStreamName],
                                startTime: Math.floor(+new Date() / 1000),
                                followInterval: 3000,
                                follow: true
                            },
                            {region: container.logConfiguration.options['awslogs-region']}
                        );

                        logFilterStream.on('error', function (error) {
                            core.error(error.message);
                            core.debug(error.stack);
                        });

                        logFilterStream.on('data', function (eventObject) {
                            core.info(eventObject.message);
                        });

                        return true;
                    }
                });
            }
        }

        // Wait for Task to finish
        core.debug(`Waiting for task to finish.`);
        await ecs.waitFor('tasksStopped', {cluster, tasks: [taskArn]}).promise();

        // Close LogStream
        if (logFilterStream !== null) {
            core.debug(`Closing logStream.`);
            logFilterStream.close();
        }

        // Describe Task to get Exit Code and Exceptions
        core.debug(`Process exit code and exception.`);
        task = await ecs.describeTasks({cluster, tasks: [taskArn]}).promise();

        // Get exitCode
        if (task.tasks[0].containers[0].exitCode !== 0) {
            core.info(`Task failed, see details on Amazon ECS console: https://console.aws.amazon.com/ecs/home?region=${aws.config.region}#/clusters/${cluster}/tasks/${taskId}/details`);
            core.setFailed(task.tasks[0].stoppedReason)
        }
    } catch (error) {
        core.setFailed(error.message);
        core.debug(error.stack);
    }
};

main();

const core = require("@actions/core");

const {
    ECS,
    waitUntilTasksRunning,
    waitUntilTasksStopped,
} = require("@aws-sdk/client-ecs");

const smoketail = require("smoketail");

const main = async () => {
    try {
        // Setup AWS clients
        const ecs = new ECS({
            customUserAgent: "github-action-aws-ecs-run-task",
        });

        // Inputs: Required
        const cluster = core.getInput("cluster", { required: true });
        const taskDefinition = core.getInput("task-definition", {
            required: true,
        });
        const subnets = core.getMultilineInput("subnet-ids", {
            required: true,
        });
        const securityGroups = core.getMultilineInput("security-group-ids", {
            required: true,
        });

        // Inputs: Optional
        const tailLogs = core.getBooleanInput("tail-logs", { required: false });
        const assignPublicIp = core.getInput("assign-public-ip", {
            required: false,
        });
        const overrideContainer = core.getInput("override-container", {
            required: false,
        });
        const overrideContainerCommand = core.getMultilineInput(
            "override-container-command",
            { required: false }
        );
        const overrideContainerEnvironment = core.getMultilineInput(
            "override-container-environment",
            { required: false }
        );

        // Build Task parameters
        const taskRequestParams = {
            count: 1,
            cluster,
            taskDefinition,
            launchType: "FARGATE",
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets,
                    assignPublicIp,
                    securityGroups,
                },
            },
        };

        // Overrides if defined
        if (overrideContainer) {
            let overrides = {
                name: overrideContainer,
            };

            if (overrideContainerCommand.length) {
                core.debug(
                    `overrideContainer and overrideContainerCommand has been specified. Overriding.`
                );

                // Iterate over each item in the array and check for line appender character
                core.debug(
                    `Parsing overrideContainerCommand and merging line appender strings.`
                );
                overrideContainerCommand.map((x, i, arr) => {
                    if (x.endsWith("\\")) {
                        // Remove line appender character
                        arr[i] = x.replace(/\\$/, "");

                        // Check if not the last item in array
                        if (arr.length - 1 !== i) {
                            // Prepend the current item to the next item and set current item to null
                            arr[i + 1] = arr[i] + arr[i + 1];
                            arr[i] = null;
                        }
                    }
                });

                // Filter out any null values
                const parsedCommand = overrideContainerCommand.filter((x) => x);
                core.debug(
                    `Resulting command: ${JSON.stringify(parsedCommand)}`
                );

                overrides.command = parsedCommand;
            }

            if (overrideContainerEnvironment.length) {
                core.debug(
                    `overrideContainer and overrideContainerEnvironment has been specified. Overriding.`
                );
                overrides.environment = overrideContainerEnvironment.map(
                    (x) => {
                        const parts = x.split(/=(.*)/);
                        return {
                            name: parts[0],
                            value: parts[1],
                        };
                    }
                );
            }

            taskRequestParams.overrides = {
                containerOverrides: [overrides],
            };
        }

        // Start task
        core.debug(JSON.stringify(taskRequestParams));
        core.debug(`Starting task.`);
        let task = await ecs.runTask(taskRequestParams);

        // Get taskArn and taskId
        const taskArn = task.tasks[0].taskArn;
        const taskId = taskArn.split("/").pop();
        core.setOutput("task-arn", taskArn);
        core.setOutput("task-id", taskId);
        core.info(`Starting Task with ARN: ${taskArn}\n`);

        // Wait for task to be in running state
        core.debug(`Waiting for task to be in running state.`);
        await waitUntilTasksRunning(
            {
                client: ecs,
                maxWaitTime: 200,
            },
            { cluster, tasks: [taskArn] }
        );

        // Get logging configuration
        let logFilterStream = null;
        let logOutput = "";

        if (tailLogs) {
            core.debug(
                `Logging enabled. Getting logConfiguration from TaskDefinition.`
            );
            let taskDef = await ecs.describeTaskDefinition({
                taskDefinition: taskDefinition,
            });
            taskDef = taskDef.taskDefinition;

            // Iterate all containers in TaskDef and search for given container with awslogs driver
            if (taskDef && taskDef.containerDefinitions) {
                taskDef.containerDefinitions.some((container) => {
                    core.debug(
                        `Looking for logConfiguration in container '${container.name}'.`
                    );

                    // If overrideContainer is passed, we want the logConfiguration for that container
                    if (
                        overrideContainer &&
                        container.name !== overrideContainer
                    ) {
                        return false;
                    }

                    // Create a CWLogFilterStream if logOptions are found
                    if (
                        container.logConfiguration &&
                        container.logConfiguration.logDriver === "awslogs"
                    ) {
                        const logStreamName = [
                            container.logConfiguration.options[
                                "awslogs-stream-prefix"
                            ],
                            container.name,
                            taskId,
                        ].join("/");
                        core.debug(
                            `Found matching container with 'awslogs' logDriver. Creating LogStream for '${logStreamName}'`
                        );

                        logFilterStream = new smoketail.CWLogFilterEventStream(
                            {
                                logGroupName:
                                    container.logConfiguration.options[
                                        "awslogs-group"
                                    ],
                                logStreamNames: [logStreamName],
                                startTime: Math.floor(+new Date() / 1000),
                                followInterval: 3000,
                                follow: true,
                            },
                            {
                                region: container.logConfiguration.options[
                                    "awslogs-region"
                                ],
                            }
                        );

                        logFilterStream.on("error", function (error) {
                            core.error(error.message);
                            core.debug(error.stack);
                        });

                        logFilterStream.on("data", function (eventObject) {
                            const logLine = `${new Date(
                                eventObject.timestamp
                            ).toISOString()}: ${eventObject.message}`;
                            core.info(logLine);
                            logOutput += logLine + "\n";
                        });

                        return true;
                    }
                });
            }
        }

        // Wait for Task to finish
        core.debug(`Waiting for task to finish.`);
        await waitUntilTasksStopped(
            {
                client: ecs,
                minDelay: 6,
                maxWaitTime: 120,
            },
            {
                cluster,
                tasks: [taskArn],
            }
        );

        // Close LogStream and store output
        if (logFilterStream !== null) {
            core.debug(`Closing logStream.`);
            logFilterStream.close();

            // Export log-output
            core.setOutput("log-output", logOutput);
        }

        // Describe Task to get Exit Code and Exceptions
        core.debug(`Process exit code and exception.`);
        task = await ecs.describeTasks({ cluster, tasks: [taskArn] });

        // Get exitCode
        if (task.tasks[0].containers[0].exitCode !== 0) {
            core.info(
                `Task failed, see details on Amazon ECS console: https://console.aws.amazon.com/ecs/home?region=${ecs.config.region}#/clusters/${cluster}/tasks/${taskId}/details`
            );
            core.setFailed(task.tasks[0].stoppedReason);
        }
    } catch (error) {
        core.setFailed(error.message);
        core.debug(error.stack);
    }
};

main();

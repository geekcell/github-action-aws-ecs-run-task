[![Geek Cell GmbH](https://raw.githubusercontent.com/geekcell/.github/main/geekcell-github-banner.png)](https://www.geekcell.io/)

<!-- action-docs-description -->
## Description

Run an AWS ECS Fargate task and execute a custom command. See the log output of the command that is executed.
<!-- action-docs-description -->

### Details
This action makes it possible to run an AWS ECS Fargate task and execute custom commands. If the task definition
is configured to log to CloudWatch, this action will try to tail the output of container, providing instant feedback inside
the GitHub Workflow.

This action is great for executing migrations or other pre/post deployment steps for ECS Fargate applications.

## Usage

#### Full example
``` yaml
- name: Execute migrations and seeders
  id: run-task
  uses: geekcell/github-action-aws-ecs-run-task@v3.0.0
  with:
    cluster: application-cluster
    task-definition: application-task-def
    assign-public-ip: 'DISABLED'

    subnet-ids: |
      subnet-04f133a104b9e95df
      subnet-0dc419ee6a1483514

    security-group-ids: |
      sg-123456789101112
      sg-112398765421333

    tail-logs: true
    override-container: app
    override-container-command: |
      /bin/sh
      -c
      php artisan migrate --force --ansi && php artisan db:seed --force --ansi
    override-container-environment: |
      AWS_REGION=us-east-1
      FOO=baz
```

#### Minimal example
``` yaml
- name: Run migration container
  id: run-task
  uses: geekcell/github-action-aws-ecs-run-task@v3.0.0
  with:
    cluster: application-cluster
    task-definition: application-task-def
    subnet-ids: subnet-04f133a104b9e95df
    security-group-ids: sg-123456789101112
```

#### Appending multiple lines into a single command

You can use the backslash character `\` to append multiple lines into a single line. This is useful if you have many
commands to execute and want to keep the YAML file readable. Otherwise, each line will be passed to the AWS ECS Fargate
task as a separate argument.

> **Note:** Make sure to use the `|` character so the YAML parser interprets the value as a multiline string.
> You can read more about this in the [YAML documentation](https://yaml.org/spec/1.2/spec.html#id2794534).

For example:

``` yaml
...
override-container-command: |
  /bin/sh
  -c
  php artisan down && \
  php artisan migrate --force --ansi && \
  php artisan db:seed --force --ansi && \
  php artisan cache:clear --ansi
```

Will pass the following command to the container on the AWS ECS Fargate task:
```
["sh", "-c", "php artisan down && php artisan migrate --force --ansi && php artisan db:seed --force --ansi && php artisan cache:clear --ansi"]
```

<!-- action-docs-inputs -->
## Inputs

| parameter | description | required | default |
| --- | --- | --- | --- |
| task-definition | The name or the ARN of the task definition to use for the task. | `true` |  |
| subnet-ids | The list of subnet IDs for the task to use. If multiple they should be passed as multiline argument with one subnet ID per line. | `true` |  |
| security-group-ids | List of security group IDs for the task. If multiple they should be passed as multiline argument with one subnet ID per line. | `true` |  |
| assign-public-ip | Assign public a IP to the task. Options: `['ENABLED', 'DISABLED']` | `false` | DISABLED |
| cluster | Which ECS cluster to start the task in. | `false` |  |
| override-container | Will use `containerOverrides` to run a custom command on the container. If provided, `override-container-command` must also be set. | `false` |  |
| override-container-command | The command to run on the container if `override-container` is passed. | `false` |  |
| override-container-environment | Add or override existing environment variables if `override-container` is passed. Provide one per line in key=value format. | `false` |  |
| tail-logs | If set to true, will try to extract the logConfiguration for the first container in the task definition. If `override-container` is passed, it will extract the logConfiguration from that container. Tailing logs is only possible if the provided container uses the `awslogs` logDriver. | `false` | true |
| task-stopped-wait-for-max-attempts | How many times to check if the task is stopped before failing the action. The delay between each check is 6 seconds. | `false` | 100 |
| end-pipeline-step-before-task-finish | Terminate the pipeline step if the Fargate task has not finished executing. | `false` | `false` |
<!-- action-docs-inputs -->

<!-- action-docs-outputs -->
## Outputs

| parameter | description |
| --- | --- |
| task-arn | The full ARN for the task that was ran. |
| task-id | The ID for the task that was ran. |
| log-output | The log output of the task that was ran, if `tail-logs` was set to true. |
<!-- action-docs-outputs -->

<!-- action-docs-runs -->
## Runs

This action is a `node20` action.
<!-- action-docs-runs -->

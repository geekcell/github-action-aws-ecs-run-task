[![Geek Cell GmbH](https://raw.githubusercontent.com/geekcell/.github/main/geekcell-github-banner.png)](https://www.geekcell.io/)

<!-- action-docs-description -->
## Description

Run an AWS ECS Fargate task and execute a custom commands. See the log output of the commands.
<!-- action-docs-description -->

### Details
This action makes it possible to run an AWS ECS Fargate task and execute a custom command. If the task definition
defines logs to CloudWatch this action will also tail the output of container, providing instant feedback inside
the GitHub Workflow.

This action is great for executing migrations or other pre/post deployment steps for ECS Fargate applications.

## Usage

#### Full example
``` yaml
- name: Execute migrations and seeders
  id: run-task
  uses: geekcell/github-action-aws-ecs-run-task@v1.0.0
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
      php artisan migrate --force --ansi && \
      php artisan db:seed --force --ansi && \
      php artisan config:clear --ansi
```

#### Minimal example
``` yaml
- name: Run migration container
  id: run-task
  uses: geekcell/github-action-aws-ecs-run-task@v1.0.0
  with:
    cluster: application-cluster
    task-definition: application-task-def
    subnet-ids: subnet-04f133a104b9e95df
    security-group-ids: sg-123456789101112
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
| tail-logs | If set to true, will try to extract the logConfiguration for the first container in the task definition. If `override-container` is passed, it will extract the logConfiguration from that container. Tailing logs is only possible if the provided container uses the `awslogs` logDriver. | `false` | true |
<!-- action-docs-inputs -->

<!-- action-docs-outputs -->
## Outputs

| parameter | description |
| --- | --- |
| task-arn | The full ARN for the task that was ran. Will be added as ENV variable. |
| task-id | The ID for the task that was ran. Will be added as ENV variable. |
| log-output | The log output of the task that was ran, if `tail-logs` was set to true. |
<!-- action-docs-outputs -->

<!-- action-docs-runs -->
## Runs

This action is a `node16` action.
<!-- action-docs-runs -->

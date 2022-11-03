<!-- action-docs-description -->
## Description

This action makes it possible to run an AWS ECS Fargate task.
<!-- action-docs-description -->

## Usage

``` yaml
---
#TODO
```


<!-- action-docs-inputs -->
## Inputs

| parameter | description | required | default |
| --- | --- | --- | --- |
| task-definition | The name or the ARN of the task definition to use for the task. | `true` |  |
| subnet-ids | The list of subnet IDs for the task to use. If multiple they should be passed as multiline argument with one subnet ID per line. | `true` |  |
| security-group-ids | List of security group IDs for the task. If multiple they should be passed as multiline argument with one subnet ID per line. | `true` |  |
| assign-public-ip | Assign public a IP to the task. Options: ['ENABLED', 'DISABLED'] | `false` | DISABLED |
| cluster | Which ECS cluster to start the task in. | `false` | default |
| override-container | Will use `containerOverrides` to run a custom command on the container. If provided, `override-container-command` must also be set. | `false` |  |
| override-container-command | The command to run on the container if `override-container` is passed. | `false` |  |
| tail-logs | If set to true, will try to extract the logConfiguration for the first container in the task definition. If  `override-container` is passed, it will extract the logConfiguration from that container. Tailing logs is only possible if the provided container uses the `awslogs` logDriver. | `false` | true |
<!-- action-docs-inputs -->

<!-- action-docs-outputs -->
## Outputs

| parameter | description |
| --- | --- |
| task-arn | The full ARN for the task that was ran. |
| task-id | The ID for the task that was ran. |
<!-- action-docs-outputs -->

<!-- action-docs-runs -->
## Runs

This action is a `node12` action.
<!-- action-docs-runs -->

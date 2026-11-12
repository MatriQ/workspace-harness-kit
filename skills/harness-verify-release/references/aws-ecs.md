# Read-only AWS ECS version observations

Use this collector for an ECS service only when the selected task includes reading
that environment. Reuse the existing AWS CLI v2 authentication and project tools;
the collector never installs, logs in, deploys, updates services or creates resources.

Create a local selection file with the actual target, account, region, long service
ARN, matching cluster ARN and container name. This synthetic shape contains no access
credentials:

```json
{
  "target": {"environment":"staging","identity":"arn:aws:ecs:us-east-1:123456789012:service/greeting/api"},
  "account": "123456789012",
  "region": "us-east-1",
  "cluster": "arn:aws:ecs:us-east-1:123456789012:cluster/greeting",
  "container": "api",
  "profile": "greeting-staging"
}
```

```sh
node "$SKILL/scripts/collect.mjs" aws-ecs --selection "$SELECTION" \
  --component api --attempt 1 > "$OBSERVATION"
```

The fixed calls first use STS to compare the active account, then describe the service,
list its running tasks, describe those tasks and repeat service/task membership reads.
Only the selected container's `imageDigest` becomes an `oci_manifest_digest` version
observation. The caller still compares it with the independently selected release
artifact. CLI success means a collector result was emitted; inspect its `status` and
evaluate the complete release record before accepting anything.

The collector supports a bounded sample of at most 100 tasks. Pagination, absent
digests, missing containers, mixed task definitions/digests, scaled-to-zero services,
incomplete reads or changing membership remain pending. It requires matching running
and desired counts. This conservative sample does not make the AWS API reads atomic
or prove traffic routing. Preserve manifest/index identity distinctions; a multi-arch
index requires a separately evidenced mapping. Account mismatch fails before ECS
reads. Normal read errors return bounded pending summaries without raw stderr/task
dumps. The output includes target and snapshot references, not container configuration.

An observed runtime digest proves neither the deployment step nor application/business
success. Collect those separately. AWS describes `imageDigest` as the container image
manifest digest in [DescribeTasks](https://docs.aws.amazon.com/cli/latest/reference/ecs/describe-tasks.html).
The fixed read contracts are [GetCallerIdentity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html),
[DescribeServices](https://docs.aws.amazon.com/cli/latest/reference/ecs/describe-services.html)
and [ListTasks](https://docs.aws.amazon.com/cli/latest/reference/ecs/list-tasks.html).

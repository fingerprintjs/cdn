# Contributing

## Running locally

Install [Node.js](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com).

Download the repository code, open a terminal in the repository root and run:

```bash
yarn install
```

Emulate a CloudFront request and see the response produced by the code:

```bash
yarn run-lambda --uri /fingerprintjs/v3

# See the full response body:
yarn run-lambda --uri /botd/v0.1.20/esm.min.js --full-response-body
```

Run unit tests:

```bash
yarn test:unit
```

Run integration tests that emulate a Lambda@Edge environment.
They run the real distributive code that performs real requests to NPM:

```bash
yarn build # Run once after you change the source code
yarn test:integration
```

## Adding a new project to serve

Describe the project in the [src/projects.ts](src/projects.ts) file.

There are limitations for the libraries served by the CDN.
Some of these limitations can be removed with changes to the CDN code.

- Only versions published to NPM are served.
- The library version names must follow the SemVer standard. See the standard:
  [a formal description](https://semver.org/#backusnaur-form-grammar-for-valid-semver-versions) or
  [a regular expression](https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string).
  The CDN treats 1- and 2-number versions as inexact versions.
- The only allowed external dependency (listed in the `dependencies` field of `package.json`) is `tslib` version 2.
- The browser bundles mustn't exceed 1MB because CloudFront limits the size of the responses produced by lambdas.
- The NPM package and its external dependencies must have an ES entrypoint (CommonJS isn't supported).
  The entrypoint must be specified by the `module` or the `jsnext:main` field of the `package.json` file.
  No other file from the package can be served.
- The package's entrypoint code must be a UTF-8 text.
- Ideally, the NPM package should include only the distributive code in ESM and CJS formats only.
  It will make downloading the code faster.

Once you add the project, deploy the CDN.

### Publishing a new project version to the CDN

Publish the version to NPM, the CDN will serve it automatically.

The inexact version cache will update within few hours.
If you want to clear the cache sooner, invalidate the cache in the CloudFront distribution (see the deployment section).

## Deployment

### Initial setup

Sign in to [AWS](https://console.aws.amazon.com).

Go to [CloudFront / Distributions](https://console.aws.amazon.com/cloudfront/v3/home#/distributions).
Create a new distribution.
Fill in the fields during creation:

- Origin domain: `example.com` ([why](https://stackoverflow.com/q/67309458/1118709))
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Alternate domain name: the domain name you like; leave empty to use the default CloudFront domain
- Custom SSL certificate: if you've filled a domain name, create (if not created) and choose an SSL certificate for the domain
- Description: `CDN for open projects (GitHub repository: fingerprintjs/cdn)`

Go to [Lambda / Functions](https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions), the US East (N. Virginia) region.
Create a new function.
Fill in the fields during creation:

- Function name: `opencdn-codegen`
- Runtime: the latest Node.js
- Architecture: `x86_64` (Lambda@Edge doesn't support ARM yet)
- Change default execution role (otherwise the function won't run on Lambda@Edge):
    - Execution role: `Create a new role from AWS policy templates`
    - Role name: `opencdn-codegen-role`
    - Policy templates: `Basic Lambda@Edge permissions (for CloudFront trigger)`

Change the function settings:

- On the function page scroll down to the "Runtime settings" section, open settings, and change the handler to `src/index.handler`
- Click the "Configuration" tab, "General configuration", change the memory to 3538 MB, the timeout to 15 seconds, and
    the description to `CDN for open projects (GitHub repository: fingerprintjs/cdn)`.

The more RAM allocated to a lambda, the more CPU power it has. 1769MB = 1vCPU.
The asset building speed depends on the allocated RAM linearly.
256MB is enough, but the time to build FingerprintJS (download from NPM + Rollup + Terser) is about 13 seconds.
3538MB (2 vCPUs) is a good balance.

Add a trigger to the function: CloudFront. Fill the fields:

- Distribution: the created distribution
- CloudFront event: `Origin request`
- Include body: no
- Confirm deploy to Lambda@Edge: yes

Then deploy the code itself (see the next section).

### Deploying a code version

GitHub Actions build the code for you when you push to `master`.
You can find it as an artifact in the [Actions section](https://github.com/fingerprintjs/cdn/actions) of the repository.
Download the artifact.

Go to [AWS / Lambda / Functions](https://console.aws.amazon.com/lambda/home#/functions).
Open the created function.

- Click "Upload from", ".zip file" and upload the artifact
- Add a trigger: CloudFront. Choose "Use existing CloudFront trigger on this function", click "Deploy"

The lambda will be uploaded to the Edge locations in several minutes.
After that you may clear the CloudFront cache:

- Go to [CloudFront / Distributions](https://console.aws.amazon.com/cloudfront/v3/home#/distributions), open the distribution.
    If it says "Deploying", then the function hasn't been uploaded to all the Edge locations.
- Open the "Invalidations" tab, create an invalidation with the `/*` path.
    You can also invalidate individual URLs by changing the path.

### Monitoring

Unexpected errors may happen during lambda execution.
The function throws all unexpected errors, and CloudFront records the errors.

To see the error rate, go to [AWS / CloudFront / Monitoring](https://console.aws.amazon.com/cloudfront/v3/home#/monitoring),
select the distribution, click "View distribution metrics", open the "Lambda@Edge errors" tab.

There 2 types of errors:

1. An uncaught exception during the lambda execution
2. An invalid lambda response format

To see the error details, go to [AWS / CloudWatch / Log groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups).
Choose a region (the lambda writes the logs to the same region where it runs).
See these log groups:

- `/aws/lambda/(original lambda region).(lambda name)` for unexpected errors; it also includes all invocations
- `/aws/cloudfront/LambdaEdge/(distribution id)` for invalid lambda responses

#### Automatic error notifications

Assuming AWS CloudFront metrics forwarding to Datadog is already configured.

[Import a new monitor](https://app.datadoghq.com/monitors/create/import) in Datadog from these code snippets.
Note that you need to replace `<DISTRIBUTION_ID>` and `<distribution_id>` with the distribution id (respecting the case):

```json
{
	"name": "[prod] opencdn Outgoing 5XX responses",
	"type": "query alert",
	"query": "avg(last_1h):avg:aws.cloudfront.5xx_error_rate{distributionid:<distribution_id>} > 1",
	"message": "{{#is_alert}}\n5XX response rate is greater than {{threshold}}%.\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 1
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"include_tags": true,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_all",
        "new_host_delay": 300,
		"silenced": {}
	},
	"priority": 2,
	"restriction_policy": {
		"bindings": []
	}
}
```

This monitor will trigger an alarm when the number of CloudFront distribution responses with 5XX HTTP code is too high.
CloudFront doesn't provide information about the exact reasons. The reasons can be lambda errors (see above), internal AWS errors or an incorrect configuration.

Lambda errors not necessary lead to 5XX responses (for example, when CloudFront has [a cache](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HTTPStatusCodes.html#HTTPStatusCodes-no-custom-error-pages) for the request).
So you need more alarms not to miss the lambda fails:

```json
{
	"id": 152194304,
	"name": "[prod] opencdn Uncaught lambda exceptions",
	"type": "query alert",
	"query": "sum(last_1h):sum:aws.cloudfront.lambda_execution_error{distributionid:<distribution_id>}.as_count() > 4",
	"message": "{{#is_alert}}\nMore than {{threshold}} uncaught exceptions recently. They may have caused 5XX responses.\n\nHow to view the error messages:\n1. **Detect what region the errors happen in**: Go to [AWS CloudFront Monitoring](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/monitoring), open the Lambda@Edge tab, select `opencdn-codegen`. Scroll down to the Errors chart.\n2. **Find the Lambda logs in that region**: On the same page scroll up, click the \"View function logs\" dropdown and select the region. On the logs page click \"Search log group\" and type \"error\" in the search box.\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 4
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"include_tags": true,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_all",
		"timeout_h": 1,
		"new_host_delay": 300,
		"silenced": {}
	},
	"priority": 2,
	"restriction_policy": {
		"bindings": []
	}
}
```

```json
{
	"name": "[prod] opencdn Invalid lambda response",
	"type": "query alert",
	"query": "sum(last_1h):sum:aws.cloudfront.lambda_validation_error{distributionid:<distribution_id>}.as_count() > 0",
	"message": "{{#is_alert}}\nMore than {{threshold}} invalid lambda responses recently. They may have caused 5XX responses.\n\nHow to view the error messages:\n1. **Detect what region the errors happen in**: Go to AWS CloudFront Monitoring, [the Open CDN distribution](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/monitoring/distribution/<DISTRIBUTION_ID>), open the \"Lambda@Edge errors\" tab. Scroll down to the \"Invalid function responses\" chart.\n2. **Find the CloudFront logs in that region**: Go to [the distribution log group](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Fcloudfront$252FLambdaEdge$252F<DISTRIBUTION_ID>/log-events$3FfilterPattern$3DValidation+error) in CloudWatch, select the region you need and search for \"Validation error\".\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 0
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"include_tags": true,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_all",
		"timeout_h": 1,
		"new_host_delay": 300,
		"silenced": {}
	},
	"priority": 2,
	"restriction_policy": {
		"bindings": []
	}
}
```

Note: the above 2 monitors are configured to resolve the alarm after 1 hour of missing data,
because the underlying metrics don't report `0` when everything goes well. That is, the data are missing when the state is good.

See [the CloudFrond documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/viewing-cloudfront-metrics.html) to learn what other metrics can be watched.

#### Watching the lambda execution duration

You need to enable additional metrics (for extra charge from AWS).
Go to [AWS / CloudFront / Monitoring](https://console.aws.amazon.com/cloudfront/v3/home#/monitoring),
select the distribution, click "View distribution metrics", click "Enable additional metrics",
select "Enabled", click "Enable metrics".

Now the "Origin latency" chart is available on the distribution metrics page.

```json
{
	"name": "[prod] opencdn Lambda execution duration",
	"type": "query alert",
	"query": "avg(last_4h):avg:aws.cloudfront.origin_latency{distributionid:<distribution_id>} > 4000",
	"message": "{{#is_alert}}\nAverage lambda execution duration is more than {{threshold}}ms.\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 4000
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"include_tags": true,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_all",
		"new_host_delay": 300,
		"silenced": {}
	},
	"priority": 3,
	"restriction_policy": {
		"bindings": []
	}
}
```

#### Notifications about too many 4XX error

Many 404 errors can be caused by an incidental URL removal.

```json
{
	"name": "[prod] opencdn Outgoing 4XX responses",
	"type": "query alert",
	"query": "avg(last_1h):avg:aws.cloudfront.4xx_error_rate{distributionid:<distribution_id>} > 10",
	"message": "{{#is_alert}}\n4XX response rate is greater than {{threshold}}%.\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 10
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"include_tags": true,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_all",
		"new_host_delay": 300,
		"silenced": {}
	},
	"priority": 2,
	"restriction_policy": {
		"bindings": []
	}
}
```

#### Notifications about steep changes in number of requests

A rapid fall in number of requests can be caused by general problems with the distribution, such as incorrect domain name setup.
A rapid rise can cause unwanted spending.

```json
{
	"name": "[prod] opencdn Number of incoming requests",
	"type": "query alert",
	"query": "avg(last_1d):anomalies(sum:aws.cloudfront.requests{distributionid:<distribution_id>}.as_count(), 'agile', 5, direction='both', interval=300, alert_window='last_1h', seasonality='weekly', count_default_zero='true', timezone='utc') >= 1",
	"message": "{{#is_alert}}\nUnusual incoming requests rate.\n{{/is_alert}}\n\nGitHub repository: https://github.com/fingerprintjs/cdn",
	"tags": [
		"service:opencdn",
		"env:prod"
	],
	"options": {
		"thresholds": {
			"critical": 1,
			"critical_recovery": 0
		},
		"notify_audit": false,
		"require_full_window": false,
		"notify_no_data": false,
		"renotify_interval": 0,
		"threshold_windows": {
			"trigger_window": "last_1h",
			"recovery_window": "last_15m"
		},
		"include_tags": false,
		"evaluation_delay": 900,
		"notification_preset_name": "hide_query",
		"new_host_delay": 300,
		"silenced": {}
	},
	"priority": 4,
	"restriction_policy": {
		"bindings": []
	}
}
```

#### Cost monitoring

Add a tag to all AWS resources of the CDN. For example: `cost-category` = `opencdn`.

After adding a tag to a resource, go to [AWS / Billing / Cost allocation tags](https://console.aws.amazon.com/billing/home?#/tags) and activate the tag.

After several days you'll be able to see how much money the resources with this tag consume in [AWS / Cost Explorer](https://console.aws.amazon.com/cost-management/home#/custom).

### Statistics

This section describes how to collect the logs about each incoming request.

Go to [AWS / S3 / Buckets](https://s3.console.aws.amazon.com/s3/buckets).
Create a new bucket where you will store the logs:

- Bucket name: `opencdn-logs`
- AWS Region: `us-east-1`
- Object Ownership: `ACLs enabled` / `Bucket owner preferred`
- Block all public access: yes

Open the created bucket.
Switch to the "Permissions" tab, scroll down to the "Access control list" section, click "Edit".
Add a grantee:

- Grantee: `c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0` (more details [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html?icmpid=docs_cf_help_panel#AccessLogsBucketAndFileOwnership))
- All the checkboxes: yes

Switch to the "Management" tab.
Create a lifecycle rule:

- Lifecycle rule name: `cleanup` (or whatever you want)
- Prefix: `cloudfront/`
- Lifecycle rule actions: choose:
    - `Expire current versions of objects`
    - `Permanently delete noncurrent versions of objects`
- Expire current versions of objects / Days after object creation: `30` (the number of days you want to keep the logs for)
- Permanently delete noncurrent versions of objects / Days after objects become noncurrent: `1`

Go to [AWS / CloudFront / Logs](https://us-east-1.console.aws.amazon.com/cloudfront/v3/home#/logs).
Choose the distribution created earlier.
Edit the standard logs settings:

- S3 bucket: `opencdn-logs` (the bucket you've created earlier)
- S3 bucket prefix: `cloudfront/standard/`
- Cookie logging: no
- Status: yes

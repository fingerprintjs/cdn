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
- Only the NPM package "main" JS file is served.
- The library version names must follow the SemVer standard. See the standard:
  [a formal description](https://semver.org/#backusnaur-form-grammar-for-valid-semver-versions) or
  [a regular expression](https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string).
  The CDN treats 1- and 2-number versions as inexact versions.
- The only allowed external dependency (listed in the `dependencies` field of `package.json`) is `tslib` version 2.
- The browser bundles mustn't exceed 1MB because CloudFront limits the size of the responses produced by lambdas.
- The NPM package and its external dependencies must have an ES entrypoint (CommonJS isn't supported).
  The entrypoint must be specified by the `module` or the `jsnext:main` field of the `package.json` file.
- The package's entrypoint code must be a UTF-8 text.
- Ideally, the NPM package should include only the distributive code in ESM and CJS formats only.
  It will make downloading the code faster.

Once you add the project, deploy the CDN.

### Publishing a new project version to the CDN

Publish the version to NPM, the CDN will serve it automatically.

The inexact redirect cache will update within an hour.
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

Go to [Lambda / Functions](https://console.aws.amazon.com/lambda/home#/functions).
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
- Click the "Configuration" tab, "General configuration", change the memory to 3538 MB, the timeout to 10 seconds, and
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

### Deployment

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

1. An unhandled exception during the lambda execution
2. An invalid lambda response

To see the error details, go to [AWS / CloudWatch / Log groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups).
Choose a region (the lambda writes the logs to the same region where it runs).
See these log groups:

- `/aws/lambda/(original lambda region).(lambda name)` for unexpected errors; it also includes all invocations
- `/aws/cloudfront/LambdaEdge/(distribution id)` for invalid lambda responses

#### Automatic error notifications

Go to [AWS / CloudWatch / Alarms](https://console.aws.amazon.com/cloudwatch/home?#alarmsV2:).
Create an alarm:

- Metric: `CloudFront > Per-Distribution Metrics`
    - Metric name: `5xxErrorRate` (if you can't find it, select any and fill it manually on the next step)
    - Region: `Global`
    - DistributionId: (the distribution id)
- Statistic: `Average`
- Period: `5 minutes`
- Threshold: `Static`, `Greater >`, `0`
- Additional configuration:
    - Datapoints to alarm: `1` out of `3`
        (the alarm should check for errors at least 3 recent minutes of the metric,
        because metric data can arrive retroactively, i.e. be written to a past metric history after a delay)
    - Missing data treatment: `Treat missing data as good (not breaching threshold)`
- Click "Next"
- Alarm state trigger: `In alarm`
- Select an SNS topic: see the SNS documentation to learn how you can deliver notifications; you can just remove the notification
- Click "Next"
- Alarm name: `opencdn-alarm-5xx`
- Alarm description: `A 5XX response from the open CDN (GitHub repository: fingerprintjs/cdn)`
- Click "Next", "Create alarm"

If there is a stale cache for a request in CloudFront, and the lambda fails, CloudFront [will return the cache](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HTTPStatusCodes.html#HTTPStatusCodes-no-custom-error-pages),
and the alarm won't trigger. So you need 2 more alarms in order not to miss the lambda fails:

1. For unhandled lambda exceptions. Everything is the same except:
    - Metric name: `LambdaExecutionError`
    - Alarm name: `opencdn-alarm-lambdaerror`
    - Alarm description: `An unexpected error in the open CDN lambda (GitHub repository: fingerprintjs/cdn)`
2. For invalid lambda responses. Everything is the same except:
    - Metric name: `LambdaValidationError`
    - Alarm name: `opencdn-alarm-lambdainvalid`
    - Alarm description: `An invalid response from the open CDN lambda (GitHub repository: fingerprintjs/cdn)`

See [the CloudFrond documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/viewing-cloudfront-metrics.html) to learn what other metrics can be watched.

#### Watching the lambda execution duration

You need to enable additional metrics (for extra charge from AWS).
Go to [AWS / CloudFront / Monitoring](https://console.aws.amazon.com/cloudfront/v3/home#/monitoring),
select the distribution, click "View distribution metrics", click "Enable additional metrics",
select "Enabled", click "Enable metrics".

Now the "Origin latency" chart is available on the distribution metrics page.

You can create an alarm for it:

- Metric: `CloudFront > Per-Distribution Metrics`
    - Metric name: `OriginLatency`
    - Region: `Global`
    - DistributionId: (the distribution id)
- Statistic: `p90` (the 90th percentile; [possible statistics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Statistics-definitions.html))
- Period: `4 hours` (Custom — 14400 seconds)
- Additional configuration:
    - Datapoints to alarm: `2` out of `2`
- Threshold: `Static`, `Greater >`, `3000` (milliseconds)
- Alarm state trigger: `In alarm`
- Select an SNS topic: see the SNS documentation to learn how you can deliver notifications; you can just remove the notification
- Alarm name: `opencdn-alarm-originlatency`
- Alarm description: `Too high execution duration of the open CDN lambda (GitHub repository: fingerprintjs/cdn)`

#### Notifications about too many 4XX error

Many 404 errors can be caused by an incorrect redirect.
It is not a runtime exception, this is an error in the algorithm itself.

Create an alarm:

- Metric: `CloudFront > Per-Distribution Metrics`
    - Metric name: `4xxErrorRate`
    - Region: `Global`
    - DistributionId: (the distribution id)
- Statistic: `Average`
- Period: `15 minutes`
- Threshold: `Static`, `Greater >`, `20`
- Additional configuration:
    - Datapoints to alarm: `2` out of `3`
    - Missing data treatment: `Treat missing data as good (not breaching threshold)`
- Alarm state trigger: `In alarm`
- Select an SNS topic: see the SNS documentation to learn how you can deliver notifications; you can just remove the notification
- Alarm name: `opencdn-alarm-4xx`
- Alarm description: `Too many 4XX responses from the open CDN (GitHub repository: fingerprintjs/cdn)`

#### Notifications about steep changes in number of requests

A rapid fall in number of requests can be caused by general problems with the distribution, such as incorrect domain name setup.
A rapid rise can cause unwanted spending.

Create an alarm:

- Metric: `CloudFront > Per-Distribution Metrics`
    - Metric name: `Requests`
    - Region: `Global`
    - DistributionId: (the distribution id)
- Statistic: `Sum`
- Period: `30 minutes` (Custom — 1800 seconds)
- Threshold: `Anomaly detection`, `Outside of the band`, `15`
- Additional configuration:
    - Datapoints to alarm: `2` out of `3`
    - Missing data treatment: `Treat missing data as bad (breaching threshold)`
- Alarm state trigger: `In alarm`
- Select an SNS topic: see the SNS documentation to learn how you can deliver notifications; you can just remove the notification
- Alarm name: `opencdn-alarm-requests`
- Alarm description: `Unusual number of requests to the open CDN (GitHub repository: fingerprintjs/cdn)`

#### Cost monitoring

Add a tag to all AWS resources of the CDN. For example: `cost-category` = `opencdn`.
You can see how much money the resources with this tag consume in [AWS / Cost Explorer](https://console.aws.amazon.com/cost-management/home#/custom).

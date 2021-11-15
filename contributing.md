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
yarn run-lambda --uri /botd/v0.1.20/esm.min.js --full-body
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
- Description: `CDN for open projects (https://github.com/fingerprintjs/cdn)`

Go to [Lambda / Functions](https://console.aws.amazon.com/lambda/home#/functions).
Create a new function.
Fill in the fields during creation:

- Function name: `opencdn-codegen`
- Runtime: the latest Node.js
- Architecture: `x86_64` (Lambda@Edge doesn't support ARM yet)
- Change default execution role (otherwise the function won't run on Lambda@Edge):
    - Execution role: `Create a new role from AWS policy templates`
    - Role name: `opencdn-codegen-role`
    - Policy templates: `Basic Lambda@Edge permissions (for CloudFront trigge)`

Change the function settings:

- On the function page scroll down to the "Runtime settings" section, open settings, and change the handler to `src/index.handler`
- Click the "Configuration" tab, "General configuration", change the memory to 3538 MB, the timeout to 10 seconds, and
    the description to `CDN for open projects (https://github.com/fingerprintjs/cdn)`.

The more RAM allocated to a lambda, the more CPU power it has. 1769MB = 1vCPU.
The asset building speed depends on the allocated RAM linearly.
256MB is enough, but the time to build FingerprintJS (download from NPM + Rollup + Terser) is about 13 seconds.
3538MB (2 vCPUs) is a good balance.

Connect the lambda function to the distribution.
Reload the browser page, otherwise the console may ignore the role changes.
Go to [Lambda / Functions](https://console.aws.amazon.com/lambda/home#/functions).
Open the created function.
Add a trigger: CloudFront. Fill the fields:

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

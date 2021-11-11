<p align="center">
  <a href="https://fingerprintjs.com">
    <img src="https://raw.githubusercontent.com/fingerprintjs/fingerprintjs/846724bc368a562f5fb5fb2e6221e624329e55b6/resources/logo.svg" alt="FingerprintJS" width="312px" />
  </a>
</p>

A CDN for the open source projects of FingerprintJS.
It works as a Lambda@Edge function attached to an AWS CloudFront distribution.

Under the hood, it downloads packages from [NPM](https://npmjs.com), bundles them using [Rollup](https://rollupjs.org) and minifies using [Terser](https://terser.org).
All this happens within a second on Lambda@Edge when a request arrives.
CloudFront caches the responses so that the next requests are served instantly.

## API

An asset URL looks like this:

```
https://openfpcdn.io/project/v3/file.js
```

- `project` is the project name. It matches the part after https://github.com/fingerprintjs.
- `3` is the project version. It can be either a major version (`3`), a minor version (`3.2`) or an exact version (`3.2.1`).
    When a major or minor version is used, the CDN returns the latest appropriate version.
- `file.js` it the name of a file within the project version.

The available projects, versions and files are described in the [src/projects.ts](src/projects.ts) file.
You can find example URLs on the pages of the projects.

## Contributing

See the [contributing guidelines](contributing.md) to learn how to run and deploy the code and how to add new a project.

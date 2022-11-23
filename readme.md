<p align="center">
  <a href="https://fingerprint.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="resources/logo_light.svg" />
      <source media="(prefers-color-scheme: light)" srcset="resources/logo_dark.svg" />
      <img src="resources/logo_dark.svg" alt="Fingerprint logo" width="312px" />
    </picture>
  </a>
</p>

A CDN for the open source projects of Fingerprint.
It works as a Lambda@Edge function attached to an AWS CloudFront distribution.

Under the hood, it downloads packages from [NPM](https://npmjs.com), bundles them using [Rollup](https://rollupjs.org) and minifies using [Terser](https://terser.org).
All this happens within a second on Lambda@Edge when a request arrives.
CloudFront caches the responses so that the next requests are served instantly.

## API

An asset URL looks like this:

```
https://openfpcdn.io/project/v3/file.js
```

- `project` is the project name. It matches the part after `https://github.com/fingerprintjs/`.
- `3` is the project version. It can be either a major version (`3`), a minor version (`3.2`) or an exact version (`3.2.1`).
    When a major or minor version is used, the CDN returns the latest appropriate version.
- `file.js` it the name of a file within the project version.

The available projects, versions and files are described in the [src/projects.ts](src/projects.ts) file.
You can find example URLs on the pages of the projects.

## Contributing

See the [contributing guidelines](contributing.md) to learn how to run and deploy the code and how to add new a project.

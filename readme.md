WIP

A CDN for the open source projects of FingerprintJS

## Library limitations

These limitations apply to the libraries served by the CDN.
Some of these limitations can be extended with changes to the CDN code.

- Only versions published to NPM are served.
- The only allowed external dependency (listed in the `dependencies` field of `package.json`) is `tslib` version 2.
- The browser bundles mustn't be too big because CloudFront allows lambdas to return at most 1MB of data.
- The library's code must be a UTF-8 text.
- The library versions must have at least 3 parts (major, minor and patch) separated by a period.

WIP

A CDN for the open source projects of FingerprintJS

## Library limitations

These limitations apply to the libraries served by the CDN.
Some of these limitations can be extended with changes to the CDN code.

- Only versions published to NPM are served.
- The library versions must have at least 3 parts (major, minor and patch) separated by a period.
    The CDN treats 1- and 2-number versions as vague versions.
- The only allowed external dependency (listed in the `dependencies` field of `package.json`) is `tslib` version 2.
- The browser bundles mustn't exceed 1MB be too big because CloudFront limits the size of the responses produced by lambdas.
- The library's main code (pointed to by the `module` or `main` field of `package.json`) must be a UTF-8 text.
- Ideally, the NPM package should include only the distributive code in a single format. It will make downloading the code faster.

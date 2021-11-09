WIP

A CDN for the open source projects of FingerprintJS

## Library limitations

These limitations apply to the libraries served by the CDN.
Some of these limitations can be extended with changes to the CDN code.

- Only versions published to NPM are served.
- The library versions names must follow the SemVer standard. See the standard:
    [a formal description](https://semver.org/#backusnaur-form-grammar-for-valid-semver-versions) or
    [a regular expression](https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string).
    The CDN treats 1- and 2-number versions as vague versions.
- The only allowed external dependency (listed in the `dependencies` field of `package.json`) is `tslib` version 2.
- The browser bundles mustn't exceed 1MB because CloudFront limits the size of the responses produced by lambdas.
- The library and its external dependencies must have an ES entrypoint (having `import` and `export` instead of `require` and `exports`).
    The entrypoint must be specified by the `module` or the `jsnext:main` field of the `package.json`.
- The library's entrypoint code must be a UTF-8 text.
- Ideally, the NPM package should include only the distributive code in ESM and CJS formats only.
    It will make downloading the code faster.

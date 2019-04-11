# `jest-plugin-must-assert`

A plugin extending the default Jest behavior to fail any tests which do not
perform a runtime assertion.

## WARNING

The plugin is in a working state, but is under construction :construction:

## Install

`npm i -D jest-plugin-must-assert`

For default behavior, add the plugin to your setup files.

```js
...
setupFilesAfterEnv: ['jest-plugin-must-assert'],
...
```

You may also extend the default behavior with the following, manual configuration.

```js
// <rootDir>/must-assert-setup.js
const mustAssert = require('jest-plugin-must-assert/manual');

mustAssert({
  message: 'Please see https://jestjs.io/docs/en/asynchronous for details on testing async code.'
});
```

Then in your config file:

```js
...
setupFilesAfterEnv: [
  '<rootDir>/must-assert-setup'
],
...
```

## Problem

Static analysis is not enough to catch mistakes in asynchronous tests. For this, we require a runtime
check that _some_ assertion was ran during the test.

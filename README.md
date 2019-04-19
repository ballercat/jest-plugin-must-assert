# `jest-plugin-must-assert`

A plugin extending the default Jest behavior to fail any tests which do not
perform a runtime assertion.

## Problem

Asynchronous tests could be challenging to get _right_, particulrary for junior
developers or engineers new to async JavaScript. The most common mistake is an async
test which does not fire any assertions, either due to logic or even syntax errors.
Static analysis(linters) gets close to pointing out the issues, but is not enough to catch logic mistakes.
For this, we require a runtime check that _some_ assertion was ran during the test.

[Jest, unfortunately, has no "failWithoutAssertions" configuration options, so this plugin aims to remedy that.]()
The plugin patches the Jest API to force tests without any assertions to fail. In addition
to failing tests without assertions this plugin also patches a bug in Jest which
leads to [assertions "leaking" accross different tests](https://github.com/facebook/jest/issues/8297).

## Install

`npm i -D jest-plugin-must-assert`

For default behavior, add the plugin to your setup files.

## Use

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
  /**
   * Control the task execution during a test. You may log a custom warning message
   * from here, throw an error etc.
   *
   * Default: The default behavior is that mismatched testIds result in ignoring of the task
   * and a warning message.
   *
   * @param {Number} originTestId  The unique ID of the test where the task is oginating from
   * @param {Number} currentTestId The unique ID of the currently executing test
   * @param {Function} log         The log method (logger.warn)
   *
   * @return {Boolean} true/false for whether or not the task should execute
  onInvokeTask(originTestId, currentTestId, log) {
    return false;
  }
  logger,
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

## Performance

There is some performance implications of using this plugin as it does add a bit of
overhead, but from testing it's a trivial increase. This plugin has been tested
within a project with 1600+ test suites and over 10k individual tests, with only a negligble slow-down.

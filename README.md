# `jest-plugin-must-assert`

A plugin extending the default Jest behavior to fail any tests which do not
perform a runtime assertion.

## Problem

Asynchronous tests could be challenging to get _right_, particularly for junior
developers or engineers new to async JavaScript. The most common mistake is an async
test which does not fire any assertions, either due to logic or even syntax errors.
Static analysis (linters) gets close to pointing out the issues, but is not enough to catch logic mistakes.
For this, we require a runtime check that _some_ assertion was run during the test.

[Jest, unfortunately, has no "failWithoutAssertions" configuration options, so this plugin aims to remedy that.](https://github.com/facebook/jest/issues/2209)
The plugin patches the Jest API to force tests without any assertions to fail. In addition
to failing tests without assertions this plugin also patches a bug in Jest which
leads to [assertions "leaking" accross different tests](https://github.com/facebook/jest/issues/8297).

## Install

`npm i -D jest-plugin-must-assert`

For default behavior, add the plugin to your setup files.

## Supported Jest Environments

- `jest-plugin-must-assert` - Default supported environment, `node`
- `jest-plugin-must-assert/jsdom` - JSDOM environment support. Necessary for
  mocking window task functions like `setTimeout` when using `jest-environment-jsdom`.
  Useful for React tests.

## Use

### For a specific test file

You may import the plugin into any test file you need additional safeguard for async logic.

```js
import 'jest-plugin-must-assert';

test('some logic', () => {
  setTimeout(() => expect(1).toBe(2)); // will be caught by the plugin
  ...
});
```

### For entire test suite

Alternatively, you can enable the plugin for an entire test suite by adding it
to your jest configuration.

```js
...
setupFilesAfterEnv: ['jest-plugin-must-assert'],
...
```

### Manual configuration

You may also extend the default behavior with the following, manual configuration.

```js
// <rootDir>/must-assert-setup.js
const patchJestAPI = require('jest-plugin-must-assert/manual');

patchJestAPI({
  /**
   * Control the task execution during a test. You may log a custom warning message
   * from here, throw an error etc.
   *
   * Default: The default behavior is that mismatched testIds result in ignoring of the task
   * and a warning message.
   *
   * @param {Object} options       Options for the handler (see below)
   *
   * Options:
   * @param {Number} originTestId  The unique ID of the test where the task is oginating from
   * @param {Number} currentTestId The unique ID of the currently executing test
   * @param {String} testName      The name of the test which triggered this event
   * @param {String} taskType      The type of task being invoked (micro/macro task)
   * @param {String} taskSource    The source of the taks ("promise.then", "setTimeout" etc)
   * @param {Object} logger        The logger object (defaults to console)
   *
   * @throws {Error} Default: throws. This function _may_ throw an error instead of logging it if
   *                 you would like a stack trace back to the origin of the task being ignored.
   *
   * @return {Boolean} true/false for whether or not the task should execute
   */
  onInvokeTask({
    originZoneId,
    currentZoneId,
    testName,
    taskType,
    taskSource,
  }) {
    // This is the default implementation of onInvokeTask. The error thrown will
    // be displayed as a logger.warn with a cleaned up stack trace.
    if (originZoneId !== currentZoneId) {
      throw new Error(
        `Test "${testName}" is attempting to invoke a ${taskType}(${taskSource}) after test completion. Ignoring`
      );
    }
    return true;
  },

  /**
   * Logger DI. Used by the internal methods to log warnings/errors. Should match console API.
   */
  logger,

  /**
   * Regex list of what functions should be REMOVED from the stack traces of cancelled tasks.
   * These are the default values. Overwriting this option removes these values
   */
  ignoreStack = [/Zone/, /zone\.js/, /node_modules/],
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

There are some performance implications of using this plugin as it does add a bit of
overhead, but from testing it's a trivial increase. This plugin has been tested
within a project with 1600+ test suites and over 10k individual tests, with only a negligible slow-down.

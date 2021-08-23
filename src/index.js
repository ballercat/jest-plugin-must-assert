/**
 * Implementation of Must assert plugin
 *
 * @author  Arthur Buldauskas <arthurbuldauskas@gmail.com>
 */
const StackUtils = require('stack-utils');
const { getWrapper } = require('./wrap-test');
const { getZones } = require('./zones');

/**
 * Responds to task invokations. Default implementation
 *
 * @throws
 *
 * @return Boolean Whether or not the task should be allowed to run
 */
function onInvokeTaskDefault({
  // The zone ID which originated this task
  originZoneId,
  // The current global zone ID currently executing
  currentZoneId,
  // The name of the test from where this task originates
  testName,
  // The type of the task being acted upon [micro || macro]Task
  task,
  getLongStackTrace,
}) {
  // Note that we do not use "testName" for this as they are not guaranteed to be
  // unique
  if (originZoneId !== currentZoneId) {
    const error = new Error(
      `Test "${testName}" is attempting to invoke a ${task.type}(${task.source}) after test completion. See stack-trace for details.`
    );
    console.log(getLongStackTrace());
    throw error;
  }
  return true;
}

/**
 * Path Jest test API
 *
 * We will wrap every supported Jest method so that we can place every test
 * that is declared with it's own Zone. Each test will have it's own zone, which
 * will have a unique ID. There will be one global "current" zone ID, whenever an
 * async event attempts to invoke a callback which is NOT from the current zone
 * ID we will block it and log a warning.
 *
 * @return void
 */
function patchJestAPI({
  // Set your own onInvoke task handler if you don't like the original behavior
  onInvokeTask = onInvokeTaskDefault,
  // Logger override
  logger = console,
  // Regex of what should be REMOVED from the stack traces of cancelled tasks
  ignoreStack = [/Zone/, /zone\.js/, /node_modules/],
}) {
  const { enterZone, exitZone } = getZones({
    onInvokeTask,
    logger,
    ignoreStack,
  });
  const wrapTest = getWrapper({ enterZone, exitZone });

  // TODO: Figure out a way to show the original test during errors instead of the
  // wrapper below. AFAIK it's not doable unless we recompile the original fn and
  // somehow append the extra checks...
  function enhanceJestImplementationWithAssertionCheck(jestTest) {
    return function ehanchedJestMehod(name, fn, timeout) {
      return jestTest(name, wrapTest(fn, name), timeout);
    };
  }

  // Create the enhanced version of the base test() method
  const enhancedTest = enhanceJestImplementationWithAssertionCheck(global.test);

  // TODO: Support .each
  const donotpatch = ['each', 'skip', 'todo'];

  Object.keys(global.test).forEach(key => {
    if (typeof global.test[key] === 'function' && !donotpatch.includes(key)) {
      enhancedTest[key] = enhanceJestImplementationWithAssertionCheck(
        global.test[key]
      );
    } else {
      enhancedTest[key] = global.test[key];
    }
  });

  global.it = enhancedTest;
  global.fit = enhancedTest.only;
  global.test = enhancedTest;
}

// Default export
//
// The plugin does nothing unless this is invoked
module.exports = patchJestAPI;

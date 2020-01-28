/**
 * Implementation of Must assert plugin
 *
 * @author  Arthur Buldauskas <arthurbuldauskas@gmail.com>
 */
const StackUtils = require('stack-utils');

// Default export
//
// The plugin does nothing unless this is invoked
module.exports = patchJestAPI;

const EXPOSE_ERROR = Symbol('EXPOSE_ERROR');

/**
 * Return true if object is a promise
 *
 * @return Boolean
 */
const isThenable = obj =>
  typeof obj === 'object' && obj != null && typeof obj.then === 'function';

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
  taskType,
  // Promise, setTimeout etc.
  taskSource,
}) {
  // Note that we do not use "testName" for this as they are not guaranteed to be
  // unique
  if (originZoneId !== currentZoneId) {
    throw new Error(
      `Test "${testName}" is attempting to invoke a ${taskType}(${taskSource}) after test completion. See stack-trace for details.`
    );
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
  // Requiring Zone libraries here ensures that we allow for users of the
  // plugin to conditionally add this functionally per test suite module.

  // Zone will patch console for us, but we don't really want that
  const consoleMethods = Object.entries(global.console);

  require('zone.js');
  require('zone.js/dist/long-stack-trace-zone');

  // Restore default console
  consoleMethods.forEach(([key, value]) => {
    global.console[key] = value;
  });

  // We clean the stacks to make them easier to reason about in the console output
  const stack = new StackUtils({
    cwd: process.cwd(),
    // Stack utils API for what functions should be removed from the stack trace
    // We omit node_modules, Zone library and node internals by default
    internals: StackUtils.nodeInternals().concat(ignoreStack),
  });

  // Zone sets itself as a global, that's just how the library works
  const Zone = global.Zone;
  // The current zone. Every time a test starts this changes
  let currentZone = null;

  // All zone ID should be unique
  let uniqueIdentifier = 0;
  const uuid = () => ++uniqueIdentifier;

  /**
   * Return whether or not the test which we are in has it's own expect.hasAssertions
   * check defined.
   *
   * @return Boolean
   */
  const testNeedsAssertionCheck = () => {
    // Safety check for misconfigured tests (eg overriding expect itself)
    // Or a test runner which is not Jest
    if (!(typeof expect !== 'undefined' && 'getState' in expect)) {
      return false;
    }

    // Jest keeps state as a global, exposes it on the expect API
    const state = expect.getState();

    return (
      typeof state.expectedAssertionsNumber !== 'number' &&
      !state.isExpectingAssertions
    );
  };

  /**
   * Exit the current zone
   *
   * Only if it still matches the zone ID attempting to exit
   *
   */
  const exitZone = id => {
    if (id === currentZone) {
      currentZone = null;
    }
  };

  /**
   * Enter a new zone
   *
   */
  const enterZone = (callback, name, hasDoneCallback) => {
    const id = uuid();

    /**
     * Create a new zone using Zone.js API
     *
     * See https://github.com/angular/angular/blob/master/packages/zone.js/lib/zone.ts
     */
    const zone = Zone.root
      .fork({
        name,
        // Attach the id to the zone object
        properties: {
          id,
        },
        onHandleError(delegate, current, target, e) {
          if (e && e[EXPOSE_ERROR]) {
            logger.warn(`${e.message}\n\n${stack.clean(e.stack)}`);
            return false;
          }
          throw e;
        },
        onInvokeTask(delegate, current, target, task, applyThis, applyArgs) {
          let error;
          let result = true;
          try {
            result = onInvokeTask({
              originZoneId: current.get('id'),
              currentZoneId: currentZone,
              testName: name,
              taskType: task.type,
              taskSource: task.source,
              logger: logger,
            });
          } catch (e) {
            error = e;
          }

          if (error) {
            error[EXPOSE_ERROR] = true;
            error.task = task;
            throw error;
          }

          if (!result) {
            return;
          }

          return delegate.invokeTask(target, task, applyThis, applyArgs);
        },
      })
      // We fork from the special stack-trace zone so that there is a trail leading
      // back to the origin of the ignored tasks
      .fork(Zone.longStackTraceZoneSpec);

    currentZone = id;

    return [zone.wrap(hasDoneCallback ? callback : done => callback(done)), id];
  };

  /**
   * Wrap a test in a zone
   *
   * We will use the zone defined above to control async events spawning form this
   * test
   *
   * @return Function
   */
  const wrapTest = (fn, name) => {
    let testMustAssert, unhandledError;
    const hasDoneCallback = fn.length > 0;

    const recordUnhandledException = e => (unhandledException = e);
    const listenToExceptions = () =>
      process.addListener('unhandledRejection', recordUnhandledException);
    const cleanupListeners = () =>
      process.removeListener('unhandledRejection', recordUnhandledException);

    const [zonedTest, zoneId] = enterZone(fn, name, hasDoneCallback);

    // Support done() callback style tests
    if (hasDoneCallback) {
      return (doneOriginal, ...args) => {
        const done = () => {
          exitZone(zoneId);
          cleanupListeners();
          doneOriginal();
        };

        listenToExceptions();

        const result = zonedTest(done, ...args);

        // If there were no assertion count checks, add them
        if (testNeedsAssertionCheck()) {
          expect.hasAssertions();
        }

        return result;
      };
    }

    // If the test is NOT using a done callback run it as normal
    return () => {
      // Run the test
      const result = zonedTest();

      // If there were no assertion count checks, add them
      if (testNeedsAssertionCheck()) {
        expect.hasAssertions();
      }

      // Not a promise returned from the test, exit zone and return the result
      if (!isThenable(result)) {
        exitZone(zoneId);
        return result;
      }

      // If the test returned a promise, wait until it resolves before exiting
      // the zone

      // Listen to unhandledPromiseRejections to mirror jest behavior
      //
      // We will need to re-throw any errors found to make sure jest can
      // still fail this test. This is default Jest behavior
      listenToExceptions();

      return result.then(
        // Test promise resolved without issue
        () => {
          exitZone(zoneId);

          cleanupListeners();

          if (unhandledException) {
            throw unhandledException;
          }
        },
        // Test threw
        e => {
          cleanupListeners();

          exitZone(zoneId);

          throw e;
        }
      );
    };
  };

  function enhanceJestImplementationWithAssertionCheck(jestTest) {
    return function ehanchedJestMehod(name, fn, timeout) {
      return jestTest(name, wrapTest(fn, name), timeout);
    };
  }

  // Create the enhanced version of the base test() method
  const enhancedTest = enhanceJestImplementationWithAssertionCheck(global.test);

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

const StackUtils = require('stack-utils');
module.exports = patchJestAPI;

const EXPOSE_ERROR = Symbol('EXPOSE_ERROR');

function onInvokeTaskDefault({
  originZoneId,
  currentZoneId,
  testName,
  taskType,
  taskSource,
}) {
  if (originZoneId !== currentZoneId) {
    throw new Error(
      `Test "${testName}" is attempting to invoke a ${taskType}(${taskSource}) after test completion. See stack-trace for details.`
    );
  }
  return true;
}

function patchJestAPI({
  onInvokeTask = onInvokeTaskDefault,
  logger = console,
}) {
  const consoleMethods = Object.entries(global.console);
  const restoreConsole = () =>
    consoleMethods.forEach(([key, value]) => {
      global.console[key] = value;
    });

  require('zone.js');
  require('zone.js/dist/long-stack-trace-zone');
  // NOTE: zone.js patches console methods, avoid that.
  restoreConsole();

  const stack = new StackUtils({
    cwd: process.cwd(),
    internals: StackUtils.nodeInternals().concat([
      /Zone/,
      /zone\.js/,
      /jest-plugin-must-assert/,
    ]),
  });
  // Zone sets itself as a global...
  const Zone = global.Zone;
  let currentZone = null;
  let uniqueIdentifier = 0;
  const uuid = () => ++uniqueIdentifier;

  const testNeedsAssertionCheck = () => {
    // Some misconfigured test (eg overriding expect itself)
    if (!(typeof expect !== 'undefined' && 'getState' in expect)) {
      return false;
    }
    const state = expect.getState();
    return (
      typeof state.expectedAssertionsNumber !== 'number' &&
      !state.isExpectingAssertions
    );
  };

  const exitZone = () => (currentZone = null);
  const enterZone = (callback, name, hasDoneCallback) => {
    const id = uuid();
    const zone = Zone.root
      .fork({
        name,
        properties: {
          id,
        },
        onHandleError(delegate, current, target, e) {
          if (e && e[EXPOSE_ERROR]) {
            logger.warn(`${e.message}\n\n${stack.clean(e.stack)}`);
          }
          return false;
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

    return zone.wrap(hasDoneCallback ? callback : done => callback(done));
  };

  const wrapTest = (fn, name) => {
    let testMustAssert;
    const hasDoneCallback = fn.length > 0;

    if (!hasDoneCallback) {
      return () => {
        const result = enterZone(fn, name, false)();

        if (testNeedsAssertionCheck()) {
          expect.hasAssertions();
        }

        if (
          typeof result === 'object' &&
          result != null &&
          typeof result.then === 'function'
        ) {
          return result.then(exitZone, e => {
            exitZone();
            throw e;
          });
        }

        exitZone();
        return result;
      };
    }

    return (doneOriginal, ...args) => {
      const done = () => {
        exitZone();
        doneOriginal();
      };
      const result = enterZone(fn, name, true)(done, ...args);

      if (testNeedsAssertionCheck()) {
        expect.hasAssertions();
      }

      return result;
    };
  };

  function enhanceJestImplementationWithAssertionCheck(jestTest) {
    return function ehanchedJestMehod(name, fn, timeout) {
      return jestTest(name, wrapTest(fn, name), timeout);
    };
  }

  // Create the enhanced version of the base test() method
  const enhancedTest = enhanceJestImplementationWithAssertionCheck(global.test);

  Object.keys(global.test).forEach(key => {
    if (
      typeof global.test[key] === 'function' &&
      key !== 'each' &&
      key !== 'skip'
    ) {
      enhancedTest[key] = enhanceJestImplementationWithAssertionCheck(
        global.test[key]
      );
    } else {
      enhancedTest[key] = global.test[key];
    }
  });

  global.it = enhancedTest;
  global.fit = enhancedTest;
  global.test = enhancedTest;
}

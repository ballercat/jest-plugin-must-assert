const StackUtils = require('stack-utils');
module.exports = patchJestAPI;

const creationTrace = '__creationTrace__';
const EXPOSE_ERROR = Symbol('EXPOSE_ERROR');

function TEST_COMPLETE(name) {
  const key = `FINISHED TEST: ${name}`;
  const o = {
    [key]() {
      return {
        finishLine: true,
        error: new Error('STACKTRACE TRACKING'),
        timestamp: new Date(),
      };
    },
  };

  return o[key];
}

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
  ignoreStack = [],
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
    internals: StackUtils.nodeInternals()
      .concat([/Zone/, /zone\.js/, /node_modules/])
      .concat(ignoreStack),
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

  const exitZone = (from, name) => {
    if (from && from.get('state') && !from.get('state').finished) {
      from.get('state').finished = TEST_COMPLETE(name)();
    }
    currentZone = null;
  };
  const enterZone = (callback, name, hasDoneCallback) => {
    const id = uuid();
    const zone = Zone.root
      .fork({
        name,
        properties: {
          state: {
            finished: null,
          },
          id,
        },
        onHandleError(delegate, current, target, e) {
          if (e && e[EXPOSE_ERROR]) {
            logger.warn(`${e.message}\n\n${stack.clean(e.stack)}`);
          } else {
            console.log(e.message);
          }
          return false;
        },
        onScheduleTask(parentZoneDelegate, currentZone, targetZone, task) {
          if (targetZone.get('state').finished) {
            task.data[creationTrace] = (task.data[creationTrace] || []).concat([
              targetZone.get('state').finished,
            ]);
          }
          return parentZoneDelegate.scheduleTask(targetZone, task);
        },
        onInvokeTask(delegate, current, target, task, applyThis, applyArgs) {
          let error;
          let result = true;
          const trace = task.data[creationTrace] || [];
          if (target.get('state').finished && !trace.find(t => t.finishLine)) {
            task.data[creationTrace] = trace.concat([
              target.get('state').finished,
            ]);
          }
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

    return [
      zone.wrap(hasDoneCallback ? callback : done => callback(done)),
      zone,
    ];
  };

  const wrapTest = (fn, name) => {
    let testMustAssert;
    const hasDoneCallback = fn.length > 0;

    if (!hasDoneCallback) {
      return () => {
        const [zoneFN, zone] = enterZone(fn, name, false);
        const result = zoneFN();

        if (testNeedsAssertionCheck()) {
          expect.hasAssertions();
        }

        if (
          typeof result === 'object' &&
          result != null &&
          typeof result.then === 'function'
        ) {
          return result.then(exitZone, e => {
            exitZone(zone, name);
            throw e;
          });
        }

        exitZone(zone, name);
        return result;
      };
    }

    return (doneOriginal, ...args) => {
      const [zoneFN, zone] = enterZone(fn, name, false);
      const done = () => {
        exitZone(zone, name);
        doneOriginal();
      };
      const result = zoneFN(done, ...args);
      // const result = enterZone(fn, name, true)(done, ...args);

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
  global.fit = enhancedTest.only;
  global.test = enhancedTest;
}

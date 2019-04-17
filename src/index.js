const consoleMethods = Object.entries(global.console);
const restoreConsole = () =>
  consoleMethods.forEach(([key, value]) => {
    global.console[key] = value;
  });

require('zone.js');

// NOTE: zone.js patches console methods, avoid that.
restoreConsole();

// Zone sets itself as a global...
const Zone = global.Zone;
let currentZone = null;
let uniqueIdentifier = 0;
const uuid = () => ++uniqueIdentifier;

const testHasNoExplicitAssertionChecks = () => {
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
  const zone = Zone.root.fork({
    name,
    properties: {
      id,
    },
    onHandleError(delegate, current, target, e) {
      return false;
    },
    onInvokeTask(delegate, current, target, task, applyThis, applyArgs) {
      if (current.get('id') !== currentZone) {
        console.warn(
          `Test "${current.name}" is attempting to invoke a ${task.type}(${
            task.source
          }) after test completion. Ignoring`
        );
        return;
      }

      return delegate.invokeTask(target, task, applyThis, applyArgs);
    },
  });

  currentZone = id;

  return zone.wrap(hasDoneCallback ? callback : done => callback(done));
};

const wrapTest = (fn, name) => {
  let testMustAssert;
  const hasDoneCallback = fn.length > 0;

  if (!hasDoneCallback) {
    return () => {
      const result = enterZone(fn, name, false)();

      if (testHasNoExplicitAssertionChecks()) {
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

    if (testHasNoExplicitAssertionChecks()) {
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

require('zone.js');
// Zone sets itself as a global...
const Zone = global.Zone;

const testHasNoExplicitAssertionChecks = (state = expect.getState()) =>
  typeof state.expectedAssertionsNumber !== 'number' &&
  !state.isExpectingAssertions;

let currentZone = null;
let uniqueIdentifier = 0;
const uuid = () => ++uniqueIdentifier;

const wrapTest = fn => {
  let testMustAssert;
  const hasDoneCallback = fn.length > 0;

  if (!hasDoneCallback) {
    return () => {
      const result = fn();

      if (testHasNoExplicitAssertionChecks()) {
        expect.hasAssertions();
      }

      if (
        typeof result === 'object' &&
        result != null &&
        typeof result.then === 'function'
      ) {
        return result.then(
          () => (currentZone = null),
          e => {
            currentZone = null;
            throw e;
          }
        );
      }

      currentZone = null;
      return result;
    };
  }

  return (doneOriginal, ...args) => {
    const done = () => {
      currenZone = null;
      doneOriginal();
    };
    const result = fn(done, ...args);

    if (testHasNoExplicitAssertionChecks()) {
      expect.hasAssertions();
    }

    return result;
  };
};

function enhanceJestImplementationWithAssertionCheck(jestTest) {
  return function ehanchedJestMehod(name, fn, timeout) {
    const id = uuid();
    const zone = Zone.root.fork({
      name,
      properties: {
        id,
      },
      onInvoke(
        delegate,
        current,
        target,
        callback,
        applyThis,
        applyArgs,
        source
      ) {
        currentZone = id;
        delegate.invoke(target, callback, applyThis, applyArgs, source);
      },
      onInvokeTask(delegate, current, target, task, applyThis, applyArgs) {
        if (current.get('id') !== currentZone) {
          console.warn(
            `Test "${current.name}" is attempting to invoke a ${task.type}(${
              task.source
            }) after test completion. Ignoring`
          );
        } else {
          delegate.invokeTask(target, task, applyThis, applyArgs);
        }
      },
    });
    const hasDoneCallback = fn.length > 0;
    const wrapper = zone.wrap(wrapTest(fn));
    return jestTest(
      name,
      hasDoneCallback ? done => wrapper(done) : wrapper,
      timeout
    );
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

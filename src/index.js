/**
 *
 */
const testHasNoExplicitAssertionChecks = (state = expect.getState()) =>
  typeof state.expectedAssertionsNumber !== "number" &&
  !state.isExpectingAssertions;

const wrapTest = fn => {
  let testMustAssert;
  const hasDoneCallback = fn.length > 0;

  if (hasDoneCallback) {
    testMustAssert = (done, ...args) => {
      const result = fn(done, ...args);

      if (testHasNoExplicitAssertionChecks()) {
        expect.hasAssertions();
      }

      return result;
    };
  } else {
    testMustAssert = () => {
      const result = fn();

      if (testHasNoExplicitAssertionChecks()) {
        expect.hasAssertions();
      }

      return result;
    };
  }
  return testMustAssert;
};

function enhanceJestImplementationWithAssertionCheck(jestTest) {
  return function ehanchedJestMehod(name, fn, timeout) {
    return jestTest(name, wrapTest(fn), timeout);
  };
}

// Create the enhanced version of the base test() method
const enhancedTest = enhanceJestImplementationWithAssertionCheck(global.test);

Object.keys(global.test).forEach(key => {
  if (
    typeof global.test[key] === "function" &&
    key !== "each" &&
    key !== "skip"
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

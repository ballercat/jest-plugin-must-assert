/**
 * Test wrapper implementation
 *
 * @author Arthur Buldauskas<arthurbuldauskas@gmail.com>
 */

/**
 * Return true if object is a promise
 *
 * @return Boolean
 */
const isThenable = obj =>
  typeof obj === 'object' && obj != null && typeof obj.then === 'function';

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

const getWrapper = ({ enterZone, exitZone }) => {
  /**
   * Wrap a test in a zone
   *
   * We will use the zone defined above to control async events spawning form this
   * test
   *
   * @return Function
   */
  const wrap = (fn, name) => {
    let testMustAssert, unhandledException;
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

  return wrap;
};

module.exports = {
  getWrapper,
};

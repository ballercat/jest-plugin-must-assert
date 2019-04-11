const runJest = require('../runJest');

test('failing tests', async () => {
  const results = await runJest('e2e/failing');

  const totalTestsExecuted =
    results.json.numTotalTests - results.json.numPendingTests;
  // We should have ran _some_ tets here
  expect(totalTestsExecuted > 0).toBe(true);
  // All tests that were executed should have failed
  expect(results.json.numFailedTests).toBe(totalTestsExecuted);
});

test('passing tests', async () => {
  const results = await runJest('e2e/passing');

  const totalTestsExecuted =
    results.json.numTotalTests - results.json.numPendingTests;
  // We should have ran _some_ tets here
  expect(totalTestsExecuted > 0).toBe(true);
  // All tests that were executed should have passed
  expect(results.json.numPassedTests).toBe(totalTestsExecuted);
});

test.skip('assertions after done() callback - 1', done => {
  // expect.hasAssertions();
  setTimeout(() => {
    done();
    setTimeout(() => {
      expect(1 + 2).toBe(2);
    });
  });
});

test.skip('assertions after done() callback - 2', done => {
  expect.hasAssertions();
  setTimeout(() => {
    done();
    setTimeout(() => {
      // expect(1 + 1).toBe(2);
    });
  });
});

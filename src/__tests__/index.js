const runJest = require('../runJest');

// A generous timeout as the e2e failing tests timeout in some cases (as intended)
jest.setTimeout(8000);

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

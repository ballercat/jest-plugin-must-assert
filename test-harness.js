/**
 * This script is used to run the e2e folder tests directly to get realtime
 * feedback.
 */
const runCLI = require('jest-cli').runCLI;

const options = {
  projects: ['./e2e/failing'],
  watch: true,
};

const run = async () => {
  const tests = await runCLI(options, options.projects);

  if (!tests.results.numFailedTests) {
    console.error(
      `\nExpected all tests to fail, instead failed: ${
        tests.results.numFailedTests
      }`
    );
    process.exit(1);
  }
};

run();

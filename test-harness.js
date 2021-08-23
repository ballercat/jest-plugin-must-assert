/**
 * This script is used to run the e2e folder tests directly to get realtime
 * feedback.
 */
const runCLI = require('jest').runCLI;

const [env = 'node'] = process.argv.slice(2);
const projectmap = {
  node: './e2e/failing',
  jsdom: './e2e/failing-jsdom',
  passing: './e2e/passing',
};

const options = {
  projects: [projectmap[env]],
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

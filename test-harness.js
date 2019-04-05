const runCLI = require("jest-cli").runCLI;

const options = {
  projects: ["./examples"],
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

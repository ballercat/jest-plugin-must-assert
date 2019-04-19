const patchJestAPI = require('./src');

patchJestAPI({
  logger: console,
});

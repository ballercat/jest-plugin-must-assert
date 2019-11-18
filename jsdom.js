require('zone.js/dist/zone.min');
const patchJestAPI = require('./src');

patchJestAPI({
  logger: console,
});

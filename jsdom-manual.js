module.exports = (...args) => {
  require('zone.js/dist/zone.min');
  return require('./src')(...args);
};

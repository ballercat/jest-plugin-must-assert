// Slimmed down version from jest itself
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
const path = require('path');
const fs = require('fs');
const execa = require('execa');
const stripAnsi = require('strip-ansi');

const JEST_PATH = path.resolve(__dirname, '../node_modules/.bin/jest');
const ROOT_PATH = path.resolve(__dirname, '..');

function normalizeResult(result) {
  // For compat with cross-spawn
  result.status = result.code;

  result.stdout = stripAnsi(result.stdout);
  //result.stderr = normalizeIcons(result.stderr);
  result.stderr = stripAnsi(result.stderr);

  return result;
}

// Spawns Jest and returns either a Promise
function spawnJest(dir, args, options = {}) {
  dir = path.resolve(ROOT_PATH, dir);

  const localPackageJson = path.resolve(dir, 'package.json');
  if (!options.skipPkgJsonCheck && !fs.existsSync(localPackageJson)) {
    throw new Error(
      `
      Make sure you have a local package.json file at
        "${localPackageJson}".
      Otherwise Jest will try to traverse the directory tree and find the
      global package.json, which will send Jest into infinite loop.
    `
    );
  }
  const env = Object.assign({}, process.env, { FORCE_COLOR: '0' });

  if (options.nodeOptions) env['NODE_OPTIONS'] = options.nodeOptions;
  if (options.nodePath) env['NODE_PATH'] = options.nodePath;

  const spawnArgs = [JEST_PATH, ...(args || [])];
  const spawnOptions = {
    cwd: dir,
    env,
    reject: false,
    timeout: options.timeout || 0,
  };

  return execa(process.execPath, spawnArgs, spawnOptions);
}

module.exports = async function runJest(dir, args = [], options = {}) {
  args = [].concat(args).concat(['--json']);

  const result = await spawnJest(dir, args, options);
  try {
    result.json = JSON.parse(result.stdout || '');
  } catch (e) {
    throw new Error(
      `
      Can't parse JSON.
      ERROR: ${e.name} ${e.message}
      STDOUT: ${result.stdout}
      STDERR: ${result.stderr}
    `
    );
  }

  return normalizeResult(result);
};


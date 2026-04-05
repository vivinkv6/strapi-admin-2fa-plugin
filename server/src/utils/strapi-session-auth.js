'use strict';

const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');

function resolveSessionAuthPath() {
  const cwd = process.cwd();
  const candidatePaths = [
    path.join(cwd, 'node_modules', '@strapi', 'admin', 'dist', 'server', 'shared', 'utils', 'session-auth.js'),
    path.join(cwd, '..', 'node_modules', '@strapi', 'admin', 'dist', 'server', 'shared', 'utils', 'session-auth.js'),
  ];

  const resolvedPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(
      `Unable to locate Strapi admin session-auth helper. Checked: ${candidatePaths.join(', ')}`
    );
  }

  return resolvedPath;
}

const runtimeRequire = createRequire(__filename);

module.exports = runtimeRequire(resolveSessionAuthPath());

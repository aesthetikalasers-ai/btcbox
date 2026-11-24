'use strict';
// Static-named fallback for the Vercel dynamic [...path] multi-segment routing bug.
// Rewrites send every /api/* that did not match a filesystem function here.
module.exports = require('../api-adapter.js');

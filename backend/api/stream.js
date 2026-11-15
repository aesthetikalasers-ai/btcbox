'use strict';
// Server-Sent Events entrypoint.
//
// This is NOT routed through api-adapter.js: that adapter buffers the entire
// response before writing, which would defeat streaming. vercel.json rewrites
// `/api/stream/*` here before the generic `/api/*` -> `/api/router` rule.
module.exports = require('../stream-api.js');

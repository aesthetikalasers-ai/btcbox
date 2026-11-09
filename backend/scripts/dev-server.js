'use strict';
// Local integration entrypoint: use the real API adapter and Vite on one origin.
// Credentials are supplied through the process environment, never this file.
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function start() {
  if (process.env.CONTEXT !== 'dev') throw new Error('Set CONTEXT=dev for the local integration server.');
  const port = Number(process.env.BTCBOX_DEV_PORT || 4175);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid BTCBOX_DEV_PORT.');
  const root = path.resolve(__dirname, '../../frontend');
  const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const server = http.createServer();
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  const api = require('../api-adapter');
  const health = require('../api/healthz');
  server.on('request', (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { res.statusCode = 400; return res.end('Bad request'); }
    const pathname = url.pathname;
    if (pathname === '/api/healthz') return void health(req, res);
    if (pathname === '/api' || pathname.startsWith('/api/')) return void api(req, res);
    if (pathname === '/auth/callback' || pathname === '/admin.html') {
      res.writeHead(302, { Location: pathname === '/admin.html' ? '/admin' : '/auth/react-callback' + url.search });
      return res.end();
    }
    const retained = {
      '/oauth/consent': ['oauth/consent.html', 'text/html; charset=utf-8'],
      '/oauth/consent.html': ['oauth/consent.html', 'text/html; charset=utf-8'],
      '/oauth/consent.js': ['oauth/consent.js', 'text/javascript; charset=utf-8'],
      '/assets/css/tokens.css': ['assets/css/tokens.css', 'text/css; charset=utf-8'],
    }[pathname];
    if (retained) {
      void readFile(path.resolve(__dirname, '..', retained[0])).then(body => {
        res.setHeader('Content-Type', retained[1]);
        res.end(body);
      }).catch(() => { res.statusCode = 500; res.end('Resource unavailable'); });
      return;
    }
    vite.middlewares(req, res);
  });
  server.on('error', async error => { console.error(error.message); await vite.close(); process.exitCode = 1; });
  server.listen(port, process.env.BTCBOX_DEV_HOST || '127.0.0.1', () => {
    console.log(`BTCBOX local integration server listening on port ${server.address().port}`);
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    server.closeAllConnections();
    await vite.close();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
start().catch(error => { console.error(error.message); process.exitCode = 1; });

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);

  // Handle favicon explicitly so browsers never see a 404
  if (reqPath === '/favicon.ico') {
    const iconFile = path.join(__dirname, 'assets', 'icons', 'Dust.png');
    const rootFavicon = path.join(__dirname, 'favicon.ico');
    const target = fs.existsSync(rootFavicon) ? rootFavicon : (fs.existsSync(iconFile) ? iconFile : null);

    if (target) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(target).pipe(res);
    } else {
      res.writeHead(204); // No content, no error
      res.end();
    }
    return;
  }

  if (reqPath === '/') reqPath = '/index.html';

  const safePath = path.normalize(path.join(__dirname, reqPath));
  if (!safePath.toLowerCase().startsWith(__dirname.toLowerCase())) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`> Game server running at http://localhost:${PORT}/`);
  console.log(`> Press Ctrl+C to stop.`);
});

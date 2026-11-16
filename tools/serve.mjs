// 手元で画面を確かめるための小さなサーバー（公開には使わない）。
// GitHub Pages と同じく /<リポジトリ名>/ の下で出して、相対パスの間違いに気づけるようにする。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = '/git_kintore-page/';
const PORT = Number(process.env.PORT || 5183);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(BASE)) { res.writeHead(302, { Location: BASE }).end(); return; }
  const rel = path.slice(BASE.length) || 'index.html';
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || rel.split('/').some((p) => p.startsWith('.')) || file.includes(`${sep}node_modules${sep}`)) {
    res.writeHead(403).end(); return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}${BASE}`));

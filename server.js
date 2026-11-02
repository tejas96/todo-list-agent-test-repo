import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 5173);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const root = process.cwd();

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  const rel = url === '/' ? 'public/index.html' : url.startsWith('/src/') ? url.slice(1) : join('public', url);
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Todo app on http://localhost:${PORT}`));

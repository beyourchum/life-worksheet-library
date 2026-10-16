const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createHash} = require('node:crypto');
function readSnapshot(root) {
  const files = new Map();
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const file = path.join(directory,entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.set(file,fs.readFileSync(file));
    }
  };
  visit(root);
  return files;
}
function snapshotHash(files) {
  const hash=createHash('sha256');
  for (const [file,content] of [...files].sort(([a],[b])=>a.localeCompare(b))) hash.update(file).update('\0').update(content).update('\0');
  return hash.digest('hex');
}
async function start(root, {snapshot = false} = {}) {
  root = path.resolve(root);
  const files=snapshot ? readSnapshot(root) : null;
  const hash=files ? snapshotHash(files) : null;
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); }
    catch { res.writeHead(400); return res.end(); }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (files ? files.has(path.join(file,'index.html')) : fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (files ? !files.has(file) : !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
    res.end(files ? files.get(file) : fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}`, snapshotHash:hash,
    snapshotUnchanged:()=>!files || snapshotHash(readSnapshot(root))===hash };
}
module.exports = { start };

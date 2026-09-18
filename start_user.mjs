import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
import {spawn, spawnSync} from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const url = 'http://127.0.0.1:8769/';
const occupied = await new Promise(resolve => {
  const socket = createConnection({host:'127.0.0.1', port:8769});
  const finish = busy => { socket.destroy(); resolve(busy); };
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
  socket.setTimeout(1000, () => finish(true));
});

if (occupied) {
  let samePortal = false;
  try {
    const response = await fetch(`${url}package.json`, {signal:AbortSignal.timeout(3000)});
    const expected = JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
    samePortal = response.ok && (await response.json()).name === expected.name;
  } catch {}
  if (samePortal) {
    console.log(`User portal is already running: ${url}`);
    process.exit(0);
  }
  console.error('Port 8769 is occupied by another service or an unresponsive portal.');
  console.error('Close that service, then run start_user.cmd again.');
  process.exit(1);
}

const vite = join(root,'node_modules','vite','bin','vite.js');
if (!existsSync(vite)) {
  console.log('Installing user portal dependencies...');
  const installed = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d','/c','npm.cmd install'], {cwd:root,stdio:'inherit'});
  if (installed.error || installed.status !== 0) {
    console.error(installed.error?.message || 'Dependency installation failed.');
    process.exit(installed.status || 1);
  }
}

console.log(`User portal: ${url}`);
const server = spawn(process.execPath,[vite],{cwd:root,stdio:'inherit'});
server.on('error', error => {console.error(error.message);process.exitCode=1;});
server.on('exit', code => {process.exitCode=code ?? 0;});
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));

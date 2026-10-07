// Development: Vite dev server for the editor (hot reload) + Electron.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer({ configFile: path.join(root, 'vite.config.mts') });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5183/';
console.log(`Editor dev server: ${url}`);

// ELECTRON_RUN_AS_NODE (set inside VS Code) would make Electron behave like plain Node.
const env = { ...process.env, TSTVN_DEV_URL: url };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electronPath, ['.'], { cwd: root, stdio: 'inherit', env });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

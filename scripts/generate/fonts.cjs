const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const bundledPython = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const candidates = process.platform === 'win32'
  ? [...(fs.existsSync(bundledPython) ? [[bundledPython, []]] : []), ['python', []], ['py', ['-3']]]
  : [['python3', []], ['python', []]];
let lastError;
for (const [command, prefix] of candidates) {
  const result = spawnSync(command, [...prefix, 'scripts/generate/fonts.py', ...process.argv.slice(2).filter((arg) => arg !== '--')], {
    stdio: 'inherit',
    shell: false,
  });
  if (!result.error) process.exit(result.status ?? 1);
  lastError = result.error;
}
throw lastError;

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function runReported(file, metadata, run) {
  const report = { ...metadata, runId: randomUUID(), startedAt: new Date().toISOString(),
    finishedAt: null, status: 'running', checks: [], failures: [] };
  const save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  save();
  const fail = (name, error) => {
    const message = error?.message || String(error);
    report.failures.push({ name, message });
    console.error(`FAIL ${name}: ${message}`);
  };
  const record = async (name, check) => {
    let passed = false;
    try {
      const detail = await check();
      report.checks.push({ name, detail });
      console.log(`PASS ${name}`);
      passed = true;
    } catch (error) { fail(name, error); }
    save();
    return passed;
  };
  try { await run(record); }
  catch (error) { fail('驗收執行錯誤', error); }
  finally {
    report.status = report.failures.length ? 'failed' : 'passed';
    report.finishedAt = new Date().toISOString();
    save();
  }
  return report;
}

module.exports = { runReported };

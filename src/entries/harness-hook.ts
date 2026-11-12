import fs from 'node:fs';
import { evaluateGuard, hookOutput, validateHarnessSpec } from '../core/harness.js';
try {
  const profile: unknown = JSON.parse(fs.readFileSync(new URL('../harness.json', import.meta.url), 'utf8'));
  validateHarnessSpec(profile);
  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
    if (buffer.length > 256 * 1024) throw new Error('Hook input too large');
  }
  console.log(JSON.stringify(hookOutput(evaluateGuard(profile.hooks?.guards ?? [], JSON.parse(buffer)))));
} catch {
  console.log(JSON.stringify(hookOutput({ decision: 'deny', reason: 'Harness hook could not validate its input or configuration' })));
}

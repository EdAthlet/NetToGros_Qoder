/**
 * Load PAYE Lab math (browser UMD) into Node/vitest via vm.
 * package.json has "type":"module", so createRequire on .js does not run the UMD CJS path.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mathPath = resolve(__dirname, '../../../tools/annualised-paye/paye-lab-math.js');

let cached = null;

export function loadPayeLabMath() {
  if (cached) return cached;
  const code = readFileSync(mathPath, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {}
  };
  sandbox.module.exports = sandbox.exports;
  // UMD root fallback
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'paye-lab-math.js' });
  const api = sandbox.module.exports && sandbox.module.exports.computeIpassCard
    ? sandbox.module.exports
    : sandbox.PayeLabMath;
  if (!api || typeof api.computeIpassCard !== 'function') {
    throw new Error('Failed to load PayeLabMath from paye-lab-math.js');
  }
  cached = api;
  return api;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const mobileRoot = process.env.CLICKSHIELD_MOBILE_PATH || '';

const distJs = path.join(packageRoot, 'dist', 'index.js');
const distDts = path.join(packageRoot, 'dist', 'index.d.ts');

if (!fs.existsSync(distJs) || !fs.existsSync(distDts)) {
  console.error('[shared-rules] Missing dist artifacts. Run `npm run build` first.');
  process.exit(1);
}

const generatedJs = fs.readFileSync(distJs, 'utf8');
const generatedDts = fs.readFileSync(distDts, 'utf8');

function withBanner(text, banner) {
  if (text.startsWith('// GENERATED FILE')) return text;
  return `${banner}${text}`;
}

const jsBanner =
  '// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.\n';
const dtsBanner =
  '// GENERATED FILE - sourced from packages/shared-rules/dist/index.d.ts via npm run sync:surfaces.\n';

const targets = [
  {
    path: path.join(repoRoot, 'extension-web', 'lib', 'shared-rules.js'),
    expected: withBanner(generatedJs, jsBanner),
  },
  {
    path: path.join(repoRoot, 'desktop', 'src', 'lib', 'shared-rules.js'),
    expected: withBanner(generatedJs, jsBanner),
  },
  {
    path: path.join(repoRoot, 'desktop', 'src', 'lib', 'shared-rules.d.ts'),
    expected: withBanner(generatedDts, dtsBanner),
  },
];

if (mobileRoot) {
  targets.push(
    {
      path: path.join(mobileRoot, 'src', 'lib', 'shared-rules.js'),
      expected: withBanner(generatedJs, jsBanner),
    },
    {
      path: path.join(mobileRoot, 'src', 'lib', 'shared-rules.d.ts'),
      expected: withBanner(generatedDts, dtsBanner),
    },
  );
}

const mismatches = [];

for (const target of targets) {
  if (!fs.existsSync(target.path)) {
    mismatches.push(`${target.path} (missing)`);
    continue;
  }

  const actual = fs.readFileSync(target.path, 'utf8');
  if (actual !== target.expected) {
    mismatches.push(target.path);
  }
}

if (mismatches.length > 0) {
  console.error('[shared-rules] Surface bundle drift detected:');
  for (const mismatch of mismatches) {
    console.error(` - ${mismatch}`);
  }
  console.error('[shared-rules] Rebuild with `npm run build:surfaces` from packages/shared-rules.');
  process.exit(1);
}

console.log('[shared-rules] Surface bundles are in sync with packages/shared-rules/dist.');

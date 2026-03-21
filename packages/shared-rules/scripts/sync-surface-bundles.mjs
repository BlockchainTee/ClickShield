import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

const distJs = path.join(packageRoot, 'dist', 'index.js');
const distDts = path.join(packageRoot, 'dist', 'index.d.ts');

if (!fs.existsSync(distJs) || !fs.existsSync(distDts)) {
  console.error('[shared-rules] Missing dist artifacts. Run `npm run build` first.');
  process.exit(1);
}

const repoRoot = path.resolve(packageRoot, '..', '..');
const defaultMobileRepo = process.env.CLICKSHIELD_MOBILE_PATH || '';

const targets = [
  {
    source: distJs,
    dest: path.join(repoRoot, 'extension-web', 'lib', 'shared-rules.js'),
    banner:
      '// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.\n',
  },
  {
    source: distJs,
    dest: path.join(repoRoot, 'desktop', 'src', 'lib', 'shared-rules.js'),
    banner:
      '// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.\n',
  },
  {
    source: distDts,
    dest: path.join(repoRoot, 'desktop', 'src', 'lib', 'shared-rules.d.ts'),
    banner:
      '// GENERATED FILE - sourced from packages/shared-rules/dist/index.d.ts via npm run sync:surfaces.\n',
  },
];

if (defaultMobileRepo) {
  targets.push(
    {
      source: distJs,
      dest: path.join(defaultMobileRepo, 'src', 'lib', 'shared-rules.js'),
      banner:
        '// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.\n',
    },
    {
      source: distDts,
      dest: path.join(defaultMobileRepo, 'src', 'lib', 'shared-rules.d.ts'),
      banner:
        '// GENERATED FILE - sourced from packages/shared-rules/dist/index.d.ts via npm run sync:surfaces.\n',
    },
  );
}

for (const target of targets) {
  const sourceText = fs.readFileSync(target.source, 'utf8');
  const withBanner = sourceText.startsWith('// GENERATED FILE')
    ? sourceText
    : `${target.banner}${sourceText}`;

  fs.mkdirSync(path.dirname(target.dest), { recursive: true });
  fs.writeFileSync(target.dest, withBanner);
  console.log(`[shared-rules] synced ${path.relative(repoRoot, target.dest)}`);
}

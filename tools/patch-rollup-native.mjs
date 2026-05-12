import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const nativePath = path.resolve(
  "node_modules/.pnpm/rollup@4.60.2/node_modules/rollup/dist/native.js",
);
const lightningCssPath = path.resolve(
  "node_modules/.pnpm/lightningcss@1.30.1/node_modules/lightningcss/node/index.js",
);

if (existsSync(nativePath)) {
  const current = readFileSync(nativePath, "utf8");
  const marker = "codex wasm fallback";

  if (!current.includes(marker)) {
    const patched = `const { existsSync } = require('node:fs');
const path = require('node:path');
const { platform, arch, report } = require('node:process');
const { spawnSync } = require('node:child_process');

const getReportHeader = () => {
\ttry {
\t\tif (platform !== 'win32') {
\t\t\treturn report.getReport().header;
\t\t}

\t\tconst script =
\t\t\t"console.log(JSON.stringify(require('node:process').report.getReport().header));";
\t\tconst child = spawnSync(process.execPath, ['-p', script], {
\t\t\tencoding: 'utf8',
\t\t\ttimeout: 3000,
\t\t\twindowsHide: true
\t\t});

\t\tif (child.status !== 0) {
\t\t\treturn null;
\t\t}

\t\tconst stdout = child.stdout?.replace(/undefined\\r?\\n?$/, '').trim();
\t\tif (!stdout) {
\t\t\treturn null;
\t\t}

\t\treturn JSON.parse(stdout);
\t} catch {
\t\treturn null;
\t}
};

let reportHeader;
const isMingw32 = () => {
\treportHeader ??= getReportHeader();
\treturn reportHeader?.osName?.startsWith('MINGW32_NT') ?? false;
};

const isMusl = () => {
\treportHeader ??= getReportHeader();
\treturn reportHeader ? !reportHeader.glibcVersionRuntime : false;
};

const bindingsByPlatformAndArch = {
\tandroid: {
\t\tarm: { base: 'android-arm-eabi' },
\t\tarm64: { base: 'android-arm64' }
\t},
\tdarwin: {
\t\tarm64: { base: 'darwin-arm64' },
\t\tx64: { base: 'darwin-x64' }
\t},
\tfreebsd: {
\t\tarm64: { base: 'freebsd-arm64' },
\t\tx64: { base: 'freebsd-x64' }
\t},
\tlinux: {
\t\tarm: { base: 'linux-arm-gnueabihf', musl: 'linux-arm-musleabihf' },
\t\tarm64: { base: 'linux-arm64-gnu', musl: 'linux-arm64-musl' },
\t\tloong64: { base: 'linux-loong64-gnu', musl: 'linux-loong64-musl' },
\t\tppc64: { base: 'linux-ppc64-gnu', musl: 'linux-ppc64-musl' },
\t\triscv64: { base: 'linux-riscv64-gnu', musl: 'linux-riscv64-musl' },
\t\ts390x: { base: 'linux-s390x-gnu', musl: null },
\t\tx64: { base: 'linux-x64-gnu', musl: 'linux-x64-musl' }
\t},
\topenbsd: {
\t\tx64: { base: 'openbsd-x64' }
\t},
\topenharmony: {
\t\tarm64: { base: 'openharmony-arm64' }
\t},
\twin32: {
\t\tarm64: { base: 'win32-arm64-msvc' },
\t\tia32: { base: 'win32-ia32-msvc' },
\t\tx64: {
\t\t\tbase: isMingw32() ? 'win32-x64-gnu' : 'win32-x64-msvc'
\t\t}
\t}
};

const packageBase = getPackageBase();
const localName = \`./rollup.\${packageBase}.node\`;

function getPackageBase() {
\tconst imported = bindingsByPlatformAndArch[platform]?.[arch];
\tif (!imported) {
\t\tthrow new Error(
\t\t\t\`Unsupported Rollup native platform "\${platform}" arch "\${arch}".\`
\t\t);
\t}
\tif ('musl' in imported && isMusl()) {
\t\treturn imported.musl ?? imported.base;
\t}
\treturn imported.base;
}

const tryRequire = id => {
\ttry {
\t\treturn require(id);
\t} catch {
\t\treturn null;
\t}
};

let bindings =
\ttryRequire(existsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`);

if (!bindings) {
\t// codex wasm fallback
\tbindings = require('@rollup/wasm-node/dist/native.js');
}

const { parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 } = bindings;

module.exports.parse = parse;
module.exports.parseAsync = parseAsync;
module.exports.xxhashBase64Url = xxhashBase64Url;
module.exports.xxhashBase36 = xxhashBase36;
module.exports.xxhashBase16 = xxhashBase16;
`;

    writeFileSync(nativePath, patched);
  }
}

if (existsSync(lightningCssPath)) {
  const currentLightning = readFileSync(lightningCssPath, "utf8");
  const lightningMarker = "codex workspace fallback";

  if (!currentLightning.includes(lightningMarker)) {
    const patchedLightning = `const { createRequire } = require('node:module');
const requireFromCwd = createRequire(process.cwd() + '/package.json');

let parts = [process.platform, process.arch];
if (process.platform === 'linux') {
  const { MUSL, familySync } = require('detect-libc');
  const family = familySync();
  if (family === MUSL) {
    parts.push('musl');
  } else if (process.arch === 'arm') {
    parts.push('gnueabihf');
  } else {
    parts.push('gnu');
  }
} else if (process.platform === 'win32') {
  parts.push('msvc');
}

const packageName = \`lightningcss-\${parts.join('-')}\`;

if (process.env.CSS_TRANSFORMER_WASM) {
  module.exports = require('../pkg');
} else {
  try {
    module.exports = require(packageName);
  } catch (err) {
    try {
      // codex workspace fallback
      module.exports = requireFromCwd(packageName);
    } catch {
      module.exports = require(\`../lightningcss.\${parts.join('-')}.node\`);
    }
  }
}

module.exports.browserslistToTargets = require('./browserslistToTargets');
module.exports.composeVisitors = require('./composeVisitors');
module.exports.Features = require('./flags').Features;
`;

    writeFileSync(lightningCssPath, patchedLightning);
  }
}

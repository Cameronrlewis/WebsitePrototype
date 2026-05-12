import fs from "node:fs/promises";
import path from "node:path";

const [, , inputArg, outputArg] = process.argv;

if (!inputArg || !outputArg) {
  console.error("Usage: node tools/flatten-vrml.mjs <input.wrl> <output.wrl>");
  process.exit(1);
}

const headerPattern = /^\uFEFF?#VRML[^\n]*\n?/;
const defPattern = /\bDEF\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const defOrUsePattern = /\b(DEF|USE)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const inlinePattern = /Inline\s*\{\s*url\s+(?:\[\s*)?"([^"]+)"(?:\s+"[^"]+")*(?:\s*\])?\s*\}/g;
const trailingDotNumberPattern = /(?<![A-Za-z0-9_])(-?\d+)\.(?=(?:\s|,|\]|\}|$))/g;

function namespaceVrml(source, prefix) {
  const nameMap = new Map();

  for (const match of source.matchAll(defPattern)) {
    const name = match[1];
    if (!nameMap.has(name)) {
      nameMap.set(name, `${prefix}_${name}`);
    }
  }

  return source.replace(defOrUsePattern, (fullMatch, keyword, name) => {
    const renamed = nameMap.get(name);
    return renamed ? `${keyword} ${renamed}` : fullMatch;
  });
}

function normalizeVrmlNumbers(source) {
  return source.replace(trailingDotNumberPattern, "$1.0");
}

async function flattenFile(filePath, prefix) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);

  let source = await fs.readFile(absolutePath, "utf8");
  source = source.replace(headerPattern, "").trim();
  source = normalizeVrmlNumbers(source);
  source = namespaceVrml(source, prefix);

  let result = "";
  let lastIndex = 0;
  let childIndex = 0;

  for (const match of source.matchAll(inlinePattern)) {
    const relativeUrl = match[1];
    const childPath = path.resolve(directory, relativeUrl);
    const childPrefix = `${prefix}_inline${++childIndex}`;
    const childContent = await flattenFile(childPath, childPrefix);

    result += source.slice(lastIndex, match.index);
    result += `\n${childContent}\n`;
    lastIndex = match.index + match[0].length;
  }

  result += source.slice(lastIndex);
  return result.trim();
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const flattened = await flattenFile(inputPath, "brick_buck");

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `#VRML V2.0 utf8\n${flattened}\n`, "utf8");

console.log(`Flattened VRML written to ${outputPath}`);

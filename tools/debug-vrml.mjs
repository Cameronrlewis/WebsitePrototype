import fs from "node:fs/promises";
import vm from "node:vm";
import * as ThreeModule from "three";

const [, , vrmlPath] = process.argv;

if (!vrmlPath) {
  console.error("Usage: node tools/debug-vrml.mjs <file.wrl>");
  process.exit(1);
}

const [loaderSource, chevrotainSource, vrmlSource] = await Promise.all([
  fs.readFile("/tmp/VRMLLoader.js", "utf8"),
  fs.readFile("/tmp/chevrotain.min.js", "utf8"),
  fs.readFile(vrmlPath, "utf8"),
]);

const sandbox = {
  THREE: { ...ThreeModule },
  console: {
    log: (...args) => console.log(...args),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => {
      console.error("VRML console.error:");
      for (const arg of args) {
        console.error(typeof arg === "string" ? arg : JSON.stringify(arg, null, 2));
      }
    },
  },
};

sandbox.global = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);
vm.runInContext(chevrotainSource, context, { filename: "chevrotain.min.js" });
vm.runInContext(loaderSource, context, { filename: "VRMLLoader.js" });

try {
  const loader = new context.THREE.VRMLLoader();
  const scene = loader.parse(vrmlSource, "");
  console.log("Parsed successfully.", Boolean(scene));
} catch (error) {
  console.error("Parse failed:", error instanceof Error ? error.message : error);
  process.exit(2);
}

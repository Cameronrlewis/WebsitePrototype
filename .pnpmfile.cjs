function readPackage(pkg) {
  // @types/react-dom declares "@types/react": "*" as a plain dependency, which
  // lets pnpm resolve it to a different (newer) @types/react than the one we
  // pin directly, causing duplicate React type definitions and spurious
  // TS2786 "cannot be used as a JSX component" errors under `tsc --build`.
  // Pin it to match our direct devDependency so there is only one copy.
  if (pkg.name === "@types/react-dom" && pkg.dependencies && pkg.dependencies["@types/react"]) {
    pkg.dependencies["@types/react"] = "18.3.12";
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};

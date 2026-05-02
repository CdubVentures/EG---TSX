// WHY: invalidation-core.mjs imports node:fs and uses
// new URL(path, import.meta.url) to read cache-cdn.json.
// In the browser IIFE bundle import.meta.url is empty, so
// new URL() throws "Invalid URL". The shim catches that and
// returns a safe empty contract so getFullSiteContractPaths()
// returns [] instead of crashing the bundle.
export function readFileSync() { return '{"targets":[]}'; }
export default { readFileSync };

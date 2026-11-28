// Scratch: make a bare "three" import resolve to the vendored copy, so the DOM
// shim and main.js share one instance. (Node keys module identity by URL, so
// two paths to the same bytes are two different classes.)
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const vendor = pathToFileURL(resolvePath(here, "../vendor/three/three.module.js")).href;
export async function resolve(specifier, context, next) {
  if (specifier === "three") return { url: vendor, shortCircuit: true };
  return next(specifier, context);
}

// Build artifact, not downloaded code: serve the worker from the installed, locked SDK.
import { copyFileSync, mkdirSync } from "node:fs";
const directory = new URL("../public/vendor/", import.meta.url);
mkdirSync(directory, { recursive: true });
copyFileSync(new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url), new URL("maplibre-gl-worker.mjs", directory));
console.log("Prepared local MapLibre web worker.");

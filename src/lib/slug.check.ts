import assert from "node:assert/strict";

import { slugify } from "./slug";

assert.equal(slugify("Notebooks Gamer"), "notebooks-gamer");
assert.equal(slugify("Cámaras & Drones"), "camaras-drones");
assert.equal(slugify("  --Audio--  "), "audio");

console.log("slugify: ok");

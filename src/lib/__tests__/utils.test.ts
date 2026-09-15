import assert from "node:assert/strict";
import { test } from "node:test";

import { cn } from "../utils.ts";

test("cn combina clases sin conflicto", () => {
  assert.equal(cn("a", "b"), "a b");
});

test("cn resuelve un conflicto de Tailwind quedándose con la última clase", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
});

test("cn descarta valores falsy (false, null, undefined)", () => {
  assert.equal(cn("a", false, null, undefined, "b"), "a b");
});

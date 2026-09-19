import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveActiveHref } from "../resolve-active-href.ts";

const HREFS = ["/admin", "/admin/products", "/admin/users"];

test("resolveActiveHref: '/admin' activa solo '/admin', no 'Productos' (AC9)", () => {
  assert.equal(resolveActiveHref("/admin", HREFS), "/admin");
});

test("resolveActiveHref: '/admin/products' activa 'Productos', no 'Dashboard'", () => {
  assert.equal(resolveActiveHref("/admin/products", HREFS), "/admin/products");
});

test("resolveActiveHref: subruta sigue activando el padre", () => {
  assert.equal(
    resolveActiveHref("/admin/products/abc-123", HREFS),
    "/admin/products",
  );
});

test("resolveActiveHref: prefijo sin frontera de segmento no activa el hermano", () => {
  assert.equal(resolveActiveHref("/admin/products-archive", HREFS), "/admin");
});

test("resolveActiveHref: ninguna coincidencia devuelve undefined sin explotar", () => {
  assert.equal(resolveActiveHref("/tienda", HREFS), undefined);
});

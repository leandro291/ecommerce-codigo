import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogHref } from "../catalog-href.ts";

test("catalogHref sin filtros da /products", () => {
  assert.equal(catalogHref({}), "/products");
});

test("catalogHref incluye category y search cuando vienen", () => {
  assert.equal(
    catalogHref({ category: "laptops", search: "gamer" }),
    "/products?category=laptops&search=gamer",
  );
});

test('catalogHref omite sort cuando es "relevance"', () => {
  assert.equal(catalogHref({ sort: "relevance" }), "/products");
});

test('catalogHref incluye sort cuando no es "relevance"', () => {
  assert.equal(catalogHref({ sort: "price-asc" }), "/products?sort=price-asc");
});

test("catalogHref omite page cuando es 1 o no viene, y la incluye cuando es mayor a 1", () => {
  assert.equal(catalogHref({}, 1), "/products");
  assert.equal(catalogHref({}, 2), "/products?page=2");
});

test("catalogHref escapa la búsqueda para no romper la query", () => {
  assert.equal(catalogHref({ search: '27" qhd&x=1' }), "/products?search=27%22+qhd%26x%3D1");
});

test("catalogHref conserva todos los filtros y agrega page al final", () => {
  assert.equal(
    catalogHref({ category: "notebooks", search: "aero", sort: "price-desc" }, 2),
    "/products?category=notebooks&search=aero&sort=price-desc&page=2",
  );
});

test("catalogHref omite page 0 o negativa", () => {
  assert.equal(catalogHref({}, 0), "/products");
  assert.equal(catalogHref({}, -3), "/products");
});

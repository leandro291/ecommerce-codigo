import assert from "node:assert/strict";

import { catalogHref } from "./catalog-href";

// Sin filtros y con los defaults puestos, la URL es la limpia.
assert.equal(catalogHref({}), "/products");
assert.equal(catalogHref({ sort: "relevance" }), "/products");

// Cambiar un filtro no puede borrar los otros: es el bug que justifica el helper.
assert.equal(
  catalogHref({ category: "notebooks", search: "aero", sort: "price-asc" }),
  "/products?category=notebooks&search=aero&sort=price-asc",
);
assert.equal(
  catalogHref({ search: "aero", sort: "relevance" }),
  "/products?search=aero",
);

// La búsqueda viaja escapada, no rompe la query.
assert.equal(catalogHref({ search: "27\" qhd" }), "/products?search=27%22+qhd");

// `page` es el segundo argumento y solo se escribe a partir de la 2: `/products`
// y `/products?page=1` son la misma vista y comparten una sola URL.
assert.equal(catalogHref({}, 1), "/products");
assert.equal(catalogHref({}, undefined), "/products");
assert.equal(catalogHref({}, 3), "/products?page=3");
assert.equal(
  catalogHref({ category: "notebooks", sort: "price-asc" }, 2),
  "/products?category=notebooks&sort=price-asc&page=2",
);

// Sin el segundo argumento la URL nunca lleva `page`: es lo que hace que cambiar
// de categoría, de orden o de búsqueda vuelva a la página 1 sin tocar los chips.
assert.equal(
  catalogHref({ category: "notebooks", search: "aero" }),
  "/products?category=notebooks&search=aero",
);

console.log("catalog-href: ok");

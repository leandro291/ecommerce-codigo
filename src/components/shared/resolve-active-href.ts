// Gana el match más largo: cubre la ruta índice ("/admin" no debe resaltarse
// como prefijo de todo el panel) y la frontera de segmento ("/admin/products"
// no debe resaltarse por "/admin/products-archive"). Sigue resaltando
// subrutas ("/admin/products/123" → "/admin/products").
export function resolveActiveHref(
  pathname: string,
  hrefs: readonly string[],
): string | undefined {
  const matches = hrefs.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return matches.toSorted((a, b) => b.length - a.length)[0];
}

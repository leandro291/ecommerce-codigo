import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";

config({ path: ".env.local" });

// Precios en céntimos, como en la base: 249900 son S/ 2,499.00. Todos por
// debajo del máximo que acepta el schema Zod (S/ 1,000,000.00).
const productRows = [
  {
    categorySlug: "notebooks",
    name: "Notebook Lenovo IdeaPad 3",
    slug: "notebook-lenovo-ideapad-3",
    description:
      "Ryzen 5 5500U, 16 GB de RAM y SSD NVMe de 512 GB. Pantalla Full HD de 15,6\" con marcos finos, teclado numérico y hasta 7 h de batería. Lista para estudiar, trabajar y editar sin esperas.",
    // Foto real del producto (no genérica: la compartida era una MacBook por
    // error). Wikimedia Commons, CC BY-SA 4.0.
    // https://commons.wikimedia.org/wiki/File:Lenovo_Ideapad_3_20240401_121754.jpg
    imageUrl: "/products/notebook-lenovo-ideapad-3.webp",
    sku: "NB-LEN-IP3",
    price: 249900,
    compareAtPrice: 289900,
    stock: 12,
    // Único destacado: es el que gana el hero del home. `listPublic` ordena por
    // `isFeatured` y luego por nombre, así que con dos destacados el hero salía
    // por alfabético (ganaba el monitor). Este es el de mayor valor percibido
    // del catálogo y el único con imagen + precio tachado, que es justo lo que
    // el hero del diseño necesita para renderizar completo.
    isFeatured: true,
  },
  {
    categorySlug: "notebooks",
    name: "Notebook Asus VivoBook 15",
    slug: "notebook-asus-vivobook-15",
    description:
      "Intel Core i7 de 12ª generación, 16 GB DDR4 y SSD NVMe de 512 GB. Panel Full HD antirreflejo, lector de huella y 1,7 kg para llevarla a todos lados.",
    // Foto real del producto: Wikimedia Commons, CC0.
    // https://commons.wikimedia.org/wiki/File:Asus_Vivobook_15.jpg
    imageUrl: "/products/notebook-asus-vivobook-15.webp",
    sku: "NB-ASU-VB15",
    price: 319900,
    stock: 7,
  },
  {
    categorySlug: "notebooks",
    name: "Notebook HP Pavilion 15",
    slug: "notebook-hp-pavilion-15",
    description:
      "Intel Core i5 de 13ª generación, 8 GB de RAM y SSD NVMe de 512 GB. Pantalla Full HD de 15,6\" con audio Bang & Olufsen y teclado numérico.",
    imageUrl: "/products/thumb-laptop.webp",
    sku: "NB-HP-PAV15",
    price: 289900,
    stock: 15,
  },
  {
    categorySlug: "notebooks",
    name: "Notebook Dell Inspiron 15",
    slug: "notebook-dell-inspiron-15",
    description:
      "Intel Core i5 de 12ª generación, 8 GB DDR4 y SSD de 256 GB. Chasis de aluminio, lector de huella y hasta 10 h de batería.",
    imageUrl: "/products/thumb-laptop.webp",
    sku: "NB-DEL-INS15",
    price: 279900,
    stock: 9,
  },
  {
    categorySlug: "notebooks",
    name: "Notebook Acer Aspire 5",
    slug: "notebook-acer-aspire-5",
    description:
      "AMD Ryzen 5 7530U, 16 GB de RAM y SSD NVMe de 512 GB. Panel Full HD IPS y puerto Ethernet integrado, ideal para uso diario y estudio.",
    imageUrl: "/products/thumb-laptop.webp",
    sku: "NB-ACE-A5",
    price: 259900,
    stock: 11,
  },
  {
    categorySlug: "monitores",
    name: "Monitor Samsung 24 165Hz",
    slug: "monitor-samsung-24-165hz",
    description:
      "Panel VA de 24\" Full HD a 165 Hz con 1 ms de respuesta y FreeSync Premium. HDMI 2.0, DisplayPort y base regulable en altura.",
    imageUrl: "/products/monitor.webp",
    sku: "MON-SAM-24",
    price: 74900,
    compareAtPrice: 89900,
    stock: 20,
  },
  {
    categorySlug: "monitores",
    name: "Monitor LG UltraWide 29",
    slug: "monitor-lg-ultrawide-29",
    description:
      "29\" ultrapanorámico 21:9 con panel IPS, 99 % de sRGB y HDR10. Dos fuentes en pantalla a la vez: ideal para editar y programar.",
    imageUrl: "/products/monitor.webp",
    sku: "MON-LG-UW29",
    price: 119900,
    compareAtPrice: 139900,
    stock: 5,
  },
  {
    categorySlug: "monitores",
    name: "Monitor AOC 27 144Hz",
    slug: "monitor-aoc-27-144hz",
    description:
      "27\" Full HD IPS a 144 Hz con 1 ms de respuesta y FreeSync. Bordes finos en tres lados y entrada HDMI + DisplayPort.",
    imageUrl: "/products/monitor.webp",
    sku: "MON-AOC-27",
    price: 89900,
    stock: 14,
  },
  {
    categorySlug: "monitores",
    name: "Monitor ViewSonic 22 FHD",
    slug: "monitor-viewsonic-22-fhd",
    description:
      "22\" Full HD con panel VA, tecnología de baja luz azul y base ultradelgada. Pensado para oficina y estudio.",
    imageUrl: "/products/monitor.webp",
    sku: "MON-VS-22",
    price: 49900,
    stock: 22,
  },
  {
    categorySlug: "monitores",
    name: "Monitor Dell UltraSharp 24",
    slug: "monitor-dell-ultrasharp-24",
    description:
      "24\" Full HD IPS con 99 % de sRGB y ajuste de altura, giro e inclinación. El elegido para diseño y color preciso.",
    imageUrl: "/products/monitor.webp",
    sku: "MON-DEL-US24",
    price: 99900,
    compareAtPrice: 114900,
    stock: 8,
  },
  {
    categorySlug: "perifericos",
    name: "Teclado Mecánico Redragon Kumara",
    slug: "teclado-mecanico-redragon-kumara",
    description:
      "Formato TKL con switches rojos, retroiluminación RGB de 18 efectos y keycaps de doble inyección. Estructura de aluminio y cable trenzado desmontable.",
    imageUrl: "/products/thumb-keyboard.webp",
    sku: "PER-RED-KUM",
    price: 14900,
    stock: 35,
  },
  {
    categorySlug: "perifericos",
    name: "Mouse Logitech G305",
    slug: "mouse-logitech-g305",
    description:
      "Sensor HERO de 12.000 DPI y conexión LIGHTSPEED inalámbrica con 1 ms de latencia. Hasta 250 h con una pila AA y 6 botones programables.",
    // Foto real del producto (no genérica): Wikimedia Commons, CC BY-SA 4.0.
    // https://commons.wikimedia.org/wiki/File:Une_souris_Logitech_G305..jpg
    imageUrl: "/products/mouse-logitech-g305.webp",
    sku: "PER-LOG-G305",
    price: 17900,
    stock: 28,
  },
  {
    categorySlug: "perifericos",
    name: "Teclado Mecánico HyperX Alloy Origins",
    slug: "teclado-mecanico-hyperx-alloy-origins",
    description:
      "Formato TKL con switches HyperX Red, cuerpo de aluminio aeroespacial y retroiluminación RGB por tecla, totalmente programable.",
    imageUrl: "/products/thumb-keyboard.webp",
    sku: "PER-HXK-AO",
    price: 34900,
    stock: 18,
  },
  {
    categorySlug: "perifericos",
    name: "Mouse Razer DeathAdder V2",
    slug: "mouse-razer-deathadder-v2",
    description:
      "Sensor óptico de 20.000 DPI, switches ópticos de 70 millones de clics y forma ergonómica para diestros. Cable trenzado Speedflex.",
    imageUrl: "/products/mouse.webp",
    sku: "PER-RAZ-DA2",
    price: 24900,
    stock: 25,
  },
  {
    categorySlug: "perifericos",
    name: "Mouse Logitech MX Master 3S",
    slug: "mouse-logitech-mx-master-3s",
    description:
      "Sensor de 8.000 DPI, clic silencioso y scroll MagSpeed. Conexión Bluetooth o receptor USB, hasta 3 dispositivos emparejados.",
    // Foto real del producto (no genérica): Wikimedia Commons, CC BY 4.0.
    // https://commons.wikimedia.org/wiki/File:Logitech_MX_Master_3S_HS12.jpg
    imageUrl: "/products/mouse-logitech-mx-master-3s.webp",
    sku: "PER-LOG-MX3S",
    price: 39900,
    stock: 16,
  },
  {
    categorySlug: "componentes",
    name: "SSD Kingston NV2 1TB",
    slug: "ssd-kingston-nv2-1tb",
    description:
      "NVMe PCIe 4.0 M.2 2280 de 1 TB: hasta 3.500 MB/s de lectura y 2.100 MB/s de escritura. Entra directo en el slot M.2, sin cables ni adaptadores.",
    // Sin imagen a propósito: ejercita el fallback de `ProductCard` en la landing.
    sku: "COM-KIN-NV2",
    price: 29900,
    stock: 40,
  },
  {
    categorySlug: "componentes",
    name: "RAM Kingston Fury Beast 16GB DDR4",
    slug: "ram-kingston-fury-beast-16gb-ddr4",
    description:
      "Módulo de 16 GB (1x16) DDR4 a 3200 MHz con disipador de aluminio. Compatible con Intel XMP para overclock plug-and-play.",
    // Sin imagen: el pool de fotos no tiene una pieza de memoria (mismo criterio que el SSD).
    sku: "COM-KIN-FB16",
    price: 21900,
    stock: 30,
  },
  {
    categorySlug: "componentes",
    name: "Fuente EVGA 600W 80+",
    slug: "fuente-evga-600w-80plus",
    description:
      "600 W certificados 80 Plus, ventilador de 120 mm y protecciones OVP/UVP/SCP. Conectores modulares para PCIe y SATA.",
    sku: "COM-EVG-600W",
    price: 26900,
    stock: 20,
  },
  {
    categorySlug: "componentes",
    name: "Placa de Video Gigabyte GTX 1650",
    slug: "placa-de-video-gigabyte-gtx-1650",
    description:
      "4 GB GDDR6, doble ventilador y salida HDMI + DisplayPort. La entrada ideal a 1080p sin conector de alimentación extra.",
    sku: "COM-GIG-1650",
    price: 64900,
    compareAtPrice: 74900,
    stock: 6,
  },
  {
    categorySlug: "componentes",
    name: "Disco Duro Seagate Barracuda 2TB",
    slug: "disco-duro-seagate-barracuda-2tb",
    description:
      "HDD SATA III de 2 TB a 7200 RPM con 256 MB de caché. Almacenamiento masivo para respaldos y librerías multimedia.",
    sku: "COM-SEA-BC2TB",
    price: 19900,
    stock: 45,
  },
  {
    categorySlug: "audio",
    name: "Auriculares HyperX Cloud II",
    slug: "auriculares-hyperx-cloud-ii",
    description:
      "Drivers de 53 mm con sonido envolvente 7.1 virtual, micrófono desmontable con cancelación de ruido y almohadillas de memory foam.",
    imageUrl: "/products/headset.webp",
    // Sin SKU a propósito: varios NULL no colisionan en el índice único.
    sku: null,
    price: 37900,
    stock: 0,
    isActive: false,
  },
  {
    categorySlug: "audio",
    name: "Auriculares Logitech G435 LightSpeed",
    slug: "auriculares-logitech-g435-lightspeed",
    description:
      "Inalámbricos ultralivianos con LIGHTSPEED y Bluetooth simultáneos, hasta 18 h de batería y sonido espacial en juegos compatibles.",
    imageUrl: "/products/headset.webp",
    sku: "AUD-LOG-G435",
    price: 29900,
    stock: 24,
  },
  {
    categorySlug: "audio",
    name: "Audífonos Sony WH-CH520",
    slug: "audifonos-sony-wh-ch520",
    description:
      "Diadema inalámbrica con hasta 50 h de batería, carga rápida y modo de sonido ambiental. Livianos para uso todo el día.",
    imageUrl: "/products/headset.webp",
    sku: "AUD-SNY-CH520",
    price: 24900,
    stock: 19,
  },
  {
    categorySlug: "audio",
    name: "Auriculares JBL Tune 510BT",
    slug: "auriculares-jbl-tune-510bt",
    description:
      "Bluetooth 5.0 con sonido JBL Pure Bass y hasta 40 h de batería. Plegables, con controles multifunción en la oreja.",
    imageUrl: "/products/headset.webp",
    sku: "AUD-JBL-510",
    price: 17900,
    stock: 33,
  },
  {
    categorySlug: "audio",
    name: "Headset Corsair HS55",
    slug: "headset-corsair-hs55",
    description:
      "Diadema de memory foam con micrófono omnidireccional desmontable y sonido estéreo de alta definición. Compatible con PC y consolas.",
    imageUrl: "/products/headset.webp",
    sku: "AUD-COR-HS55",
    price: 22900,
    stock: 21,
  },
];

async function seed() {
  // El cliente se importa después de cargar .env.local: `db` lee DATABASE_URL al evaluarse.
  const { db } = await import("./index");
  const { categories, products } = await import("./schema");

  const categoryRows = [
    {
      name: "Notebooks",
      slug: "notebooks",
      description: "Portátiles para estudiar, trabajar y jugar.",
      position: 1,
      imageUrl: "/products/thumb-laptop.webp",
    },
    {
      name: "Monitores",
      slug: "monitores",
      description: "Paneles Full HD, 165 Hz y ultrapanorámicos.",
      position: 2,
      imageUrl: "/products/monitor.webp",
    },
    {
      name: "Periféricos",
      slug: "perifericos",
      description: "Teclados, mouses y accesorios de escritorio.",
      position: 3,
      imageUrl: "/products/thumb-keyboard.webp",
    },
    {
      name: "Componentes",
      slug: "componentes",
      description: "Almacenamiento y partes para armar tu PC.",
      position: 4,
      imageUrl: "/products/mouse.webp",
    },
    {
      name: "Audio",
      slug: "audio",
      description: "Auriculares, parlantes y micrófonos.",
      position: 5,
      isActive: false,
      imageUrl: "/products/headset.webp",
    },
  ];

  // Solo las columnas de vitrina se pisan en conflicto: las filas ya sembradas
  // las tienen NULL y la landing las necesita. El resto (nombre, posición,
  // activo) es dato vivo del admin y no se toca.
  const seededCategories = await db
    .insert(categories)
    .values(categoryRows)
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        description: sql`excluded.description`,
        imageUrl: sql`excluded.image_url`,
      },
    })
    .returning({ slug: categories.slug });

  console.log(
    `seed: ${seededCategories.length} categorías sembradas de ${categoryRows.length} candidatas`,
  );

  // Los productos necesitan el id real de su categoría, exista de esta corrida o de una anterior.
  const existingCategories = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const categoryIdBySlug = new Map(
    existingCategories.map((category) => [category.slug, category.id]),
  );

  const values = productRows.map(({ categorySlug, ...product }) => {
    const categoryId = categoryIdBySlug.get(categorySlug);

    if (!categoryId) {
      throw new Error(`seed: falta la categoría "${categorySlug}"`);
    }

    return { ...product, categoryId };
  });

  const seededProducts = await db
    .insert(products)
    .values(values)
    // `is_featured` entra acá porque el hero del home depende de que haya uno
    // solo: si no se pisa, un destacado viejo de una corrida anterior compite
    // por el hero y el resultado deja de ser determinista.
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        description: sql`excluded.description`,
        // `price` y `compare_at_price` van juntos: pisar solo el segundo deja
        // un precio tachado por debajo del vigente.
        price: sql`excluded.price`,
        compareAtPrice: sql`excluded.compare_at_price`,
        imageUrl: sql`excluded.image_url`,
        isFeatured: sql`excluded.is_featured`,
      },
    })
    .returning({ slug: products.slug });

  console.log(
    `seed: ${seededProducts.length} productos sembrados de ${productRows.length} candidatos`,
  );

  await seedRbac();
}

// Permisos, roles y matriz: dato semilla, no configuración viva. Idempotente vía
// `onConflictDoNothing`; ojo que por eso siembra pero no revoca (spec 004 §10).
async function seedRbac() {
  const { db } = await import("./index");
  const { permissions, rolePermissions, roles, users } = await import(
    "./schema"
  );
  const { PERMISSIONS, ROLES, permissionCodesForRole } = await import(
    "@/lib/permissions"
  );
  const { assignRole } = await import("@/server/repositories/user.repository");

  // `resource` y `action` se derivan del código: nunca pueden divergir de él.
  const permissionRows = PERMISSIONS.map(({ code, description }) => {
    const [resource, action] = code.split(".");

    return { code, resource, action, description };
  });

  const insertedPermissions = await db
    .insert(permissions)
    .values(permissionRows)
    .onConflictDoNothing({ target: permissions.code })
    .returning({ code: permissions.code });

  console.log(
    `seed: ${insertedPermissions.length} permisos nuevos de ${permissionRows.length} candidatos`,
  );

  const roleRows = ROLES.map((role) => ({ ...role, isSystem: true }));

  const insertedRoles = await db
    .insert(roles)
    .values(roleRows)
    .onConflictDoNothing({ target: roles.slug })
    .returning({ slug: roles.slug });

  console.log(
    `seed: ${insertedRoles.length} roles nuevos de ${roleRows.length} candidatos`,
  );

  // Los ids reales, existan de esta corrida o de una anterior.
  const permissionIdByCode = new Map(
    (await db.select({ id: permissions.id, code: permissions.code }).from(permissions)).map(
      (permission) => [permission.code, permission.id],
    ),
  );
  const roleIdBySlug = new Map(
    (await db.select({ id: roles.id, slug: roles.slug }).from(roles)).map(
      (role) => [role.slug, role.id],
    ),
  );

  const matrixRows = ROLES.flatMap((role) => {
    const roleId = roleIdBySlug.get(role.slug);

    if (!roleId) throw new Error(`seed: falta el rol "${role.slug}"`);

    return permissionCodesForRole(role.slug).map((code) => {
      const permissionId = permissionIdByCode.get(code);

      if (!permissionId) throw new Error(`seed: falta el permiso "${code}"`);

      return { roleId, permissionId };
    });
  });

  const insertedMatrix = await db
    .insert(rolePermissions)
    .values(matrixRows)
    .onConflictDoNothing()
    .returning({ roleId: rolePermissions.roleId });

  console.log(
    `seed: ${insertedMatrix.length} filas nuevas de matriz rol→permiso de ${matrixRows.length} candidatas`,
  );

  const clerkId = process.env.SUPER_ADMIN_CLERK_ID;
  const email = process.env.SUPER_ADMIN_EMAIL;

  if (!clerkId && !email) {
    console.log(
      "seed: sin super admin configurado (SUPER_ADMIN_CLERK_ID / SUPER_ADMIN_EMAIL)",
    );
    return;
  }

  let superAdmin;

  if (clerkId && email) {
    [superAdmin] = await db
      .insert(users)
      .values({ clerkId, email })
      .onConflictDoUpdate({ target: users.clerkId, set: { email } })
      .returning();
  } else {
    // Con una sola env no hay datos para crear la fila: solo se promueve si ya existe.
    [superAdmin] = await db
      .select()
      .from(users)
      .where(clerkId ? eq(users.clerkId, clerkId) : eq(users.email, email!))
      .limit(1);

    if (!superAdmin) {
      console.log(
        "seed: super admin incompleto (falta una env) y sin fila previa en users; no se promueve",
      );
      return;
    }
  }

  const superAdminRoleId = roleIdBySlug.get("super_admin");

  if (!superAdminRoleId) throw new Error('seed: falta el rol "super_admin"');

  await db.transaction((tx) =>
    assignRole(tx, { userId: superAdmin.id, roleId: superAdminRoleId }),
  );

  console.log(`seed: ${superAdmin.email} promovido a super_admin`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

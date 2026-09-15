import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { ProductsTable } from "@/modules/products/components/products-table";

export const metadata = {
  title: "Productos | Administración",
};

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo con precios, stock y categoría.
          </p>
        </div>

        <ProductFormDialog trigger={<Button>Nuevo producto</Button>} />
      </div>

      <ProductsTable />
    </div>
  );
}

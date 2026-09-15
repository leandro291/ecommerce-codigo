import { Button } from "@/components/ui/button";
import { CategoriesTable } from "@/modules/categories/components/categories-table";
import { CategoryFormDialog } from "@/modules/categories/components/category-form-dialog";

export const metadata = {
  title: "Categorías | Administración",
};

export default function AdminCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Taxonomía del catálogo de productos.
          </p>
        </div>

        <CategoryFormDialog trigger={<Button>Nueva categoría</Button>} />
      </div>

      <CategoriesTable />
    </div>
  );
}

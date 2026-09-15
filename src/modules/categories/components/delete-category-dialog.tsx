"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import { useDeleteCategory } from "@/modules/categories/hooks/use-categories";
import type { Category } from "@/modules/categories/types/category";

type DeleteCategoryDialogProps = {
  trigger: ReactElement;
  category: Category;
};

export function DeleteCategoryDialog({
  trigger,
  category,
}: DeleteCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const deleteCategory = useDeleteCategory();

  async function handleDelete() {
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Categoría eliminada");
      setOpen(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudo eliminar la categoría"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar categoría</DialogTitle>
          <DialogDescription>
            Se va a eliminar «{category.name}». Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteCategory.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCategory.isPending}
          >
            {deleteCategory.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

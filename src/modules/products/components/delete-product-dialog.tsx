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
import { useDeleteProduct } from "@/modules/products/hooks/use-products";
import type { Product } from "@/modules/products/types/product";

type DeleteProductDialogProps = {
  trigger: ReactElement;
  product: Product;
};

export function DeleteProductDialog({
  trigger,
  product,
}: DeleteProductDialogProps) {
  const [open, setOpen] = useState(false);
  const deleteProduct = useDeleteProduct();

  async function handleDelete() {
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success("Producto eliminado");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el producto"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar producto</DialogTitle>
          <DialogDescription>
            Se va a eliminar «{product.name}». Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteProduct.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProduct.isPending}
          >
            {deleteProduct.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

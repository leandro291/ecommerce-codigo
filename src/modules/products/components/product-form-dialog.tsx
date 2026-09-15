"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage, isConflict } from "@/lib/api-error";
import { fromCents } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/modules/products/hooks/use-products";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/products/schemas/product.schema";
import type { Product } from "@/modules/products/types/product";

type ProductFormDialogProps = {
  trigger: ReactElement;
  product?: Product;
};

// El formulario trabaja en soles; `toCents` (en el service) es el único cruce.
function toDefaults(product?: Product): ProductFormValues {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? null,
    categoryId: product?.categoryId ?? "",
    price: product ? fromCents(product.price) : 0,
    compareAtPrice:
      product?.compareAtPrice == null ? null : fromCents(product.compareAtPrice),
    sku: product?.sku ?? null,
    stock: product?.stock ?? 0,
    imageUrl: product?.imageUrl ?? null,
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
  };
}

const optionalNumber = (value: string) => (value === "" ? null : Number(value));

export function ProductFormDialog({
  trigger,
  product,
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: toDefaults(product),
  });

  const categoryId = useWatch({ control, name: "categoryId" });
  const isActive = useWatch({ control, name: "isActive" });
  const isFeatured = useWatch({ control, name: "isFeatured" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(toDefaults(product));
      setSlugTouched(isEdit);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, input: values });
        toast.success("Producto actualizado");
      } else {
        await createProduct.mutateAsync(values);
        toast.success("Producto creado");
      }
      setOpen(false);
    } catch (error) {
      if (isConflict(error)) {
        const message = getApiErrorMessage(error, "");
        const field = message.includes("SKU") ? "sku" : "slug";
        setError(field, { message });
        return;
      }

      toast.error(getApiErrorMessage(error, "No se pudo guardar el producto"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            El slug se genera desde el nombre; los precios se cargan en soles.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
              <Input
                id="product-name"
                {...register("name", {
                  onChange: (event) => {
                    if (!slugTouched) {
                      setValue("slug", slugify(event.target.value));
                    }
                  },
                })}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-slug">Slug</FieldLabel>
              <Input
                id="product-slug"
                {...register("slug", {
                  onChange: () => setSlugTouched(true),
                })}
              />
              <FieldError errors={[errors.slug]} />
            </Field>

            <Field>
              <FieldLabel>Categoría</FieldLabel>
              <Select
                value={categoryId || ""}
                onValueChange={(value) =>
                  setValue("categoryId", value ?? "", { shouldValidate: true })
                }
              >
                <SelectTrigger aria-label="Categoría" className="w-full">
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[errors.categoryId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-price">Precio (soles)</FieldLabel>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                {...register("price", {
                  setValueAs: (value: string) =>
                    value === "" ? Number.NaN : Number(value),
                })}
              />
              <FieldError errors={[errors.price]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-compare-at-price">
                Precio anterior (soles)
              </FieldLabel>
              <Input
                id="product-compare-at-price"
                type="number"
                min={0}
                step="0.01"
                {...register("compareAtPrice", { setValueAs: optionalNumber })}
              />
              <FieldError errors={[errors.compareAtPrice]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
              <Input
                id="product-sku"
                {...register("sku", {
                  setValueAs: (value: string) => value || null,
                })}
              />
              <FieldError errors={[errors.sku]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-stock">Stock</FieldLabel>
              <Input
                id="product-stock"
                type="number"
                min={0}
                {...register("stock", {
                  setValueAs: (value: string) => Number(value || 0),
                })}
              />
              <FieldError errors={[errors.stock]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
              <Input
                id="product-description"
                {...register("description", {
                  setValueAs: (value: string) => value || null,
                })}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-image-url">URL de imagen</FieldLabel>
              <Input
                id="product-image-url"
                placeholder="https://…"
                {...register("imageUrl", {
                  setValueAs: (value: string) => value || null,
                })}
              />
              <FieldError errors={[errors.imageUrl]} />
            </Field>

            <Field>
              <FieldLabel>Estado</FieldLabel>
              <Select
                value={String(isActive ?? true)}
                onValueChange={(value) =>
                  setValue("isActive", value === "true")
                }
              >
                <SelectTrigger aria-label="Estado" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activo</SelectItem>
                  <SelectItem value="false">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Destacado</FieldLabel>
              <Select
                value={String(isFeatured ?? false)}
                onValueChange={(value) =>
                  setValue("isFeatured", value === "true")
                }
              >
                <SelectTrigger aria-label="Destacado" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

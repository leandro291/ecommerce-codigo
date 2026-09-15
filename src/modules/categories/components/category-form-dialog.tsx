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
import { slugify } from "@/lib/slug";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/modules/categories/hooks/use-categories";
import {
  createCategorySchema,
  type CreateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import type { Category } from "@/modules/categories/types/category";

type CategoryFormDialogProps = {
  trigger: ReactElement;
  category?: Category;
};

function toDefaults(category?: Category): CreateCategoryInput {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? null,
    imageUrl: category?.imageUrl ?? null,
    isActive: category?.isActive ?? true,
    position: category?.position ?? 0,
  };
}

export function CategoryFormDialog({
  trigger,
  category,
}: CategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createCategorySchema),
    defaultValues: toDefaults(category),
  });

  const isActive = useWatch({ control, name: "isActive" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(toDefaults(category));
      setSlugTouched(isEdit);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, input: values });
        toast.success("Categoría actualizada");
      } else {
        await createCategory.mutateAsync(values);
        toast.success("Categoría creada");
      }
      setOpen(false);
    } catch (error) {
      if (isConflict(error)) {
        setError("slug", {
          message: "Ya existe una categoría con ese slug",
        });
        return;
      }

      toast.error(getApiErrorMessage(error, "No se pudo guardar la categoría"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
          <DialogDescription>
            El slug se genera desde el nombre; podés editarlo a mano.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
              <Input
                id="category-name"
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
              <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
              <Input
                id="category-slug"
                {...register("slug", {
                  onChange: () => setSlugTouched(true),
                })}
              />
              <FieldError errors={[errors.slug]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-description">
                Descripción
              </FieldLabel>
              <Input
                id="category-description"
                {...register("description", {
                  setValueAs: (value: string) => value || null,
                })}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-image-url">
                URL de imagen
              </FieldLabel>
              <Input
                id="category-image-url"
                placeholder="https://…"
                {...register("imageUrl", {
                  setValueAs: (value: string) => value || null,
                })}
              />
              <FieldError errors={[errors.imageUrl]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-position">Posición</FieldLabel>
              <Input
                id="category-position"
                type="number"
                min={0}
                {...register("position", {
                  setValueAs: (value: string) => Number(value || 0),
                })}
              />
              <FieldError errors={[errors.position]} />
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
                  <SelectItem value="true">Activa</SelectItem>
                  <SelectItem value="false">Inactiva</SelectItem>
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

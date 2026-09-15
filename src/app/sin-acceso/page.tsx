import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Fuera del grupo `(admin)` a propósito: si viviera adentro, su propio layout
// la redirigiría a sí misma (bucle).
export const metadata = { title: "Sin acceso" };

export default function SinAccesoPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tu cuenta no tiene acceso al panel</CardTitle>
          <CardDescription>
            El panel de administración está reservado para el equipo de la
            tienda. Si necesitás entrar, pedile acceso a un administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Base UI compone con `render`, no con `asChild`. */}
          <Button render={<Link href="/" />} nativeButton={false}>Volver a la tienda</Button>
        </CardContent>
      </Card>
    </main>
  );
}

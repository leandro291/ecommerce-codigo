import { currentUser } from "@clerk/nextjs/server";
import { Heart, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  PROFILE_TABS,
  ProfileTabs,
  type ProfileTab,
} from "@/components/shared/profile-tabs";
import { Reveal } from "@/components/shared/reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentMethodsSection } from "@/modules/customers/components/payment-methods-section";
import { PurchasesSection } from "@/modules/orders/components/purchases-section";

export const metadata: Metadata = {
  title: "Mi perfil — E-commerce Tech",
  description: "Tus datos de cuenta, favoritos y compras.",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function EmptySection({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <Card className="p-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 px-(--card-spacing) py-8 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {/* base-ui usa `render`, no `asChild`. */}
        <Button
          render={<Link href="/products" />}
          nativeButton={false}
          size="sm"
          className="rounded-full"
        >
          Ver catálogo
        </Button>
      </CardContent>
    </Card>
  );
}

// Server Component: los datos salen de Clerk, no de Postgres. `/profile` no está
// en `isPublicRoute`, así que el proxy ya frena al anónimo; el `redirect` de acá
// es solo el estrechamiento de `User | null`.
export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile">) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { tab, setup } = await searchParams;

  // Un `tab` inventado en la URL cae en la tab por defecto, no rompe nada.
  const defaultTab = PROFILE_TABS.find((value) => value === tab) as
    | ProfileTab
    | undefined;

  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Mi cuenta
        </h1>

        <Reveal>
          {/* La página sigue siendo Server Component: el `"use client"` vive
              dentro de los tabs y de la sección que consulta la API. */}
          <ProfileTabs
            defaultTab={defaultTab}
            profile={
              <Card className="p-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="size-4" />
                    Mi perfil
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 px-(--card-spacing)">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="size-14">
                      <AvatarImage src={user.imageUrl} alt="" />
                      <AvatarFallback>
                        {user.fullName?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-heading text-lg font-semibold tracking-tight">
                      {user.fullName ?? "—"}
                    </p>
                  </div>

                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Email"
                      value={user.primaryEmailAddress?.emailAddress ?? "—"}
                    />
                    <Field label="Usuario" value={user.username ?? "—"} />
                    <Field
                      label="Miembro desde"
                      value={dateFormatter.format(new Date(user.createdAt))}
                    />
                  </dl>
                </CardContent>
              </Card>
            }
            favorites={
              <EmptySection
                icon={<Heart className="size-4" />}
                title="Mis favoritos"
                message="Todavía no guardaste ningún producto."
              />
            }
            purchases={<PurchasesSection />}
            cards={<PaymentMethodsSection justSetup={setup === "done"} />}
          />
        </Reveal>
      </div>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// El valor viaja en la URL (`/profile?tab=cards`): es a donde vuelve el usuario
// después del setup de Stripe.
export const PROFILE_TABS = [
  "profile",
  "favorites",
  "purchases",
  "cards",
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

type ProfileTabsProps = {
  profile: ReactNode;
  favorites: ReactNode;
  purchases: ReactNode;
  cards: ReactNode;
  defaultTab?: ProfileTab;
};

// Solo presentación: las secciones llegan ya renderizadas como props para que la
// Card de perfil siga siendo server. Sin `keepMounted`: el panel de compras no
// monta —ni dispara su query— hasta que el usuario abre esa tab.
export function ProfileTabs({
  profile,
  favorites,
  purchases,
  cards,
  defaultTab = "profile",
}: ProfileTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-4">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="profile">Mi perfil</TabsTrigger>
        <TabsTrigger value="favorites">Mis favoritos</TabsTrigger>
        <TabsTrigger value="purchases">Mis compras</TabsTrigger>
        <TabsTrigger value="cards">Mis tarjetas</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">{profile}</TabsContent>
      <TabsContent value="favorites">{favorites}</TabsContent>
      <TabsContent value="purchases">{purchases}</TabsContent>
      <TabsContent value="cards">{cards}</TabsContent>
    </Tabs>
  );
}

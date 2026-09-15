"use client";

// next-themes ya venía instalado (lo usa `ui/sonner`). Resuelve el tema antes
// del primer paint con un script inline, cosa que un store hidratado en cliente
// no puede hacer sin flash. Se re-exporta acá solo para marcar el borde cliente.
export { ThemeProvider } from "next-themes";

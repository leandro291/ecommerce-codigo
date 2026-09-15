"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Segundos. Escalona hermanos de una misma fila del bento. */
  delay?: number;
  className?: string;
};

// Entrada al entrar en viewport. El estado inicial solo desplaza (`y`), nunca
// oculta: sin JS de cliente el contenido queda legible, apenas corrido. Con
// `prefers-reduced-motion` no se monta nada de `motion`.
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

"use client";

import { useTranslations } from "next-intl";

/** Translated unit label ("copë" / "pcs"); falls back to the unit code. */
export function useUnitLabel() {
  const t = useTranslations("Units");
  return (code: string) => (t.has(code as never) ? t(code as never) : code);
}

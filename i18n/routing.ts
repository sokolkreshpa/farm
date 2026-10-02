import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sq", "en"],
  defaultLocale: "sq",
  // Albanian URLs stay clean (/f/farm-a); English gets a prefix (/en/f/farm-a).
  localePrefix: "as-needed",
  // Many Albanian customers run English-language phones; do not auto-switch on
  // Accept-Language. The locale switcher stores an explicit choice in a cookie.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

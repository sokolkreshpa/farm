import type { routing } from "@/i18n/routing";
import type messages from "@/messages/sq.json";

// Type-safe translation keys and locales for next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Phase 3 composes Supabase session refresh into this proxy.
export default createIntlMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\..*).*)",
};

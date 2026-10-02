import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

// Locale routing + Supabase session refresh. Authorization happens in the
// DAL (lib/dal) and the database, never here.
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  return refreshSession(request, response);
}

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

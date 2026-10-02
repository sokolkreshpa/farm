import { SiteHeader } from "@/components/site-header";
import { requirePlatformAdmin } from "@/lib/dal/session";

// Platform admins only. Admin pages/actions must also call requirePlatformAdmin().
export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  await requirePlatformAdmin();
  return (
    <>
      <SiteHeader homeHref="/admin" />
      {children}
    </>
  );
}

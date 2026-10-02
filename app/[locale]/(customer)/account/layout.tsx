import { SiteHeader } from "@/components/site-header";
import { requireViewer } from "@/lib/dal/session";

// Any signed-in user. Data access is still enforced per query by RLS.
export default async function AccountLayout({
  children,
}: LayoutProps<"/[locale]/account">) {
  await requireViewer("/account");
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

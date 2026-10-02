import { SiteHeader } from "@/components/site-header";
import { requireFarmer } from "@/lib/dal/session";

// Farmers only. Every farmer page/action must still call requireFarmer()
// itself: layouts do not re-run on client navigation between sibling pages.
export default async function FarmerLayout({
  children,
}: LayoutProps<"/[locale]/farm">) {
  const { tenant } = await requireFarmer();
  return (
    <>
      <SiteHeader title={tenant.name} homeHref="/farm" />
      {children}
    </>
  );
}

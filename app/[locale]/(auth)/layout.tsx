import { SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

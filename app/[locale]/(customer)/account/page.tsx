import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { AddressForm } from "@/components/account/address-form";
import { DeleteAccountButton } from "@/components/account/delete-account-button";
import { ProfileForm } from "@/components/account/profile-form";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { deleteAddress, setDefaultAddress } from "@/lib/account/actions";
import { requireViewer } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const viewer = await requireViewer("/account");

  const supabase = await createClient();
  const [t, tPage, format, { data: addresses }, { data: profile }] =
    await Promise.all([
      getTranslations("Account"),
      getTranslations("AccountPage"),
      getFormatter(),
      supabase
        .from("addresses")
        .select("id, label, address_line, city, notes, is_default")
        .eq("profile_id", viewer.id)
        .order("is_default", { ascending: false })
        .order("created_at"),
      supabase
        .from("profiles")
        .select("deletion_requested_at")
        .eq("id", viewer.id)
        .single(),
    ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-lg">
        {t("greeting", { name: viewer.firstName })}
      </p>

      <section className="mt-8" aria-labelledby="profile-heading">
        <h2
          id="profile-heading"
          className="mb-4 font-heading text-xl font-semibold"
        >
          {tPage("profile")}
        </h2>
        <ProfileForm
          firstName={viewer.firstName}
          lastName={viewer.lastName}
          phone={viewer.phone ?? ""}
          email={viewer.email}
          preferredLocale={viewer.preferredLocale}
        />
      </section>

      <section className="mt-10" aria-labelledby="addresses-heading">
        <h2
          id="addresses-heading"
          className="mb-4 font-heading text-xl font-semibold"
        >
          {tPage("addresses")}
        </h2>
        {addresses && addresses.length > 0 ? (
          <ul className="mb-4 grid gap-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3"
              >
                <span>
                  {address.label && (
                    <span className="block font-medium">{address.label}</span>
                  )}
                  <span className="block">
                    {address.address_line}, {address.city}
                  </span>
                  {address.notes && (
                    <span className="block text-sm text-muted-foreground">
                      {address.notes}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  {address.is_default ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                      {tPage("default")}
                    </span>
                  ) : (
                    <form action={setDefaultAddress.bind(null, address.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {tPage("makeDefault")}
                      </Button>
                    </form>
                  )}
                  <form action={deleteAddress.bind(null, address.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                    >
                      {tPage("delete")}
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-muted-foreground">{tPage("noAddresses")}</p>
        )}
        <AddressForm />
      </section>

      <section
        className="mt-12 rounded-2xl border border-destructive/30 p-4"
        aria-labelledby="delete-heading"
      >
        <h2 id="delete-heading" className="font-heading text-lg font-semibold">
          {tPage("deleteAccount")}
        </h2>
        {profile?.deletion_requested_at ? (
          <p className="mt-2 text-sm">
            {tPage("deleteRequested", {
              date: format.dateTime(new Date(profile.deletion_requested_at), {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {tPage("deleteAccountBody")}
            </p>
            <div className="mt-3">
              <DeleteAccountButton />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

"use client";

import { Truck, Warehouse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { FormField } from "@/components/form-field";
import { CartLines } from "@/components/shop/cart-lines";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { clampQuantity, summarizeCart } from "@/lib/cart/math";
import { useHydrated, useOfferCart } from "@/lib/cart/use-cart";
import type { Offer } from "@/lib/catalog/types";
import { formatMoney, formatQuantity } from "@/lib/format";
import { placeOrder } from "@/lib/orders/actions";
import type { PlaceOrderError } from "@/lib/orders/errors";
import { cn } from "@/lib/utils";

export type SavedAddress = {
  id: string;
  label: string | null;
  addressLine: string;
  city: string;
  notes: string | null;
  isDefault: boolean;
};

type CheckoutFormProps = {
  slug: string;
  offer: Offer;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  deliveryInformation: string | null;
  pickupInformation: string | null;
  defaultPhone: string;
  addresses: SavedAddress[];
};

type Method = "DELIVERY" | "PICKUP";
const NEW_ADDRESS = "new";

/** Idempotency key for this checkout, kept across reloads until success. */
function checkoutKey(slug: string, cycleId: string): string {
  const storageKey = `farm-checkout-key:${slug}:${cycleId}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function forgetCheckoutKey(slug: string, cycleId: string) {
  try {
    window.sessionStorage.removeItem(`farm-checkout-key:${slug}:${cycleId}`);
  } catch {
    // ignore
  }
}

export function CheckoutForm({
  slug,
  offer,
  deliveryEnabled,
  pickupEnabled,
  deliveryFee,
  deliveryInformation,
  pickupInformation,
  defaultPhone,
  addresses,
}: CheckoutFormProps) {
  const t = useTranslations("Checkout");
  const tErr = useTranslations("Errors");
  const tMethod = useTranslations("DeliveryMethod");
  const locale = useLocale();
  const unit = useUnitLabel();
  const router = useRouter();
  const hydrated = useHydrated();
  const { lines, setQuantity, clear } = useOfferCart(slug, offer);
  const [pending, startTransition] = useTransition();

  const [method, setMethod] = useState<Method>(
    deliveryEnabled && (addresses.length > 0 || !pickupEnabled)
      ? "DELIVERY"
      : "PICKUP",
  );
  const [addressId, setAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? NEW_ADDRESS,
  );
  const [newAddress, setNewAddress] = useState({
    label: "",
    addressLine: "",
    city: "",
    notes: "",
  });
  const [phone, setPhone] = useState(defaultPhone);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<PlaceOrderError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const summary = useMemo(() => summarizeCart(lines, offer), [lines, offer]);
  const fee = method === "DELIVERY" ? deliveryFee : 0;
  const total = Math.round((summary.subtotal + fee) * 100) / 100;
  const money = (amount: number) => formatMoney(amount, offer.currency, locale);

  if (!hydrated) {
    return <div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  if (summary.count === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border px-5 py-8 text-center">
        <p className="font-heading text-lg font-semibold">{t("emptyTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("emptyBody")}</p>
        <Button asChild className="mt-4" size="lg">
          <Link href={`/f/${slug}`}>{t("backToShop")}</Link>
        </Button>
      </div>
    );
  }

  const usingNewAddress = method === "DELIVERY" && addressId === NEW_ADDRESS;

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (phone.trim().length < 6) errors.phone = tErr("phoneInvalid");
    if (usingNewAddress) {
      if (!newAddress.addressLine.trim()) errors.addressLine = tErr("required");
      if (!newAddress.city.trim()) errors.city = tErr("required");
    }
    return errors;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const result = await placeOrder({
        tenantSlug: slug,
        cycleId: offer.cycleId,
        items: summary.lines.map((l) => ({
          availabilityItemId: l.item.id,
          quantity: l.quantity,
        })),
        deliveryMethod: method,
        addressId:
          method === "DELIVERY" && addressId !== NEW_ADDRESS
            ? addressId
            : undefined,
        newAddress: usingNewAddress
          ? {
              label: newAddress.label,
              addressLine: newAddress.addressLine,
              city: newAddress.city,
              notes: newAddress.notes,
            }
          : undefined,
        phone,
        deliveryNotes,
        notes,
        idempotencyKey: checkoutKey(slug, offer.cycleId),
      });

      if (result.ok) {
        forgetCheckoutKey(slug, offer.cycleId);
        clear();
        router.push(`/account/orders/${result.orderId}?placed=1`);
        return;
      }
      setError(result.error);
      if (result.fields?.phone)
        setFieldErrors({ phone: tErr(result.fields.phone) });
    });
  }

  const problemItem = error?.itemId
    ? summary.lines.find((l) => l.item.id === error.itemId)
    : undefined;
  const adjustedQuantity =
    problemItem &&
    error?.code === "INSUFFICIENT_STOCK" &&
    error.remaining !== undefined
      ? clampQuantity(
          { ...problemItem.item, remaining: error.remaining },
          error.remaining,
        )
      : undefined;

  return (
    <form onSubmit={submit} className="mt-6 grid gap-8" noValidate>
      <section aria-labelledby="order-heading">
        <h2 id="order-heading" className="font-heading text-xl font-semibold">
          {t("yourOrder")}
        </h2>
        <CartLines
          summary={summary}
          currency={offer.currency}
          onChange={setQuantity}
          highlight={error?.itemId ? [error.itemId] : []}
        />
      </section>

      <section aria-labelledby="method-heading" className="grid gap-3">
        <h2 id="method-heading" className="font-heading text-xl font-semibold">
          {t("howToReceive")}
        </h2>
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as Method)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {deliveryEnabled && (
            <MethodOption
              value="DELIVERY"
              icon={<Truck className="size-5" aria-hidden />}
              title={tMethod("DELIVERY")}
              detail={money(deliveryFee)}
              selected={method === "DELIVERY"}
            />
          )}
          {pickupEnabled && (
            <MethodOption
              value="PICKUP"
              icon={<Warehouse className="size-5" aria-hidden />}
              title={tMethod("PICKUP")}
              detail={t("pickupFree")}
              selected={method === "PICKUP"}
            />
          )}
        </RadioGroup>
        {method === "PICKUP" && pickupInformation && (
          <p className="text-sm text-muted-foreground">{pickupInformation}</p>
        )}
        {method === "DELIVERY" && deliveryInformation && (
          <p className="text-sm text-muted-foreground">{deliveryInformation}</p>
        )}
      </section>

      {method === "DELIVERY" && (
        <section aria-labelledby="address-heading" className="grid gap-3">
          <h2
            id="address-heading"
            className="font-heading text-xl font-semibold"
          >
            {t("deliveryAddress")}
          </h2>
          {addresses.length > 0 && (
            <RadioGroup
              value={addressId}
              onValueChange={setAddressId}
              className="grid gap-2"
            >
              {addresses.map((address) => (
                <Label
                  key={address.id}
                  htmlFor={`address-${address.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
                >
                  <RadioGroupItem
                    id={`address-${address.id}`}
                    value={address.id}
                    className="mt-0.5"
                  />
                  <span>
                    {address.label && (
                      <span className="block font-medium">{address.label}</span>
                    )}
                    <span className="block">
                      {address.addressLine}, {address.city}
                    </span>
                    {address.notes && (
                      <span className="block text-sm text-muted-foreground">
                        {address.notes}
                      </span>
                    )}
                  </span>
                </Label>
              ))}
              <Label
                htmlFor="address-new"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
              >
                <RadioGroupItem id="address-new" value={NEW_ADDRESS} />
                {t("newAddress")}
              </Label>
            </RadioGroup>
          )}
          {usingNewAddress && (
            <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
              <FormField
                name="addressLine"
                label={t("addressLine")}
                autoComplete="street-address"
                value={newAddress.addressLine}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, addressLine: e.target.value })
                }
                error={fieldErrors.addressLine}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  name="city"
                  label={t("city")}
                  autoComplete="address-level2"
                  value={newAddress.city}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, city: e.target.value })
                  }
                  error={fieldErrors.city}
                  required
                />
                <FormField
                  name="label"
                  label={t("addressLabel")}
                  value={newAddress.label}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, label: e.target.value })
                  }
                />
              </div>
              <FormField
                name="addressNotes"
                label={t("addressNotes")}
                value={newAddress.notes}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, notes: e.target.value })
                }
              />
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="contact-heading" className="grid gap-3">
        <h2 id="contact-heading" className="font-heading text-xl font-semibold">
          {t("contact")}
        </h2>
        <FormField
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          required
        />
        {method === "DELIVERY" && (
          <div className="grid gap-2">
            <Label htmlFor="deliveryNotes">{t("deliveryNotes")}</Label>
            <Textarea
              id="deliveryNotes"
              value={deliveryNotes}
              maxLength={500}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="notes">{t("notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            maxLength={1000}
            placeholder={t("notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl bg-secondary/60 p-4">
        <div className="flex justify-between">
          <span>{t("subtotal")}</span>
          <span className="tabular-nums">{money(summary.subtotal)}</span>
        </div>
        {method === "DELIVERY" && (
          <div className="flex justify-between">
            <span>{t("deliveryFee")}</span>
            <span className="tabular-nums">{money(fee)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
          <span>{t("total")}</span>
          <span className="tabular-nums">{money(total)}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("cashNote")}</p>
      </section>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="grid gap-2">
            <span>
              {problemItem ? `${problemItem.item.name}: ` : ""}
              {tErr(error.code)}
            </span>
            {problemItem && adjustedQuantity !== undefined && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setQuantity(problemItem.item.id, adjustedQuantity);
                  setError(null);
                }}
              >
                {adjustedQuantity > 0
                  ? t("adjustTo", {
                      quantity: formatQuantity(adjustedQuantity, locale),
                      unit: unit(problemItem.item.unitCode),
                    })
                  : tErr("ITEM_NOT_AVAILABLE")}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className={cn("h-14 text-lg", pending && "opacity-80")}
        disabled={pending}
      >
        {pending ? t("submitting") : `${t("submit")} · ${money(total)}`}
      </Button>
    </form>
  );
}

function MethodOption({
  value,
  icon,
  title,
  detail,
  selected,
}: {
  value: Method;
  icon: React.ReactNode;
  title: string;
  detail: string;
  selected: boolean;
}) {
  return (
    <Label
      htmlFor={`method-${value}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 font-normal",
        selected && "border-primary bg-accent/50",
      )}
    >
      <RadioGroupItem id={`method-${value}`} value={value} />
      <span className="text-primary">{icon}</span>
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </Label>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireFarmer } from "@/lib/dal/session";
import { dbErrorKey } from "@/lib/db/errors";
import { defaultDeadline, isMonday, zonedToUtc } from "@/lib/farm/weeks";
import type { ErrorKey } from "@/lib/i18n/errors";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import {
  customerUpdateSchema,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  itemPatchSchema,
  newItemSchema,
  productSchema,
  settingsSchema,
  weekSettingsSchema,
} from "@/lib/validation/farm";
import type { Database } from "@/types/database";

// Every action: requireFarmer() first (tenant from membership, never from
// input), Zod-validate, filter writes by tenant_id. RLS is the final guard.

export type FarmFormState = {
  error?: ErrorKey;
  fields?: FieldErrors;
  success?: boolean;
  /** Changes on every success, so forms can remount to reset their state. */
  nonce?: string;
};

export type ActionResult = { ok: true } | { ok: false; error: ErrorKey };

type OrderStatus = Database["public"]["Enums"]["order_status"];

const uuid = z.uuid();

async function goTo(path: string): Promise<never> {
  return redirect({ href: path, locale: await getLocale() });
}

// ------------------------------------------------------------------ products

export async function saveProduct(
  _prev: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const { tenant } = await requireFarmer();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const product = parsed.data;

  const supabase = await createClient();

  // Optional photo upload into the farm's own folder (storage RLS checks it).
  let imagePath: string | undefined;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!(IMAGE_TYPES as readonly string[]).includes(image.type)) {
      return { fields: { image: "imageType" } };
    }
    if (image.size > IMAGE_MAX_BYTES)
      return { fields: { image: "imageTooLarge" } };
    const ext =
      image.type === "image/png"
        ? "png"
        : image.type === "image/webp"
          ? "webp"
          : "jpg";
    imagePath = `${tenant.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(imagePath, image, { contentType: image.type });
    if (error) return { error: "uploadFailed" };
  }

  const values = {
    name: product.name,
    description: product.description,
    category: product.category,
    unit_code: product.unitCode,
    quantity_step: product.quantityStep,
    active: product.active,
    ...(imagePath ? { image_path: imagePath } : {}),
  };

  if (product.id) {
    const { data: previous } = await supabase
      .from("products")
      .select("image_path")
      .eq("tenant_id", tenant.id)
      .eq("id", product.id)
      .maybeSingle();
    const { error } = await supabase
      .from("products")
      .update(values)
      .eq("tenant_id", tenant.id)
      .eq("id", product.id);
    if (error) {
      return error.code === "23505"
        ? { fields: { name: "productNameTaken" } }
        : { error: dbErrorKey(error) };
    }
    if (imagePath && previous?.image_path) {
      await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .remove([previous.image_path]);
    }
  } else {
    const { error } = await supabase
      .from("products")
      .insert({ ...values, tenant_id: tenant.id });
    if (error) {
      return error.code === "23505"
        ? { fields: { name: "productNameTaken" } }
        : { error: dbErrorKey(error) };
    }
  }

  revalidatePath("/farm/products");
  return goTo("/farm/products");
}

export async function setProductActive(
  productId: string,
  active: boolean,
): Promise<void> {
  const { tenant } = await requireFarmer();
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ active })
    .eq("tenant_id", tenant.id)
    .eq("id", uuid.parse(productId));
  revalidatePath("/farm/products");
}

// --------------------------------------------------------------------- weeks

export async function createWeek(
  weekStart: string,
  sourceCycleId: string | null,
): Promise<ActionResult> {
  const { tenant } = await requireFarmer();
  if (!isMonday(weekStart)) return { ok: false, error: "INVALID_WEEK_START" };
  const supabase = await createClient();

  let cycleId: string;
  if (sourceCycleId) {
    const { data, error } = await supabase.rpc("copy_cycle", {
      p_source_cycle_id: uuid.parse(sourceCycleId),
      p_week_start: weekStart,
    });
    if (error || !data) return { ok: false, error: dbErrorKey(error) };
    cycleId = data;
  } else {
    const { data: farm } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenant.id)
      .single();
    const { data, error } = await supabase
      .from("weekly_cycles")
      .insert({
        tenant_id: tenant.id,
        week_start: weekStart,
        order_deadline: defaultDeadline(
          weekStart,
          farm?.timezone ?? "Europe/Tirane",
        ).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: dbErrorKey(error) };
    cycleId = data.id;
  }

  revalidatePath("/farm", "layout");
  return goTo(`/farm/weeks/${cycleId}`);
}

export async function updateWeekSettings(
  _prev: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const { tenant } = await requireFarmer();
  const parsed = weekSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: farm } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenant.id)
    .single();
  const [date, time] = parsed.data.deadline.split("T");
  const deadline = zonedToUtc(date, time, farm?.timezone ?? "Europe/Tirane");

  const { error } = await supabase
    .from("weekly_cycles")
    .update({
      order_deadline: deadline.toISOString(),
      message: parsed.data.message,
    })
    .eq("tenant_id", tenant.id)
    .eq("id", parsed.data.cycleId);
  if (error) return { error: dbErrorKey(error) };

  revalidatePath(`/farm/weeks/${parsed.data.cycleId}`);
  return { success: true };
}

async function cycleRpc(
  fn: "publish_cycle" | "close_cycle",
  cycleId: string,
): Promise<ActionResult> {
  await requireFarmer();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_cycle_id: uuid.parse(cycleId) });
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/farm", "layout");
  return { ok: true };
}

export async function publishWeek(cycleId: string): Promise<ActionResult> {
  return cycleRpc("publish_cycle", cycleId);
}

export async function closeWeek(cycleId: string): Promise<ActionResult> {
  return cycleRpc("close_cycle", cycleId);
}

export async function deleteDraftWeek(cycleId: string): Promise<ActionResult> {
  const { tenant } = await requireFarmer();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("weekly_cycles")
    .delete({ count: "exact" })
    .eq("tenant_id", tenant.id)
    .eq("id", uuid.parse(cycleId))
    .eq("status", "DRAFT");
  if (error) return { ok: false, error: dbErrorKey(error) };
  if (!count) return { ok: false, error: "IN_USE" };
  revalidatePath("/farm", "layout");
  return goTo("/farm/weeks");
}

// ---------------------------------------------------------- availability items

export async function addWeekItem(
  _prev: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const { tenant } = await requireFarmer();
  const parsed = newItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { count } = await supabase
    .from("availability_items")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", parsed.data.cycleId);
  const { error } = await supabase.from("availability_items").insert({
    tenant_id: tenant.id,
    cycle_id: parsed.data.cycleId,
    product_id: parsed.data.productId,
    price: parsed.data.price,
    available_quantity: parsed.data.availableQuantity,
    sort_order: (count ?? 0) + 1,
  });
  if (error) return { error: dbErrorKey(error) };

  revalidatePath(`/farm/weeks/${parsed.data.cycleId}`);
  return { success: true, nonce: crypto.randomUUID() };
}

export async function updateWeekItem(
  itemId: string,
  patch: z.input<typeof itemPatchSchema>,
): Promise<ActionResult> {
  const { tenant } = await requireFarmer();
  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: fieldErrors(parsed.error).form ?? "numberInvalid",
    };
  }
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_items")
    .update({
      ...(p.price !== undefined ? { price: p.price } : {}),
      ...(p.availableQuantity !== undefined
        ? { available_quantity: p.availableQuantity }
        : {}),
      ...(p.minimumQuantity !== undefined
        ? { minimum_quantity: p.minimumQuantity }
        : {}),
      ...(p.maximumQuantity !== undefined
        ? { maximum_quantity: p.maximumQuantity }
        : {}),
      ...(p.listed !== undefined ? { listed: p.listed } : {}),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", uuid.parse(itemId));
  if (error) return { ok: false, error: dbErrorKey(error) };
  return { ok: true };
}

export async function removeWeekItem(itemId: string): Promise<ActionResult> {
  const { tenant } = await requireFarmer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_items")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", uuid.parse(itemId));
  // Items that were ordered are kept (order history); unlist them instead.
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/farm/weeks", "layout");
  return { ok: true };
}

// -------------------------------------------------------------------- orders

const statusSchema = z.enum([
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<ActionResult> {
  await requireFarmer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: uuid.parse(orderId),
    p_status: statusSchema.parse(status),
    p_note: note?.slice(0, 500),
  });
  if (error) return { ok: false, error: dbErrorKey(error) };
  after(() => dispatchNotifications());
  revalidatePath("/farm", "layout");
  return { ok: true };
}

export async function bulkSetOrderStatus(
  orderIds: string[],
  status: OrderStatus,
): Promise<{ updated: number; failed: number }> {
  await requireFarmer();
  const ids = z.array(uuid).max(200).parse(orderIds);
  const target = statusSchema.parse(status);
  const supabase = await createClient();
  let updated = 0;
  let failed = 0;
  for (const id of ids) {
    const { error } = await supabase.rpc("set_order_status", {
      p_order_id: id,
      p_status: target,
    });
    if (error) failed += 1;
    else updated += 1;
  }
  if (updated) after(() => dispatchNotifications(100));
  revalidatePath("/farm", "layout");
  return { updated, failed };
}

// ----------------------------------------------------------------- customers

export async function updateCustomer(
  _prev: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const { tenant } = await requireFarmer();
  const parsed = customerUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      farmer_notes: parsed.data.farmerNotes,
      active: parsed.data.active,
    })
    .eq("tenant_id", tenant.id)
    .eq("id", parsed.data.customerId);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/farm/customers", "layout");
  return { success: true };
}

// ------------------------------------------------------------------ settings

export async function updateFarmSettings(
  _prev: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const { tenant } = await requireFarmer();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: s.name,
      description: s.description,
      phone: s.phone,
      email: s.email,
      address: s.address,
      delivery_information: s.deliveryInformation,
      pickup_information: s.pickupInformation,
      delivery_enabled: s.deliveryEnabled,
      pickup_enabled: s.pickupEnabled,
      delivery_fee: s.deliveryFee,
      enforce_inventory: s.enforceInventory,
    })
    .eq("id", tenant.id);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/", "layout");
  return { success: true };
}

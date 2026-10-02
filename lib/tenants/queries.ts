import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PublicTenant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoPath: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  deliveryInformation: string | null;
  pickupInformation: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  currency: string;
  timezone: string;
  enforceInventory: boolean;
};

/** An active farm by slug (RLS only exposes active farms publicly). */
export const getPublicTenant = cache(
  async (slug: string): Promise<PublicTenant | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, name, slug, description, logo_path, phone, email, address, delivery_information, pickup_information, delivery_enabled, pickup_enabled, delivery_fee, currency, timezone, enforce_inventory, active",
      )
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      logoPath: data.logo_path,
      phone: data.phone,
      email: data.email,
      address: data.address,
      deliveryInformation: data.delivery_information,
      pickupInformation: data.pickup_information,
      deliveryEnabled: data.delivery_enabled,
      pickupEnabled: data.pickup_enabled,
      deliveryFee: Number(data.delivery_fee),
      currency: data.currency,
      timezone: data.timezone,
      enforceInventory: data.enforce_inventory,
    };
  },
);

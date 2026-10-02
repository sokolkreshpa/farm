import { publicEnv } from "@/lib/env";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Public URL of an object in the product-images bucket. */
export function productImageUrl(path: string | null): string | null {
  if (!path) return null;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

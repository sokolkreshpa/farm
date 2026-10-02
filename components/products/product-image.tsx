import Image from "next/image";
import { cn } from "@/lib/utils";

// Soft, earthy tile colours for products without a photo.
const TILE_COLORS = [
  "bg-[oklch(0.93_0.05_140)] text-[oklch(0.38_0.08_145)]",
  "bg-[oklch(0.93_0.05_60)] text-[oklch(0.42_0.09_50)]",
  "bg-[oklch(0.94_0.04_95)] text-[oklch(0.42_0.07_85)]",
  "bg-[oklch(0.92_0.04_25)] text-[oklch(0.45_0.1_30)]",
  "bg-[oklch(0.93_0.03_250)] text-[oklch(0.42_0.06_250)]",
];

function colorFor(text: string): string {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

type ProductImageProps = {
  name: string;
  imageUrl: string | null;
  className?: string;
  sizes?: string;
};

export function ProductImage({
  name,
  imageUrl,
  className,
  sizes = "(min-width: 640px) 33vw, 96px",
}: ProductImageProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        !imageUrl && colorFor(name),
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center font-heading text-3xl font-semibold"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

import { z } from "zod";

// Error messages are translation keys under "Errors".

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : null));

/** Accepts "2,5" as well as "2.5" (Albanian keyboards). */
const decimal = (message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
    z.coerce.number({ error: message }).finite(message),
  );

const optionalDecimal = (message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    decimal(message).pipe(z.number().positive(message)).nullable(),
  );

export const productSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "required").max(120, "tooLong"),
  description: optionalText(1000),
  category: optionalText(50),
  unitCode: z.string().regex(/^[a-z]+$/, "required"),
  quantityStep: decimal("numberInvalid").pipe(
    z.number().positive("numberInvalid").max(1000, "numberInvalid"),
  ),
  active: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
});

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // see next.config.ts bodySizeLimit

export const itemPatchSchema = z
  .object({
    price: decimal("numberInvalid").pipe(
      z.number().min(0, "numberInvalid").max(10_000_000, "numberInvalid"),
    ),
    availableQuantity: decimal("numberInvalid").pipe(
      z.number().min(0, "numberInvalid").max(1_000_000, "numberInvalid"),
    ),
    minimumQuantity: optionalDecimal("numberInvalid"),
    maximumQuantity: optionalDecimal("numberInvalid"),
    listed: z.boolean(),
  })
  .partial()
  .refine(
    (v) =>
      v.minimumQuantity == null ||
      v.maximumQuantity == null ||
      v.minimumQuantity <= v.maximumQuantity,
    { message: "minAboveMax", path: ["maximumQuantity"] },
  );

export const newItemSchema = z.object({
  cycleId: z.uuid(),
  productId: z.uuid("required"),
  price: decimal("numberInvalid").pipe(z.number().min(0, "numberInvalid")),
  availableQuantity: decimal("numberInvalid").pipe(
    z.number().min(0, "numberInvalid"),
  ),
});

export const weekSettingsSchema = z.object({
  cycleId: z.uuid(),
  /** datetime-local value in the farm's timezone: "2026-10-08T20:00". */
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "dateInvalid"),
  message: optionalText(500),
});

export const settingsSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(120, "tooLong"),
    description: optionalText(2000),
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .max(254, "tooLong")
      .refine((v) => v === "" || z.email().safeParse(v).success, "emailInvalid")
      .transform((v) => (v ? v.toLowerCase() : null)),
    address: optionalText(300),
    deliveryInformation: optionalText(2000),
    pickupInformation: optionalText(1000),
    deliveryEnabled: z
      .literal("on")
      .optional()
      .transform((v) => v === "on"),
    pickupEnabled: z
      .literal("on")
      .optional()
      .transform((v) => v === "on"),
    deliveryFee: decimal("numberInvalid").pipe(
      z.number().min(0, "numberInvalid").max(1_000_000, "numberInvalid"),
    ),
    enforceInventory: z
      .literal("on")
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((v) => v.deliveryEnabled || v.pickupEnabled, {
    message: "fulfilmentRequired",
    path: ["pickupEnabled"],
  });

export const customerUpdateSchema = z.object({
  customerId: z.uuid(),
  farmerNotes: optionalText(2000),
  active: z
    .literal("on")
    .optional()
    .transform((v) => v === "on"),
});

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slugInvalid")
  .min(3, "slugInvalid")
  .max(50, "slugInvalid");

export const newFarmSchema = z.object({
  name: z.string().trim().min(1, "required").max(120, "tooLong"),
  slug,
  phone: optionalText(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("emailInvalid"))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  farmerFirstName: z.string().trim().min(1, "required").max(80, "tooLong"),
  farmerLastName: z.string().trim().max(80, "tooLong"),
  farmerEmail: z.string().trim().toLowerCase().pipe(z.email("emailInvalid")),
});

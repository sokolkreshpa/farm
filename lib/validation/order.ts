import { z } from "zod";

// Error messages are translation keys under "Errors".

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

export const addressSchema = z.object({
  label: optionalText(50),
  addressLine: z.string().trim().min(1, "required").max(300, "tooLong"),
  city: z.string().trim().min(1, "required").max(100, "tooLong"),
  notes: optionalText(500),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const placeOrderSchema = z
  .object({
    tenantSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    cycleId: z.uuid(),
    items: z
      .array(
        z.object({
          availabilityItemId: z.uuid(),
          quantity: z.number().positive().max(100_000),
        }),
      )
      .min(1, "EMPTY_ORDER")
      .max(100, "TOO_MANY_ITEMS"),
    deliveryMethod: z.enum(["DELIVERY", "PICKUP"]),
    addressId: z.uuid().optional(),
    newAddress: addressSchema.optional(),
    phone: z
      .string()
      .trim()
      .min(6, "phoneInvalid")
      .max(30, "phoneInvalid")
      .regex(/^[+\d][\d\s-]*$/, "phoneInvalid"),
    deliveryNotes: optionalText(500),
    notes: optionalText(1000),
    idempotencyKey: z.uuid(),
  })
  .refine((v) => v.deliveryMethod === "PICKUP" || v.addressId || v.newAddress, {
    message: "ADDRESS_REQUIRED",
    path: ["addressId"],
  });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

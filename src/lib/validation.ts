import { z } from "zod";
export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  registration_number: z.string().trim().min(2).max(80),
  graduation_year: z.coerce.number().int().min(2000).max(2100),
  phone_number: z
    .string()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      "Use international format, e.g. +923001234567",
    ),
});
export type ProfileForm = z.infer<typeof profileSchema>;
export const listingSchema = z
  .object({
    type: z.enum(["SALE", "RENT", "REQUEST"]),
    contact_mode: z.enum(["CHAT", "WHATSAPP", "CALL", "BOTH"]).default("CHAT"),
    title: z.string().trim().min(5, "Use at least 5 characters").max(120),
    description: z
      .string()
      .trim()
      .min(20, "Add at least 20 characters")
      .max(4000),
    category: z.string().min(1, "Choose a category"),
    condition: z.string(),
    amount: z.coerce.number().min(0).max(9999999999),
    deposit: z.union([z.literal(""), z.coerce.number().min(0).max(9999999999)]),
    need_type: z.enum(["BUY", "RENT", "EITHER"]),
    preferred_meetup_spot: z.string().trim().min(2).max(160),
  })
  .superRefine((v, ctx) => {
    if (
      v.type !== "REQUEST" &&
      !["NEW", "LIKE_NEW", "USED", "FAIR"].includes(v.condition)
    )
      ctx.addIssue({
        code: "custom",
        path: ["condition"],
        message: "Choose a condition",
      });
  });
export type ListingForm = z.infer<typeof listingSchema>;
export function listingPayload(v: ListingForm, image_paths: string[]) {
  return {
    type: v.type,
    contact_mode: v.contact_mode,
    title: v.title,
    description: v.description,
    category: v.category,
    condition: v.type === "REQUEST" ? null : v.condition,
    price: v.type === "SALE" ? v.amount : null,
    rental_rate_daily: v.type === "RENT" ? v.amount : null,
    deposit: v.type === "RENT" && v.deposit !== "" ? v.deposit : null,
    offered_budget: v.type === "REQUEST" ? v.amount : null,
    need_type: v.type === "REQUEST" ? v.need_type : null,
    preferred_meetup_spot: v.preferred_meetup_spot,
    image_paths,
  };
}

import { z } from "zod";
import { supabase, userError } from "./supabase";

export type EmailCodePurpose = "signup" | "recovery";
export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128, "Use at most 128 characters."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "The passwords do not match.",
    path: ["confirmation"],
  });
export type PasswordValues = z.infer<typeof passwordSchema>;

export function normalizeEmail(value: string) {
  const parsed = z.string().trim().email().safeParse(value);
  if (!parsed.success)
    throw userError("Enter a valid university email address.");
  return parsed.data.toLowerCase();
}

async function approvedEmail(value: string) {
  const email = normalizeEmail(value);
  const { data, error } = await supabase
    .from("allowed_email_domains")
    .select("domain")
    .eq("is_active", true);
  if (error) throw error;
  if (!data.some((row) => row.domain === email.split("@")[1])) {
    throw userError("Use an approved university email address.");
  }
  // This improves feedback; the Auth hook and database still enforce eligibility.
  return email;
}

export async function sendEmailCode(
  email: string,
  captchaToken: string,
  purpose: EmailCodePurpose,
) {
  if (!captchaToken) throw userError("Complete the security check first.");
  const address = await approvedEmail(email);
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { captchaToken, shouldCreateUser: purpose === "signup" },
  });
  // Do not reveal whether a recovery address has an account. Do not create one.
  if (
    error &&
    !(
      purpose === "recovery" &&
      ["user_not_found", "otp_disabled"].includes(error.code || "")
    )
  )
    throw error;
  return address;
}

export async function verifyEmailCode(email: string, token: string) {
  if (!/^\d{6,10}$/.test(token))
    throw userError("Enter the verification code from your latest email.");
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type: "email",
  });
  if (error) throw error;
  if (!data.session)
    throw userError("A session could not be created. Request a new code.");
  return data.session;
}

export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken: string,
) {
  if (!captchaToken) throw userError("Complete the security check first.");
  if (!password) throw userError("Enter your password.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
    options: { captchaToken },
  });
  if (error) throw error;
  if (!data.session)
    throw userError("Sign-in could not be completed. Please try again.");
  return data.session;
}

export async function savePassword(values: PasswordValues, nonce?: string) {
  const parsed = passwordSchema.safeParse(values);
  if (!parsed.success) throw userError(parsed.error.issues[0].message);
  // Supabase changes only the currently authenticated user's credential.
  // Never write passwords or credential flags to profiles or user metadata.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    ...(nonce ? { nonce } : {}),
  });
  if (error) throw error;
}

export function authDestination(
  purpose: "signin" | EmailCodePurpose,
  hasProfile: boolean,
  next: string,
) {
  if (purpose === "signin") return hasProfile ? next : "/onboarding";
  return `/password?next=${encodeURIComponent(hasProfile ? next : "/onboarding")}`;
}

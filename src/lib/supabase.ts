import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url && key && !url.includes("YOUR_PROJECT") && !key.includes("YOUR_"),
);
export const supabase = createClient(
  configured ? url : "https://unconfigured.supabase.co",
  configured ? key : "unconfigured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
export const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  string | undefined;
export function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.code === "invalid_credentials")
    return "Email or password is incorrect. If you previously used OTP, choose Forgot password to set a password.";
  if (e?.code === "email_not_confirmed")
    return "Verify your university email first using Create account or Forgot password.";
  if (e?.code === "weak_password")
    return "Choose a stronger password that meets the project's password policy.";
  if (e?.code === "same_password")
    return "Choose a password different from your current password.";
  if (e?.code === "captcha_failed")
    return "Security check failed. Complete a fresh CAPTCHA and try again.";
  if (e?.code === "session_not_found" || e?.code === "session_expired")
    return "Your session has expired. Sign in again, or use Forgot password.";
  if (e?.code === "23505")
    return "This record already exists. Check your registration number or saved item.";
  if (e?.code === "P0001") return e.message || "This action is unavailable.";
  if (e?.code === "otp_expired")
    return "This code is incorrect or expired. Request a new code and try again.";
  if (
    e?.code === "over_email_send_rate_limit" ||
    e?.code === "over_request_rate_limit"
  )
    return "Too many attempts. Please wait before trying again.";
  if (e?.message?.includes("fetch"))
    return "Connection failed. Check your internet and try again.";
  if (error instanceof Error && error.name === "UserError")
    return error.message;
  return "We could not complete that action. Please try again. If it continues, contact the administrator.";
}
export function userError(message: string) {
  const e = new Error(message);
  e.name = "UserError";
  return e;
}

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { passwordSchema, savePassword, type PasswordValues } from "../lib/auth";
import { supabase, errorMessage } from "../lib/supabase";
import { safeReturnPath } from "../lib/utils";
import { Field, ErrorBox } from "../components/Common";
import { Button } from "../components/ui/button";

export function Password() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const destination = auth.profile
    ? safeReturnPath(params.get("next"))
    : "/onboarding";
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);
  const [needsNonce, setNeedsNonce] = useState(false);
  const [nonce, setNonce] = useState("");
  const [nonceSent, setNonceSent] = useState(false);
  const [sending, setSending] = useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmation: "" },
  });
  return (
    <div className="container-page py-12">
      <div className="panel mx-auto max-w-lg">
        <LockKeyhole className="text-brand mb-5" size={32} />
        <h1 className="text-2xl font-bold">
          {saved ? "Your password is saved" : "Set or change your password"}
        </h1>
        {saved ? (
          <div className="mt-5 space-y-5">
            <p role="status" className="text-stone-600">
              Next time, sign in with your university email and this password.
              Your existing profile, listings and account role stay the same.
            </p>
            <Button asChild className="w-full">
              <Link to={destination}>
                {auth.profile
                  ? "Continue to your account"
                  : "Complete your profile"}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-3 mb-6 text-sm text-stone-500">
              For {auth.session?.user.email}. Use a unique password or
              passphrase with at least 12 characters.
            </p>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                setError("");
                try {
                  await savePassword(values, needsNonce ? nonce : undefined);
                  form.reset();
                  setNonce("");
                  setSaved(true);
                } catch (error) {
                  const code = (error as { code?: string }).code;
                  if (
                    code === "reauthentication_needed" ||
                    code === "reauthentication_not_valid"
                  ) {
                    setNeedsNonce(true);
                    setError(
                      "Confirm this password change with a fresh email verification code.",
                    );
                  } else setError(errorMessage(error));
                }
              })}
            >
              <Field
                label="New password"
                error={form.formState.errors.password?.message}
              >
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  {...form.register("password")}
                />
              </Field>
              <Field
                label="Confirm password"
                error={form.formState.errors.confirmation?.message}
              >
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  {...form.register("confirmation")}
                />
              </Field>
              <button
                type="button"
                className="text-xs underline text-stone-600"
                onClick={() => setVisible(!visible)}
                aria-pressed={visible}
              >
                {visible ? "Hide passwords" : "Show passwords"}
              </button>
              {needsNonce && (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-sm">
                    Confirm your identity with a fresh email code.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sending || nonceSent}
                    onClick={async () => {
                      setSending(true);
                      setError("");
                      try {
                        const { error } = await supabase.auth.reauthenticate();
                        if (error) throw error;
                        setNonceSent(true);
                      } catch (error) {
                        setError(errorMessage(error));
                      } finally {
                        setSending(false);
                      }
                    }}
                  >
                    {nonceSent
                      ? "Code sent — check your email"
                      : sending
                        ? "Sending…"
                        : "Send confirmation code"}
                  </Button>
                  <Field label="Email confirmation code">
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6,10}"
                      required
                      value={nonce}
                      onChange={(e) =>
                        setNonce(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </Field>
                  <p className="text-xs text-stone-500">
                    If this code expires, sign out and use Forgot password to
                    start a fresh recovery.
                  </p>
                </div>
              )}
              {error && <ErrorBox error={error} />}
              <Button
                className="w-full"
                disabled={form.formState.isSubmitting || (needsNonce && !nonce)}
              >
                {form.formState.isSubmitting ? "Saving…" : "Save password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

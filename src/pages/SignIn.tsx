import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { configured, siteKey, errorMessage } from "../lib/supabase";
import { safeReturnPath } from "../lib/utils";
import {
  authDestination,
  sendEmailCode,
  verifyEmailCode,
  signInWithPassword,
} from "../lib/auth";
import { Button } from "../components/ui/button";
import { ErrorBox, Field, Loading } from "../components/Common";
import { useAuth } from "../hooks/useAuth";

type Mode = "signin" | "signup" | "recovery";
export function SignIn({ mode = "signin" }: { mode?: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const widget = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = useAuth();
  const next = safeReturnPath(params.get("next"));
  const suffix = `?next=${encodeURIComponent(next)}`;
  useEffect(() => {
    if (auth.session && !auth.loading && !auth.error) {
      navigate(authDestination(mode, !!auth.profile, next), { replace: true });
    }
  }, [
    auth.session,
    auth.loading,
    auth.error,
    auth.profile,
    mode,
    next,
    navigate,
  ]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode() {
    if (cooldown || busy || mode === "signin") return;
    setBusy(true);
    setError("");
    try {
      const address = await sendEmailCode(sentTo || email, captcha, mode);
      setSentTo(address);
      setCode("");
      setCooldown(60);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setCaptcha("");
      widget.current?.reset();
      setBusy(false);
    }
  }

  if (auth.loading || (auth.session && !auth.error))
    return (
      <div className="container-page py-14">
        <Loading />
      </div>
    );
  if (auth.error)
    return (
      <div className="container-page py-14">
        <ErrorBox error={auth.error} retry={() => void auth.refresh()} />
      </div>
    );
  return (
    <div className="container-page py-14">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-white md:grid-cols-2">
        <div className="bg-ink text-white p-9 flex flex-col justify-between">
          <ShieldCheck size={42} className="text-lime-200" />
          <div className="mt-14">
            <p className="text-xs uppercase tracking-widest text-lime-200">
              YOUR CAMPUS CIRCLE
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              A familiar place.
              <br />A better exchange.
            </h1>
            <p className="mt-5 text-white/70 leading-relaxed">
              Verify your university email when you join. Come back with your
              email and password.
            </p>
          </div>
          <p className="mt-14 text-xs text-white/60">
            Email verification confirms email access, not personal identity.
          </p>
        </div>
        <div className="p-7 sm:p-9">
          <h2 className="text-2xl font-bold">
            {sentTo
              ? "Check your inbox"
              : mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Join your campus"
                  : "Recover your account"}
          </h2>
          <p className="mt-3 mb-7 text-sm text-stone-500">
            {sentTo
              ? mode === "recovery"
                ? `If ${sentTo} has an eligible account, a code has been requested. Enter the latest code below.`
                : `Enter the verification code sent to ${sentTo}.`
              : mode === "signin"
                ? "Sign in with your university email and password."
                : mode === "signup"
                  ? "Verify your university email, then choose your password."
                  : "Verify your existing university email to choose a new password. This will not create a new account."}
          </p>
          {!configured ? (
            <ErrorBox error="Add the Supabase URL and publishable key to .env.local, then restart the app." />
          ) : !siteKey ? (
            <ErrorBox error="Add your Turnstile site key and configure CAPTCHA in Supabase." />
          ) : (
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (mode !== "signin" && !sentTo) {
                  await requestCode();
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  if (mode === "signin") {
                    await signInWithPassword(email, password, captcha);
                    setPassword("");
                  } else await verifyEmailCode(sentTo, code);
                  // AuthProvider owns session/profile hydration; the effect above redirects once ready.
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  setBusy(false);
                  if (mode === "signin") {
                    setCaptcha("");
                    widget.current?.reset();
                  }
                }
              }}
            >
              {!sentTo ? (
                <Field label="University email">
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@your-university.edu.pk"
                  />
                </Field>
              ) : (
                <Field label="Verification code">
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={10}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[.3em]"
                  />
                </Field>
              )}
              {mode === "signin" && (
                <div>
                  <Field label="Password">
                    <input
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                  <div className="mt-2 flex justify-between gap-3 text-xs">
                    <button
                      type="button"
                      className="text-stone-600 underline"
                      onClick={() => setVisible(!visible)}
                      aria-pressed={visible}
                    >
                      {visible ? "Hide password" : "Show password"}
                    </button>
                    <Link
                      to={`/forgot-password${suffix}`}
                      className="text-brand underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
              )}
              <Turnstile
                ref={widget}
                siteKey={siteKey}
                onSuccess={setCaptcha}
                onExpire={() => setCaptcha("")}
                onError={() => {
                  setCaptcha("");
                  setError("Security check failed. Reload and try again.");
                }}
              />
              {error && <ErrorBox error={error} />}
              <Button
                className="w-full"
                disabled={
                  busy ||
                  (!sentTo && !captcha) ||
                  (!sentTo && mode !== "signin" && cooldown > 0)
                }
              >
                {busy
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : sentTo
                      ? "Verify & continue"
                      : "Send verification code"}
                <ArrowRight size={16} />
              </Button>
              {sentTo && (
                <div className="space-y-3 text-sm">
                  <button
                    type="button"
                    className="text-brand disabled:text-stone-400"
                    disabled={busy || cooldown > 0 || !captcha}
                    onClick={() => void requestCode()}
                  >
                    {cooldown
                      ? `Resend available in ${cooldown}s`
                      : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="block text-stone-500"
                    disabled={busy}
                    onClick={() => {
                      setSentTo("");
                      setCode("");
                      setError("");
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
              <div className="border-t pt-4 text-sm space-y-3">
                {mode === "signin" ? (
                  <>
                    <p>
                      New here?{" "}
                      <Link
                        to={`/signup${suffix}`}
                        className="font-semibold text-brand underline"
                      >
                        Create account
                      </Link>
                    </p>
                    <p className="text-xs text-stone-500">
                      Previously used email codes?{" "}
                      <Link
                        to={`/forgot-password${suffix}`}
                        className="text-brand underline"
                      >
                        Verify your email and set a password
                      </Link>
                      .
                    </p>
                  </>
                ) : (
                  <p>
                    Already have a password?{" "}
                    <Link
                      to={`/signin${suffix}`}
                      className="font-semibold text-brand underline"
                    >
                      Sign in
                    </Link>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

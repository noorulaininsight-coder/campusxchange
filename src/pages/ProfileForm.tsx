import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { profileSchema, type ProfileForm as Values } from "../lib/validation";
import { config, rpc } from "../lib/api";
import { supabase, errorMessage } from "../lib/supabase";
import { compressImage } from "../lib/images";
import { Field, ErrorBox, Photo } from "../components/Common";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
export function ProfileForm() {
  const auth = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [success, setSuccess] = useState("");
  const [deactivate, setDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: auth.profile?.full_name || "",
      department: auth.profile?.department || "",
      registration_number: auth.account?.registration_number || "",
      graduation_year:
        auth.account?.graduation_year || new Date().getFullYear() + 2,
      phone_number: "",
    },
  });
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
  });
  const domains = useQuery({
    queryKey: ["config", "allowed_email_domains"],
    queryFn: () => config("allowed_email_domains"),
  });
  const domain = auth.session?.user.email?.split("@")[1];
  const campus =
    auth.account?.campus_id ||
    domains.data?.find((x) => x.domain === domain)?.campus_id;
  useEffect(() => {
    if (!auth.profile) return;
    supabase
      .from("user_private_contacts")
      .select("phone_number")
      .eq("user_id", auth.session!.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error));
        if (data) form.setValue("phone_number", data.phone_number);
      });
  }, [auth.profile, auth.session, form]);
  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">YOUR STUDENT PROFILE</p>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link to="/password?next=/settings">Set / change password</Link>
          </Button>
        </div>
        <h1 className="mt-3 text-3xl font-bold">
          {auth.profile ? "Make yourself at home." : "A quick introduction."}
        </h1>
        <p className="mt-3 text-stone-500">
          Your email is verified. Add a few details so your campus knows who
          they’re exchanging with.
        </p>
        <form
          className="mt-7 space-y-5 panel"
          onSubmit={form.handleSubmit(async (v) => {
            setError("");
            setSuccess("");
            try {
              let path = auth.profile?.avatar_path || null;
              if (photo) {
                const blob = await compressImage(photo);
                path = `${auth.session!.user.id}/avatar.webp`;
                const { error } = await supabase.storage
                  .from("avatars")
                  .upload(path, blob, {
                    upsert: true,
                    contentType: "image/webp",
                    cacheControl: "0",
                  });
                if (error) throw error;
              }
              await rpc("save_profile", {
                p_name: v.full_name,
                p_department: v.department,
                p_registration: v.registration_number,
                p_year: v.graduation_year,
                p_phone: v.phone_number,
                p_avatar: path,
              });
              await auth.refresh();
              await qc.invalidateQueries({ queryKey: ["image"] });
              if (!auth.profile) navigate("/dashboard");
              else setSuccess("Profile updated.");
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          <Field label="University campus (assigned from verified email)">
            <input
              disabled
              value={
                campuses.data?.find((x) => x.id === campus)?.name ||
                "Resolving your university campus…"
              }
            />
          </Field>
          <Field
            label="Full name"
            error={form.formState.errors.full_name?.message}
          >
            <input autoComplete="name" {...form.register("full_name")} />
          </Field>
          <Field
            label="Department / degree program"
            error={form.formState.errors.department?.message}
          >
            <input
              {...form.register("department")}
              placeholder="e.g. BS Computer Science"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Registration number (private)"
              error={form.formState.errors.registration_number?.message}
            >
              <input {...form.register("registration_number")} />
            </Field>
            <Field
              label="Graduation year (private)"
              error={form.formState.errors.graduation_year?.message}
            >
              <input type="number" {...form.register("graduation_year")} />
            </Field>
          </div>
          <Field
            label="WhatsApp / phone number"
            error={form.formState.errors.phone_number?.message}
          >
            <input
              autoComplete="tel"
              {...form.register("phone_number")}
              placeholder="+923001234567"
            />
          </Field>
          <p className="text-xs text-stone-500">
            Your number stays private unless you enable WhatsApp or Call on a
            listing. Administrators can access it for moderation.
          </p>
          <div className="flex items-center gap-4">
            <Photo
              path={auth.profile?.avatar_path}
              bucket="avatars"
              alt="Your profile photo"
              className="h-16 w-16 rounded-full object-cover"
            />
            <Field label="Profile photo (optional)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              />
            </Field>
          </div>
          {error && <ErrorBox error={error} />}{" "}
          {success && (
            <p role="status" className="text-brand">
              {success}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save profile"}
          </Button>
        </form>
        {auth.profile && auth.account?.role !== "ADMIN" && (
          <button
            className="mt-7 text-sm text-red-700 underline"
            onClick={() => setDeactivate(true)}
          >
            Deactivate my account
          </button>
        )}
      </div>
      <Modal
        open={deactivate}
        onClose={() => setDeactivate(false)}
        title="Deactivate your account?"
        description="Your listings and public profile will be hidden. An administrator must reactivate your account if you return."
      >
        {error && <ErrorBox error={error} />}
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await rpc("deactivate_account");
              await auth.refresh();
              setDeactivate(false);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Deactivate account
        </Button>
      </Modal>
    </div>
  );
}

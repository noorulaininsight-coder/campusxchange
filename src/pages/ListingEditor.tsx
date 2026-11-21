import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  listingSchema,
  listingPayload,
  type ListingForm,
} from "../lib/validation";
import { config, getListing, rpc } from "../lib/api";
import { supabase, errorMessage, userError } from "../lib/supabase";
import { compressImage } from "../lib/images";
import { Field, ErrorBox, Loading, Photo } from "../components/Common";
import { Button } from "../components/ui/button";
interface ImageItem {
  path?: string;
  blob?: Blob;
  preview?: string;
}
export function ListingEditor() {
  const { id } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [images, setImages] = useState<ImageItem[]>([]);
  const previews = useRef<string[]>([]);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [savedId, setSavedId] = useState(id);
  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      type: "SALE",
      contact_mode: "CHAT",
      title: "",
      description: "",
      category: "",
      condition: "USED",
      amount: 0,
      deposit: "",
      need_type: "BUY",
      preferred_meetup_spot: "",
    },
  });
  useEffect(() => {
    setSavedId(id);
    if (!id) {
      form.reset({
        type: "SALE",
        contact_mode: "CHAT",
        title: "",
        description: "",
        category: "",
        condition: "USED",
        amount: 0,
        deposit: "",
        need_type: "BUY",
        preferred_meetup_spot: "",
      });
      setImages([]);
    }
    setError("");
  }, [id, form]);
  const type = form.watch("type");
  const cats = useQuery({
    queryKey: ["config", "categories"],
    queryFn: () => config("categories"),
  });
  const spots = useQuery({
    queryKey: ["config", "meetup_spots"],
    queryFn: () => config("meetup_spots"),
  });
  const q = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });
  useEffect(() => {
    if (q.data) {
      const l = q.data;
      form.reset({
        type: l.type,
        contact_mode: l.contact_mode || "CHAT",
        title: l.title,
        description: l.description,
        category: l.category,
        condition: l.condition || "USED",
        amount: l.amount,
        deposit: l.deposit ?? "",
        need_type: (l.need_type || "BUY") as ListingForm["need_type"],
        preferred_meetup_spot: l.preferred_meetup_spot,
      });
      setImages(l.image_paths.map((path) => ({ path })));
    }
  }, [q.data, form]);
  useEffect(
    () => () => {
      previews.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  if (id && q.isPending)
    return (
      <div className="container-page py-8">
        <Loading />
      </div>
    );
  if (
    id &&
    (q.error ||
      q.data?.user_id !== auth.session?.user.id ||
      q.data?.status !== "ACTIVE")
  )
    return (
      <div className="container-page py-8">
        <ErrorBox error="Only your own active listings can be edited." />
      </div>
    );
  async function submit(v: ListingForm) {
    setError("");
    let lid = savedId;
    const uploaded: string[] = [];
    let attached = false;
    try {
      if (!lid) {
        lid = await rpc<string>("save_listing", {
          p_data: listingPayload(v, []),
        });
        setSavedId(lid);
      }
      const retained = images.flatMap((x) => (x.path ? [x.path] : []));
      const free = [1, 2, 3]
        .map((n) => `${auth.session!.user.id}/${lid}/${n}.webp`)
        .filter((p) => !retained.includes(p));
      const paths: string[] = [];
      for (const img of v.type === "REQUEST" ? [] : images) {
        if (img.path) {
          paths.push(img.path);
          continue;
        }
        const path = free.shift();
        if (!path || !img.blob)
          throw userError("Too many images. Remove an image and try again.");
        const { error } = await supabase.storage
          .from("listing-images")
          .upload(path, img.blob, {
            upsert: true,
            contentType: "image/webp",
            cacheControl: "0",
          });
        if (error) throw error;
        if (!(q.data?.image_paths || []).includes(path)) uploaded.push(path);
        paths.push(path);
      }
      await rpc("save_listing", {
        p_id: lid,
        p_data: listingPayload(v, paths),
      });
      attached = true;
      const unused = (q.data?.image_paths || []).filter(
        (p) => !paths.includes(p),
      );
      if (unused.length) {
        const { error } = await supabase.storage
          .from("listing-images")
          .remove(unused);
        if (error)
          console.warn("Unused images will be cleaned by retention job.");
      }
      await qc.invalidateQueries({ queryKey: ["image"] });
      await qc.invalidateQueries({ queryKey: ["feed"] });
      await qc.invalidateQueries({ queryKey: ["listing", lid] });
      await qc.invalidateQueries({ queryKey: ["mine"] });
      navigate(`/listing/${lid}`);
    } catch (e) {
      if (!attached && uploaded.length)
        await supabase.storage.from("listing-images").remove(uploaded);
      setError(
        `${errorMessage(e)}${lid && !id ? " Your listing was created; retry here to finish saving images." : ""}`,
      );
    }
  }
  const errors = form.formState.errors;
  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">MAKE ROOM FOR SOMETHING NEW</p>
        <h1 className="mt-3 text-3xl font-bold">
          {id ? "Edit your listing." : "What are you sharing?"}
        </h1>
        <p className="mt-3 text-stone-500">
          A few details now. A good campus connection next.
        </p>
        <form
          className="mt-7 panel space-y-6"
          onSubmit={form.handleSubmit(submit)}
        >
          <div className="grid grid-cols-3 gap-2">
            {(["SALE", "RENT", "REQUEST"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={!!savedId}
                className={`rounded-xl border px-3 py-4 text-sm font-semibold ${type === t ? "bg-brand/10 border-brand text-brand" : ""}`}
                onClick={() => form.setValue("type", t)}
              >
                {t === "SALE"
                  ? "For sale"
                  : t === "RENT"
                    ? "For rent"
                    : "Looking for"}
              </button>
            ))}
          </div>
          <Field
            label="How can students contact you?"
            error={errors.contact_mode?.message}
          >
            <select {...form.register("contact_mode")}>
              <option value="CHAT">In-app chat only — hide my number</option>
              <option value="WHATSAPP">Chat + WhatsApp</option>
              <option value="CALL">Chat + Call</option>
              <option value="BOTH">Chat + WhatsApp + Call</option>
            </select>
            <p className="mt-2 text-xs text-stone-500">
              WhatsApp and Call share the phone number saved in your profile
              with signed-in students. WhatsApp also reveals your number. Choose
              chat only to keep it private.
            </p>
          </Field>
          <Field label="Listing title" error={errors.title?.message}>
            <input
              {...form.register("title")}
              placeholder="e.g. Scientific calculator, ready for next semester"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" error={errors.category?.message}>
              <select {...form.register("category")}>
                <option value="">Choose a category</option>
                {cats.data
                  ?.filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            {type !== "REQUEST" ? (
              <Field label="Condition" error={errors.condition?.message}>
                <select {...form.register("condition")}>
                  {["NEW", "LIKE_NEW", "USED", "FAIR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="I need to">
                <select {...form.register("need_type")}>
                  <option value="BUY">Buy</option>
                  <option value="RENT">Rent</option>
                  <option value="EITHER">Buy or rent</option>
                </select>
              </Field>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={
                type === "SALE"
                  ? "Price (Rs.)"
                  : type === "RENT"
                    ? "Daily rental rate (Rs.)"
                    : "Offered budget (Rs.)"
              }
              error={errors.amount?.message}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("amount")}
              />
            </Field>
            {type === "RENT" && (
              <Field
                label="Suggested deposit (optional, Rs.)"
                error={errors.deposit?.message}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("deposit")}
                />
              </Field>
            )}
          </div>
          <Field
            label="Tell students about it"
            error={errors.description?.message}
          >
            <textarea
              rows={5}
              {...form.register("description")}
              placeholder="Include useful details, any wear, and what’s included."
            />
          </Field>
          <Field
            label="Preferred campus meetup spot"
            error={errors.preferred_meetup_spot?.message}
          >
            <input list="meetups" {...form.register("preferred_meetup_spot")} />
            <datalist id="meetups">
              {spots.data
                ?.filter((s) => s.campus_id === auth.profile?.campus_id)
                .map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
            </datalist>
          </Field>
          {type !== "REQUEST" && (
            <div>
              <p className="text-sm font-medium">Photos · {images.length}/3</p>
              <p className="mt-1 text-xs text-stone-500">
                JPEG, PNG or WebP. We compress photos and remove metadata before
                uploading.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <div key={img.path || img.preview} className="relative w-32">
                    {img.preview ? (
                      <img
                        src={img.preview}
                        alt={`Upload preview ${i + 1}`}
                        className="h-28 w-32 rounded-xl object-cover"
                      />
                    ) : (
                      <Photo
                        path={img.path}
                        alt={`Listing image ${i + 1}`}
                        className="h-28 w-32 rounded-xl object-cover"
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-white p-1"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() =>
                        setImages(images.filter((_, n) => n !== i))
                      }
                    >
                      <X size={14} />
                    </button>
                    <div className="mt-1 flex justify-between">
                      <button
                        type="button"
                        aria-label="Move image left"
                        disabled={!i}
                        onClick={() => {
                          const a = [...images];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          setImages(a);
                        }}
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move image right"
                        disabled={i === images.length - 1}
                        onClick={() => {
                          const a = [...images];
                          [a[i + 1], a[i]] = [a[i], a[i + 1]];
                          setImages(a);
                        }}
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {images.length < 3 && (
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-brand">
                  <ImagePlus size={22} />
                  {processing ? "Preparing images…" : "Add up to 3 photos"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={processing}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = "";
                      if (files.length + images.length > 3) {
                        setError("Choose at most three images.");
                        return;
                      }
                      setProcessing(true);
                      setError("");
                      try {
                        const prepared = await Promise.all(
                          files.map(async (file) => {
                            const blob = await compressImage(file);
                            const preview = URL.createObjectURL(blob);
                            previews.current.push(preview);
                            return { blob, preview };
                          }),
                        );
                        setImages([...images, ...prepared]);
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setProcessing(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )}
          {type === "RENT" && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-stone-600">
              Students arrange deposits and payments directly. CampusXchange
              does not handle money or rental bookings.
            </p>
          )}
          {error && <ErrorBox error={error} />}
          <div className="flex items-center justify-between gap-4 border-t pt-5">
            <p className="text-xs text-stone-500">
              By posting, you agree to our marketplace guidelines.
            </p>
            <Button disabled={form.formState.isSubmitting || processing}>
              {form.formState.isSubmitting
                ? "Saving…"
                : id || savedId
                  ? "Save changes"
                  : "Publish listing"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { BadgeCheck, PackageOpen, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { signedImage } from "../lib/images";
import { rpc } from "../lib/api";
import { errorMessage } from "../lib/supabase";
import { Button } from "./ui/button";
export function Verified({ userId }: { userId?: string }) {
  const q = useQuery({
    queryKey: ["verification", userId],
    enabled: !!userId,
    queryFn: () => rpc<boolean>("profile_is_verified", { p_id: userId }),
    staleTime: 30000,
  });
  if (userId && q.data !== true) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700"
      title="University email verified"
    >
      <BadgeCheck size={15} />
      Verified Student
    </span>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error && (
        <span role="alert" className="block text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-3"
    >
      <AlertCircle size={20} className="shrink-0" />
      <div>
        {typeof error === "string" ? error : errorMessage(error)}
        {retry && (
          <Button className="mt-3 block" variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Check back soon or be the first to post.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <PackageOpen className="mx-auto mb-4 text-brand" size={36} />
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 mb-5 max-w-md text-stone-500">{text}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div
      aria-label="Loading"
      role="status"
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[1, 2, 3].map((x) => (
        <div key={x} className="h-64 animate-pulse rounded-2xl bg-stone-200" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function Photo({
  path,
  bucket = "listing-images",
  alt,
  className = "",
}: {
  path?: string | null;
  bucket?: string;
  alt: string;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ["image", bucket, path],
    enabled: !!path,
    queryFn: () => signedImage(path!, bucket),
    staleTime: 240000,
    retry: 1,
  });
  return q.data ? (
    <img src={q.data} alt={alt} className={className} loading="lazy" />
  ) : (
    <div
      className={`${className} flex items-center justify-center bg-[#edf0e5] text-brand/40`}
      role="img"
      aria-label={alt}
    >
      <PackageOpen size={36} />
    </div>
  );
}
export function Safety() {
  return (
    <aside className="rounded-xl bg-[#f3f3e5] p-4 text-sm leading-relaxed text-stone-600">
      <strong className="block text-ink mb-1">
        A little care goes a long way.
      </strong>
      Meet inside campus during active hours, at the library, cafeteria or
      student center. Inspect the item before payment. CampusXchange does not
      guarantee transactions.
    </aside>
  );
}

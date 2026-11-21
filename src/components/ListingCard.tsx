import { Link, useNavigate } from "react-router-dom";
import { Bookmark, MapPin, ArrowUpRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Photo, Verified } from "./Common";
import { useAuth } from "../hooks/useAuth";
import { supabase, errorMessage } from "../lib/supabase";
import { amountLabel, label, relativeTime } from "../lib/utils";
import type { Listing } from "../lib/types";
export function SaveButton({ id }: { id: string }) {
  const { session, account } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["saved-ids", session?.user.id],
    enabled: !!session && account?.status === "ACTIVE",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("listing_id");
      if (error) throw error;
      return data.map((x) => x.listing_id as string);
    },
  });
  const saved = q.data?.includes(id);
  return (
    <div>
      <button
        aria-label={saved ? "Unsave listing" : "Save listing"}
        aria-pressed={!!saved}
        disabled={busy}
        title={error || undefined}
        className={`rounded-full p-2.5 shadow-sm ${saved ? "bg-brand text-white" : "bg-white text-ink"}`}
        onClick={async () => {
          if (!session) {
            navigate("/signin");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = saved
              ? await supabase
                  .from("wishlist")
                  .delete()
                  .eq("user_id", session.user.id)
                  .eq("listing_id", id)
              : await supabase
                  .from("wishlist")
                  .insert({ user_id: session.user.id, listing_id: id });
            if (result.error) throw result.error;
            await qc.invalidateQueries({ queryKey: ["saved-ids"] });
            await qc.invalidateQueries({ queryKey: ["saved-listings"] });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      {error && (
        <span
          role="alert"
          className="block max-w-48 bg-white p-2 text-xs text-red-700"
        >
          {error}
        </span>
      )}
    </div>
  );
}
export function ListingCard({
  listing: l,
  campus = "Campus",
  category,
}: {
  listing: Listing;
  campus?: string;
  category?: string;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative">
        <Link to={`/listing/${l.id}`}>
          <Photo
            path={l.image_paths[0]}
            alt={l.title}
            className="aspect-[4/3] w-full object-cover"
          />
        </Link>
        <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
          {l.type === "RENT"
            ? "For rent"
            : l.type === "REQUEST"
              ? "Looking for"
              : label(l.condition || "For sale")}
        </span>
        <div className="absolute right-3 top-3">
          <SaveButton id={l.id} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between text-xs text-stone-500">
          <span>{category || label(l.category.replaceAll("-", "_"))}</span>
          <span>{relativeTime(l.created_at)}</span>
        </div>
        <Link
          to={`/listing/${l.id}`}
          className="mt-2 flex items-center justify-between gap-2 font-semibold text-ink"
        >
          <h3 className="truncate">{l.title}</h3>
          <ArrowUpRight size={16} />
        </Link>
        <p className="mt-2 text-lg font-bold text-brand">{amountLabel(l)}</p>
        <div className="mt-4 border-t pt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-stone-500">
            <MapPin size={12} />
            {campus}
          </span>
          <Verified userId={l.user_id} />
        </div>
      </div>
    </article>
  );
}

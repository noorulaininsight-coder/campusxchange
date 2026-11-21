import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteListing } from "../components/DeleteListing";
import { Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase, errorMessage } from "../lib/supabase";
import { rpc, config } from "../lib/api";
import type { Listing } from "../lib/types";
import { amountLabel, resolutions, label } from "../lib/utils";
import {
  Photo,
  Verified,
  Empty,
  ErrorBox,
  Loading,
  Field,
} from "../components/Common";
import { ListingCard } from "../components/ListingCard";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
export function Dashboard() {
  const auth = useAuth();
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
  });
  const location = useLocation();
  const savedOnly = location.pathname === "/saved";
  const [tab, setTab] = useState("listings");
  const selected = savedOnly ? "saved" : tab;
  const qc = useQueryClient();
  const [resolving, setResolving] = useState<Listing | null>(null);
  const [status, setStatus] = useState("COMPLETED");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const mine = useQuery({
    queryKey: ["mine", auth.session?.user.id, selected, page],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select("*", { count: "exact" })
        .eq("user_id", auth.session!.user.id)
        .is("deleted_at", null);
      query =
        selected === "requests"
          ? query.eq("type", "REQUEST")
          : query.neq("type", "REQUEST");
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(page * 30, page * 30 + 29);
      if (error) throw error;
      return { items: data as Listing[], count: count || 0 };
    },
  });
  const removed = useQuery({
    queryKey: ["removal-notices", auth.session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,deletion_reason")
        .eq("user_id", auth.session!.user.id)
        .eq("status", "REMOVED_BY_ADMIN")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
  const count = useQuery({
    queryKey: ["active-count", auth.session?.user.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.session!.user.id)
        .eq("status", "ACTIVE");
      if (error) throw error;
      return count || 0;
    },
  });
  const saved = useQuery({
    queryKey: ["saved-listings", auth.session?.user.id, page],
    enabled: selected === "saved",
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("wishlist")
        .select("listings(*,profiles(*))", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * 30, page * 30 + 29);
      if (error) throw error;
      return {
        items: data
          .map((x) => x.listings as unknown as Listing)
          .filter(Boolean),
        count: count || 0,
      };
    },
  });
  const items =
    mine.data?.items.filter((l) =>
      selected === "requests" ? l.type === "REQUEST" : l.type !== "REQUEST",
    ) || [];
  function open(l: Listing, s: string) {
    setResolving(l);
    setStatus(s);
    setReason("");
    setComment("");
    setError("");
  }
  return (
    <div className="container-page py-10">
      <div className="panel flex flex-wrap items-center justify-between gap-5">
        <div className="flex gap-4 items-center">
          <Photo
            path={auth.profile?.avatar_path}
            bucket="avatars"
            alt="Your profile"
            className="h-20 w-20 rounded-full object-cover"
          />
          <div>
            <p className="eyebrow">YOUR CAMPUS CORNER</p>
            <h1 className="mt-2 text-2xl font-bold">
              {auth.profile?.full_name}
            </h1>
            <p className="text-sm text-stone-500">
              {auth.profile?.department} ·{" "}
              {
                campuses.data?.find((c) => c.id === auth.profile?.campus_id)
                  ?.name
              }{" "}
              · {count.data ?? "…"} active listings
            </p>
            <Verified />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings">Edit profile</Link>
          </Button>
          <Button asChild>
            <Link to="/post">
              <Plus size={16} />
              Post listing
            </Link>
          </Button>
        </div>
      </div>
      {!!removed.data?.length && (
        <div className="panel mt-5">
          <h2 className="font-semibold">Recent admin removals</h2>
          {removed.data.map((l) => (
            <p key={l.id} className="mt-2 text-sm">
              <strong>{l.title}</strong>: {l.deletion_reason}
            </p>
          ))}
        </div>
      )}
      <div className="mt-8 mb-6 flex gap-6 border-b">
        {[
          ["listings", "My listings"],
          ["requests", "My requests"],
          ["saved", "Saved items"],
        ].map(([t, name]) =>
          savedOnly ? (
            t === "saved" && (
              <h2 key={t} className="pb-4 font-semibold">
                Saved items
              </h2>
            )
          ) : (
            <button
              key={t}
              className={`pb-4 text-sm font-semibold ${selected === t ? "border-b-2 border-brand text-brand" : "text-stone-500"}`}
              onClick={() => {
                setTab(t);
                setPage(0);
              }}
            >
              {name}
            </button>
          ),
        )}
      </div>
      {selected === "saved" ? (
        saved.isPending ? (
          <Loading />
        ) : saved.error ? (
          <ErrorBox error={saved.error} />
        ) : saved.data?.items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.data.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <Empty
            title="Keep your good finds here"
            text="Save listings from the marketplace to find them later. Unavailable listings are hidden."
          />
        )
      ) : mine.isPending ? (
        <Loading />
      ) : mine.error ? (
        <ErrorBox error={mine.error} />
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((l) => (
            <article
              key={l.id}
              className="panel flex flex-col gap-5 sm:flex-row sm:items-center"
            >
              <Photo
                path={l.image_paths[0]}
                alt={l.title}
                className="h-24 w-28 shrink-0 rounded-xl object-cover"
              />
              <div className="flex-1">
                <Link to={`/listing/${l.id}`} className="font-semibold">
                  {l.title}
                </Link>
                <p className="mt-1 text-brand font-semibold">
                  {amountLabel(l)}
                </p>
                <span className="chip mt-2 inline-block">
                  {label(l.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <DeleteListing id={l.id} />
                <Button asChild variant="outline">
                  <Link to={`/listing/${l.id}`}>View</Link>
                </Button>
                {l.status === "ACTIVE" && (
                  <>
                    <Button asChild variant="outline">
                      <Link to={`/listing/${l.id}/edit`}>Edit</Link>
                    </Button>
                    <Button onClick={() => open(l, "COMPLETED")}>
                      {l.type === "REQUEST" ? "Mark fulfilled" : "Complete"}
                    </Button>
                    <Button variant="ghost" onClick={() => open(l, "ARCHIVED")}>
                      Archive
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Your next exchange starts here"
          text="Post an item or a request and connect with your campus."
        >
          <Button asChild>
            <Link to="/post">Create a listing</Link>
          </Button>
        </Empty>
      )}
      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={
            (page + 1) * 30 >=
            (selected === "saved"
              ? saved.data?.count || 0
              : mine.data?.count || 0)
          }
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title={
          status === "COMPLETED"
            ? "How did your exchange go?"
            : "Why are you archiving this listing?"
        }
        description="Your answer helps us understand what’s useful to students. This closes the listing and removes it from the public feed."
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("resolve_listing", {
                p_id: resolving!.id,
                p_status: status,
                p_reason: reason,
                p_comments: comment || null,
              });
              await qc.invalidateQueries({ queryKey: ["mine"] });
              await qc.invalidateQueries({ queryKey: ["active-count"] });
              await qc.invalidateQueries({ queryKey: ["feed"] });
              setResolving(null);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Resolution reason">
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Choose a reason</option>
              {resolving &&
                resolutions[resolving.type].map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
            </select>
          </Field>
          {reason === "OTHER" && (
            <Field label="Comment (optional)">
              <textarea
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
          )}
          {error && <ErrorBox error={error} />}
          <Button disabled={busy || !reason}>
            {busy ? "Saving…" : "Confirm & close listing"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

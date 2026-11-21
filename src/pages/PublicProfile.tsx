import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase, configured } from "../lib/supabase";
import { config } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import type { Profile, Listing } from "../lib/types";
import {
  Photo,
  Verified,
  Empty,
  Loading,
  ErrorBox,
} from "../components/Common";
import { ListingCard } from "../components/ListingCard";
import { ReportDialog } from "../components/ReportDialog";
import { Button } from "../components/ui/button";
export function PublicProfile() {
  const { id } = useParams();
  const auth = useAuth();
  const [report, setReport] = useState(false);
  const [page, setPage] = useState(0);
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
    enabled: configured,
  });
  const q = useQuery({
    queryKey: ["public-profile", id],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
  const items = useQuery({
    queryKey: ["profile-listings", id, page],
    enabled: configured,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("listings")
        .select("*", { count: "exact" })
        .eq("user_id", id!)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .range(page * 12, page * 12 + 11);
      if (error) throw error;
      return { items: data as Listing[], count: count || 0 };
    },
  });
  if (q.isPending && configured)
    return (
      <div className="container-page py-8">
        <Loading />
      </div>
    );
  if (q.error || !q.data)
    return (
      <div className="container-page py-8">
        <Empty title="Profile unavailable" />
      </div>
    );
  const p = q.data;
  return (
    <div className="container-page py-10">
      <div className="panel flex flex-wrap items-center gap-5">
        <Photo
          path={p.avatar_path}
          bucket="avatars"
          alt={p.full_name}
          className="h-24 w-24 rounded-full object-cover"
        />
        <div>
          <h1 className="text-3xl font-bold">{p.full_name}</h1>
          <p className="mt-2 text-stone-500">
            {p.department} ·{" "}
            {campuses.data?.find((c) => c.id === p.campus_id)?.name}
          </p>
          <Verified userId={p.id} />
          <p className="mt-2 text-xs text-stone-500">
            University email verified{" "}
            {new Date(p.verified_at).toLocaleDateString()}
          </p>
        </div>
        {auth.profile && auth.session?.user.id !== id && (
          <button
            className="ml-auto text-sm underline text-stone-500"
            onClick={() => setReport(true)}
          >
            Report student
          </button>
        )}
      </div>
      <h2 className="mt-8 mb-5 text-xl font-semibold">
        Around this student’s campus
      </h2>
      {items.isPending ? (
        <Loading />
      ) : items.error ? (
        <ErrorBox error={items.error} />
      ) : items.data?.items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.data.items.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <Empty title="No active listings" />
      )}
      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={(page + 1) * 12 >= (items.data?.count || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <ReportDialog
        open={report}
        onClose={() => setReport(false)}
        userId={id}
      />
    </div>
  );
}

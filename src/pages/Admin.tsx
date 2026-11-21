import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { supabase, errorMessage } from "../lib/supabase";
import { config, rpc } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { label, amountLabel } from "../lib/utils";
import type {
  Account,
  Profile,
  Listing,
  Report,
  Audit,
  ConfigRow,
} from "../lib/types";
import { Field, ErrorBox, Loading, Empty } from "../components/Common";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
const sections = [
  "Overview",
  "Users",
  "Listings",
  "Reports",
  "Campus management",
  "Analytics",
  "Audit log",
];
interface Moderation {
  kind: "USER" | "LISTING";
  id: string;
  name: string;
  status: string;
}
interface ChartRow {
  label: string;
  count: number;
}
export function Admin() {
  const [section, setSection] = useState("Overview");
  return (
    <div className="container-page py-9">
      <p className="eyebrow">CAMPUSXCHANGE ADMINISTRATION</p>
      <h1 className="mt-3 text-3xl font-bold">
        A healthier campus marketplace.
      </h1>
      <nav className="my-7 flex flex-wrap gap-2" aria-label="Admin sections">
        {sections.map((s) => (
          <Button
            key={s}
            variant={s === section ? "default" : "outline"}
            onClick={() => setSection(s)}
          >
            {s}
          </Button>
        ))}
      </nav>
      {section === "Overview" || section === "Analytics" ? (
        <Overview analytics={section === "Analytics"} />
      ) : section === "Campus management" ? (
        <CampusManagement />
      ) : (
        <AdminRecords key={section} section={section} />
      )}
    </div>
  );
}
function Overview({ analytics }: { analytics: boolean }) {
  const [cleanup, setCleanup] = useState("");
  const [cleanError, setCleanError] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => rpc<Record<string, number>>("admin_overview"),
  });
  const a = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => rpc<Record<string, ChartRow[]>>("admin_analytics"),
  });
  if (q.isPending || a.isPending) return <Loading />;
  if (q.error || a.error) return <ErrorBox error={q.error || a.error} />;
  return (
    <>
      {!analytics && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(q.data || {}).map(([k, v]) => (
            <div key={k} className="panel">
              <p className="text-sm text-stone-500">{k}</p>
              <p className="mt-3 text-3xl font-bold text-brand">{v}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {Object.entries(a.data || {}).map(([title, rows]) => (
          <section key={title} className="panel">
            <h2 className="mb-5 text-lg font-semibold">{label(title)}</h2>
            {rows.length ? (
              rows.map((r) => (
                <div key={r.label} className="mb-4">
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span>{label(r.label.replaceAll("-", "_"))}</span>
                    <strong>{r.count}</strong>
                  </div>
                  <div className="h-2 rounded bg-stone-100">
                    <div
                      className="h-2 rounded bg-brand"
                      style={{
                        width: `${(r.count / Math.max(...rows.map((x) => x.count))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">
                No activity recorded yet.
              </p>
            )}
          </section>
        ))}
      </div>
      {!analytics && (
        <div className="panel mt-7">
          <h2 className="font-semibold">Image storage maintenance</h2>
          <p className="mt-2 mb-4 text-sm text-stone-500">
            Remove old orphan uploads and images from listings closed over 90
            days ago. Listing history stays intact.
          </p>
          <Button
            variant="outline"
            disabled={cleaning}
            onClick={async () => {
              setCleaning(true);
              setCleanError("");
              setCleanup("");
              try {
                const { data, error } = await supabase.functions.invoke(
                  "cleanup-images",
                  { body: {} },
                );
                if (error) throw error;
                setCleanup(
                  `${data.removed} images removed.${data.hasMore ? " More files remain; run again." : ""}`,
                );
              } catch {
                setCleanError(
                  "Cleanup could not run. Check that the Edge Function is deployed and APP_ORIGIN matches this site.",
                );
              } finally {
                setCleaning(false);
              }
            }}
          >
            {cleaning ? "Cleaning…" : "Run image cleanup"}
          </Button>
          {cleanup && (
            <p className="mt-3 text-sm text-brand" role="status">
              {cleanup}
            </p>
          )}
          {cleanError && (
            <div className="mt-3">
              <ErrorBox error={cleanError} />
            </div>
          )}
        </div>
      )}
      <p className="mt-5 text-xs text-stone-500">
        Resolution metrics are self-reported by students, not independently
        verified transactions.
      </p>
    </>
  );
}
function AdminRecords({ section }: { section: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const term = useDebounce(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [moderation, setModeration] = useState<Moderation | null>(null);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [reportStatus, setReportStatus] = useState("REVIEWING");
  const [notes, setNotes] = useState("");
  const [inspect, setInspect] = useState<
    (Account & { profile?: Profile }) | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const table =
    section === "Users"
      ? "user_accounts"
      : section === "Listings"
        ? "listings"
        : section === "Reports"
          ? "reports"
          : "admin_audit_logs";
  const q = useQuery({
    queryKey: ["admin", table, term, status, page],
    queryFn: async () => {
      let query = supabase
        .from(table)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (status && table !== "admin_audit_logs")
        query = query.eq("status", status);
      if (term) {
        if (table === "user_accounts") {
          const { data, error } = await supabase
            .from("profiles")
            .select("id")
            .ilike("full_name", `%${term}%`)
            .limit(500);
          if (error) throw error;
          const ids = data.map((x) => x.id);
          const { data: regs, error: re } = await supabase
            .from("user_accounts")
            .select("user_id")
            .ilike("registration_number", `%${term}%`)
            .limit(500);
          if (re) throw re;
          query = query.in("user_id", [...ids, ...regs.map((x) => x.user_id)]);
        } else
          query = query.ilike(
            table === "listings"
              ? "title"
              : table === "reports"
                ? "reason"
                : "action_type",
            `%${term}%`,
          );
      }
      const { data, error, count } = await query.range(
        page * 25,
        page * 25 + 24,
      );
      if (error) throw error;
      if (table === "user_accounts" && data.length) {
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("*")
          .in(
            "id",
            data.map((x) => x.user_id),
          );
        if (pe) throw pe;
        return {
          rows: data.map((a) => ({
            ...a,
            profile: p.find((x) => x.id === a.user_id),
          })),
          count: count || 0,
        };
      }
      return { rows: data, count: count || 0 };
    },
  });
  const history = useQuery({
    queryKey: ["admin", "user-history", inspect?.user_id],
    enabled: !!inspect,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("target_user_id", inspect!.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Audit[];
    },
  });
  const userListings = useQuery({
    queryKey: ["admin", "user-listings", inspect?.user_id],
    enabled: !!inspect,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", inspect!.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Listing[];
    },
  });
  function moderate(m: Moderation) {
    setModeration(m);
    setReason("");
    setError("");
  }
  const statuses =
    table === "user_accounts"
      ? ["ACTIVE", "SUSPENDED", "REJECTED", "DEACTIVATED"]
      : table === "listings"
        ? ["ACTIVE", "COMPLETED", "ARCHIVED", "REMOVED_BY_ADMIN"]
        : ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"];
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          className="max-w-md"
          aria-label={`Search ${section}`}
          placeholder={
            section === "Users"
              ? "Search name or registration…"
              : `Search ${section.toLowerCase()}…`
          }
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        {table !== "admin_audit_logs" && (
          <select
            className="max-w-xs"
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.rows.length ? (
        <Empty title="No matching records" />
      ) : (
        <div className="space-y-3">
          {q.data.rows.map((row) => {
            if (table === "user_accounts") {
              const a = row as Account & { profile?: Profile };
              return (
                <article
                  key={a.user_id}
                  className="panel flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <h2 className="font-semibold">
                      {a.profile?.full_name || a.registration_number}
                    </h2>
                    <p className="text-sm text-stone-500">
                      {a.registration_number} · {a.role} · {a.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setInspect(a)}>
                      Inspect
                    </Button>
                    {a.role !== "ADMIN" &&
                      (["SUSPENDED", "REJECTED", "ACTIVE"] as const)
                        .filter((s) => s !== a.status)
                        .map((s) => (
                          <Button
                            key={s}
                            variant={s === "ACTIVE" ? "outline" : "ghost"}
                            onClick={() =>
                              moderate({
                                kind: "USER",
                                id: a.user_id,
                                name:
                                  a.profile?.full_name || a.registration_number,
                                status: s,
                              })
                            }
                          >
                            {s === "ACTIVE"
                              ? "Reactivate"
                              : s === "SUSPENDED"
                                ? "Suspend"
                                : "Reject"}
                          </Button>
                        ))}
                  </div>
                </article>
              );
            }
            if (table === "listings") {
              const l = row as Listing;
              return (
                <article
                  key={l.id}
                  className="panel flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <Link
                      to={`/listing/${l.id}`}
                      className="font-semibold underline"
                    >
                      {l.title}
                    </Link>
                    <p className="text-sm text-stone-500">
                      {amountLabel(l)} · {l.type} ·{" "}
                      {l.deleted_at ? "DELETED" : l.status}
                    </p>
                    {l.deletion_reason && (
                      <p className="text-sm mt-2">
                        Removal reason: {l.deletion_reason}
                      </p>
                    )}
                    <Link
                      to={`/profile/${l.user_id}`}
                      className="text-xs text-brand"
                    >
                      Inspect seller profile ↗
                    </Link>
                  </div>
                  {!l.deleted_at && l.status !== "REMOVED_BY_ADMIN" && (
                    <Button
                      variant="danger"
                      onClick={() =>
                        moderate({
                          kind: "LISTING",
                          id: l.id,
                          name: l.title,
                          status: "REMOVED_BY_ADMIN",
                        })
                      }
                    >
                      Delete listing
                    </Button>
                  )}
                </article>
              );
            }
            if (table === "reports") {
              const r = row as Report;
              return (
                <article key={r.id} className="panel">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold">{label(r.reason)}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {r.status} · {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReport(r);
                        setReportStatus(r.status);
                        setNotes(r.admin_notes || "");
                        setError("");
                      }}
                    >
                      Review
                    </Button>
                  </div>
                  <p className="my-3 text-sm whitespace-pre-wrap">
                    {r.comments}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {r.listing_id ? (
                      <>
                        <Link
                          className="text-sm text-brand underline"
                          to={`/listing/${r.listing_id}`}
                        >
                          Inspect listing
                        </Link>
                        <button
                          className="text-sm text-red-700"
                          onClick={() =>
                            moderate({
                              kind: "LISTING",
                              id: r.listing_id!,
                              name: "Reported listing",
                              status: "REMOVED_BY_ADMIN",
                            })
                          }
                        >
                          Delete listing
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          className="text-sm text-brand underline"
                          to={`/profile/${r.reported_user_id}`}
                        >
                          Inspect student
                        </Link>
                        <button
                          className="text-sm text-red-700"
                          onClick={() =>
                            moderate({
                              kind: "USER",
                              id: r.reported_user_id!,
                              name: "Reported student",
                              status: "SUSPENDED",
                            })
                          }
                        >
                          Suspend student
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            }
            const a = row as Audit;
            return (
              <article key={a.id} className="panel">
                <p className="font-semibold">{label(a.action_type)}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm">{a.reason}</p>
                {a.metadata != null && (
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs text-stone-500">
                    {JSON.stringify(a.metadata, null, 2)}
                  </pre>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="p-3 text-sm">{q.data?.count || 0} records</span>
        <Button
          variant="outline"
          disabled={(page + 1) * 25 >= (q.data?.count || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <Modal
        open={!!moderation}
        onClose={() => setModeration(null)}
        title={`${label(moderation?.status || "Moderate")}: ${moderation?.name}`}
        description={
          moderation?.kind === "LISTING"
            ? "Deleting this ad permanently deletes all its chats and messages for everyone. The ad record and your reason remain for moderation."
            : "This action is recorded in the administrator audit log."
        }
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("admin_moderate", {
                p_kind: moderation!.kind,
                p_id: moderation!.id,
                p_status: moderation!.status,
                p_reason: reason,
              });
              await qc.invalidateQueries();
              setModeration(null);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Reason (required)">
            <textarea
              minLength={5}
              maxLength={2000}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && <ErrorBox error={error} />}
          <Button disabled={busy}>Confirm action</Button>
        </form>
      </Modal>
      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title="Review report"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("admin_review_report", {
                p_id: report!.id,
                p_status: reportStatus,
                p_notes: notes,
              });
              await qc.invalidateQueries({ queryKey: ["admin"] });
              setReport(null);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Case status">
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
            >
              {["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Internal notes">
            <textarea
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          {error && <ErrorBox error={error} />}
          <Button disabled={busy}>Save review</Button>
        </form>
      </Modal>
      <Modal
        open={!!inspect}
        onClose={() => setInspect(null)}
        title={inspect?.profile?.full_name || "Student details"}
      >
        <dl className="space-y-2 text-sm">
          <dt>Registration</dt>
          <dd>{inspect?.registration_number}</dd>
          <dt>Department</dt>
          <dd>{inspect?.profile?.department}</dd>
          <dt>Graduation year</dt>
          <dd>{inspect?.graduation_year}</dd>
          <dt>Status / reason</dt>
          <dd>
            {inspect?.status}:{" "}
            {inspect?.status_reason || "No moderation reason"}
          </dd>
        </dl>
        <h3 className="mt-5 mb-2 font-semibold">Listings (latest 100)</h3>
        {userListings.error ? (
          <ErrorBox error={userListings.error} />
        ) : (
          userListings.data?.map((l) => (
            <Link
              key={l.id}
              className="block py-1 text-sm text-brand underline"
              to={`/listing/${l.id}`}
            >
              {l.title} · {l.status}
            </Link>
          ))
        )}
        <h3 className="mt-5 mb-2 font-semibold">
          Moderation history (latest 100)
        </h3>
        {history.error ? (
          <ErrorBox error={history.error} />
        ) : history.data?.length ? (
          history.data.map((a) => (
            <div key={a.id} className="border-t py-2 text-sm">
              <p>{label(a.action_type)}</p>
              <p>{a.reason}</p>
              <small>{new Date(a.created_at).toLocaleString()}</small>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">No moderation actions.</p>
        )}
      </Modal>
    </>
  );
}
const configKinds: Record<string, { table: string; fields: string[] }> = {
  UNIVERSITY: { table: "universities", fields: ["name", "short_name"] },
  CAMPUS: { table: "campuses", fields: ["university_id", "name", "city"] },
  DOMAIN: { table: "allowed_email_domains", fields: ["campus_id", "domain"] },
  MEETUP: { table: "meetup_spots", fields: ["campus_id", "name"] },
  RULE: { table: "marketplace_rules", fields: ["title", "description"] },
};
function CampusManagement() {
  const [kind, setKind] = useState("UNIVERSITY");
  const [edit, setEdit] = useState<ConfigRow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<Record<string, string | boolean>>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "configuration", kind],
    queryFn: () => config(configKinds[kind].table),
  });
  const universities = useQuery({
    queryKey: ["config", "universities"],
    queryFn: () => config("universities"),
  });
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
  });
  function show(row: ConfigRow | null) {
    setEdit(row);
    form.reset(
      row
        ? ({ ...row } as Record<string, string | boolean>)
        : { is_active: true },
    );
    setError("");
    setOpen(true);
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap justify-between gap-3">
        <select
          aria-label="Configuration type"
          className="max-w-xs"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {Object.keys(configKinds).map((k) => (
            <option key={k} value={k}>
              {label(k)}
            </option>
          ))}
        </select>
        <Button onClick={() => show(null)}>Add {label(kind)}</Button>
      </div>
      <p className="mb-5 text-sm text-stone-500">
        Disabling a university, campus or email domain also restricts protected
        access for affected students. Keep your own admin campus and domain
        active.
      </p>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="space-y-3">
          {q.data?.map((c) => (
            <div className="panel flex justify-between gap-3" key={c.id}>
              <div>
                <h2 className="font-semibold">
                  {c.name || c.domain || c.title}
                </h2>
                <p className="text-sm text-stone-500">
                  {c.is_active ? "Active" : "Inactive"}{" "}
                  {c.city && `· ${c.city}`}
                </p>
              </div>
              <Button variant="outline" onClick={() => show(c)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${edit ? "Edit" : "Add"} ${label(kind)}`}
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (data) => {
            setError("");
            try {
              await rpc("admin_config", {
                p_kind: kind,
                p_id: edit?.id || null,
                p_data: {
                  ...edit,
                  ...Object.fromEntries(
                    Object.entries(data).filter(
                      ([, value]) => value !== undefined,
                    ),
                  ),
                },
              });
              await qc.invalidateQueries({ queryKey: ["admin"] });
              await qc.invalidateQueries({ queryKey: ["config"] });
              setOpen(false);
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          {configKinds[kind].fields.map((f) => (
            <Field key={f} label={label(f)}>
              {f.endsWith("_id") ? (
                <select
                  {...form.register(f, { required: true })}
                  disabled={!!edit}
                >
                  <option value="">Select…</option>
                  {(f === "university_id"
                    ? universities.data
                    : campuses.data
                  )?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  maxLength={f === "description" ? 2000 : 160}
                  disabled={!!edit && kind === "DOMAIN"}
                  {...form.register(f, { required: true })}
                />
              )}
            </Field>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-auto"
              {...form.register("is_active")}
            />
            Active
          </label>
          {error && <ErrorBox error={error} />}
          <Button disabled={form.formState.isSubmitting}>
            Save configuration
          </Button>
        </form>
      </Modal>
    </>
  );
}

import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Phone, MessageCircle, Flag } from "lucide-react";
import { getListing, config, rpc } from "../lib/api";
import { configured, errorMessage } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  amountLabel,
  contactLinks,
  label,
  money,
  relativeTime,
} from "../lib/utils";
import {
  Photo,
  Verified,
  Loading,
  ErrorBox,
  Safety,
  Empty,
} from "../components/Common";
import { SaveButton } from "../components/ListingCard";
import { Button } from "../components/ui/button";
import { ReportDialog } from "../components/ReportDialog";
export function ListingDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const auth = useAuth();
  const q = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id),
    enabled: configured,
  });
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
    enabled: configured,
  });
  const [index, setIndex] = useState(0);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  useEffect(() => {
    setContact("");
    setIndex(0);
    setError("");
    setReport(false);
  }, [id, auth.session?.user.id]);
  if (!configured)
    return (
      <div className="container-page">
        <Empty title="Connect your backend first" />
      </div>
    );
  if (q.isPending)
    return (
      <div className="container-page py-10">
        <Loading />
      </div>
    );
  if (q.error || !q.data || q.data.deleted_at)
    return (
      <div className="container-page py-10">
        <Empty
          title="This listing is unavailable"
          text="It may have been completed, archived or removed."
        />
      </div>
    );
  const l = q.data;
  const links = contactLinks(contact, l.title);
  return (
    <div className="container-page py-8">
      <Link
        to="/marketplace"
        className="mb-7 flex items-center gap-2 text-sm text-stone-500"
      >
        <ArrowLeft size={16} />
        Back to marketplace
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <Photo
            path={l.image_paths[index]}
            alt={l.title}
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
          <div className="mt-3 flex gap-3">
            {l.image_paths.map((p, i) => (
              <button
                key={p}
                aria-label={`View image ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={`rounded-xl border-2 ${i === index ? "border-brand" : "border-transparent"}`}
              >
                <Photo
                  path={p}
                  alt={`Image ${i + 1} of ${l.title}`}
                  className="h-20 w-24 rounded-lg object-cover"
                />
              </button>
            ))}
          </div>
          <div className="mt-7 panel">
            <h2 className="text-lg font-semibold">A few more details</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-stone-600 break-words">
              {l.description}
            </p>
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {l.type === "REQUEST"
                ? "CAMPUS REQUEST"
                : l.type === "RENT"
                  ? "STUDENT RENTAL"
                  : "PRE-LOVED. READY FOR YOU."}
            </span>
            <SaveButton id={l.id} />
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight break-words">
            {l.title}
          </h1>
          <p className="mt-4 text-3xl font-bold text-brand">{amountLabel(l)}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="chip">
              {label(l.category.replaceAll("-", "_"))}
            </span>
            {l.condition && <span className="chip">{label(l.condition)}</span>}
            {l.need_type && <span className="chip">{label(l.need_type)}</span>}
            <span className="chip">{label(l.status)}</span>
          </div>
          <p className="mt-5 flex gap-2 text-sm text-stone-500">
            <MapPin size={17} />
            {l.preferred_meetup_spot} ·{" "}
            {campuses.data?.find((c) => c.id === l.campus_id)?.name}
          </p>
          <p className="mt-2 text-xs text-stone-400">
            Posted {relativeTime(l.created_at)}
          </p>
          {l.type === "RENT" && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-stone-600">
              Suggested deposit: {money(l.deposit)}. Rental payments,
              availability and deposits are arranged directly between students.
              CampusXchange does not collect payments.
            </p>
          )}
          <div className="panel mt-7">
            <Link
              to={`/profile/${l.user_id}`}
              className="flex items-center gap-3"
            >
              <Photo
                path={l.profiles?.avatar_path}
                bucket="avatars"
                alt="Student profile"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">
                  {l.profiles?.full_name || "Campus student"}
                </p>
                <p className="text-xs text-stone-500">
                  {l.profiles?.department}
                </p>
                <Verified userId={l.user_id} />
              </div>
              <span className="ml-auto text-xs text-brand">View profile ↗</span>
            </Link>
            <div className="mt-6">
              {auth.session && auth.profile && auth.eligible ? (
                l.user_id === auth.session.user.id ? (
                  <Button asChild className="w-full" variant="outline">
                    <Link
                      to={
                        l.status === "ACTIVE"
                          ? `/listing/${l.id}/edit`
                          : "/dashboard"
                      }
                    >
                      {l.status === "ACTIVE"
                        ? "Edit your listing"
                        : "View dashboard"}
                    </Link>
                  </Button>
                ) : (
                  <div className="grid gap-2">
                    <Button
                      disabled={busy || l.status !== "ACTIVE"}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const cid = await rpc<string>("start_chat", {
                            p_listing: l.id,
                          });
                          navigate(`/messages/${cid}`);
                        } catch (e) {
                          setError(errorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <MessageCircle size={17} />
                      {busy ? "Please wait…" : "Chat in CampusXchange"}
                    </Button>
                    {l.contact_mode &&
                      l.contact_mode !== "CHAT" &&
                      (contact ? (
                        <>
                          {["WHATSAPP", "BOTH"].includes(l.contact_mode) && (
                            <Button asChild variant="outline">
                              <a
                                href={links.whatsapp}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          {["CALL", "BOTH"].includes(l.contact_mode) && (
                            <Button asChild variant="outline">
                              <a href={links.call}>
                                <Phone size={17} />
                                Call student
                              </a>
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={busy || l.status !== "ACTIVE"}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              setContact(
                                await rpc<string>("get_listing_contact", {
                                  p_id: l.id,
                                }),
                              );
                            } catch (e) {
                              setError(errorMessage(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {l.contact_mode === "WHATSAPP"
                            ? "Show WhatsApp contact"
                            : l.contact_mode === "CALL"
                              ? "Show call contact"
                              : "Show WhatsApp / call contact"}
                        </Button>
                      ))}
                  </div>
                )
              ) : (
                <>
                  <p className="text-sm text-stone-500 mb-3">
                    Sign in with your university email to contact this student.
                  </p>
                  <Button asChild className="w-full">
                    <Link
                      to={
                        auth.session
                          ? "/dashboard"
                          : `/signin?next=/listing/${l.id}`
                      }
                    >
                      {auth.session
                        ? "Check account access"
                        : "Sign in to connect"}
                    </Link>
                  </Button>
                </>
              )}
              {error && (
                <div className="mt-3">
                  <ErrorBox error={error} />
                </div>
              )}
            </div>
          </div>
          <div className="mt-5">
            <Safety />
          </div>
          {auth.session &&
            auth.profile &&
            l.user_id !== auth.session.user.id && (
              <button
                className="mt-5 flex items-center gap-2 text-xs text-stone-500"
                onClick={() => setReport(true)}
              >
                <Flag size={14} />
                Report this listing
              </button>
            )}
        </section>
      </div>
      <ReportDialog
        open={report}
        onClose={() => setReport(false)}
        listingId={l.id}
      />
    </div>
  );
}

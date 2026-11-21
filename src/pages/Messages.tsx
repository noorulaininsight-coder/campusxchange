import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { rpc } from "../lib/api";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { ErrorBox, Loading, Empty, Field } from "../components/Common";
import { Modal } from "../components/ui/dialog";

type Message = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};
type Thread = {
  id: string;
  listing_id: string;
  title: string;
  other_id: string;
  other_name: string;
  blocked_by_me: boolean;
  can_send: boolean;
  messages: Message[];
};
type Conversation = {
  id: string;
  title: string;
  other_name: string;
  last_message: string | null;
  unread: number;
};
export function Messages() {
  const { id } = useParams();
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const inbox = useQuery({
    queryKey: ["chat-inbox", auth.session?.user.id, page],
    queryFn: () => rpc<Conversation[]>("chat_inbox", { p_offset: page * 30 }),
    refetchInterval: 5000,
  });
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Messages</h1>
      <p className="mt-2 mb-6 text-sm text-stone-500">
        Keep your exchange on campus. Never share passwords or verification
        codes.
      </p>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="panel space-y-3">
          <h2 className="font-semibold">Your conversations</h2>
          {inbox.isPending ? (
            <Loading />
          ) : inbox.error ? (
            <ErrorBox error={inbox.error} retry={() => void inbox.refetch()} />
          ) : !inbox.data?.length ? (
            <p className="text-sm text-stone-500">
              No conversations here. Open an ad and select Chat.
            </p>
          ) : (
            inbox.data.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`block rounded-xl border p-3 ${c.id === id ? "border-brand bg-brand/5" : ""}`}
              >
                <div className="flex justify-between gap-2">
                  <strong className="break-words">{c.other_name}</strong>
                  {c.unread > 0 && <span className="chip">{c.unread} new</span>}
                </div>
                <p className="text-sm truncate">{c.title}</p>
                <p className="text-xs text-stone-500 truncate mt-1">
                  {c.last_message || "Say hello"}
                </p>
              </Link>
            ))
          )}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={(inbox.data?.length || 0) < 30}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
          <BlockedUsers />
        </aside>
        {id ? (
          <Chat key={`${auth.session?.user.id}:${id}`} id={id} />
        ) : (
          <div className="panel">
            <Empty
              title="Choose a conversation"
              text="Messages stay inside CampusXchange. Deleting an ad also deletes all its chats."
            />
          </div>
        )}
      </div>
    </div>
  );
}
function BlockedUsers() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["chat-blocks", auth.session?.user.id],
    queryFn: () => rpc<{ id: string; name: string }[]>("chat_blocked_users"),
  });
  return (
    <details className="border-t pt-3">
      <summary className="cursor-pointer text-sm">
        Blocked students ({q.data?.length || 0})
      </summary>
      {q.error && <ErrorBox error={q.error} />}
      {error && <ErrorBox error={error} />}
      {q.data?.map((p) => (
        <div
          className="mt-2 flex justify-between items-center gap-2"
          key={p.id}
        >
          <span className="text-sm">{p.name}</span>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await rpc("set_chat_block", { p_user: p.id, p_block: false });
                await qc.invalidateQueries({ queryKey: ["chat-blocks"] });
                await qc.invalidateQueries({ queryKey: ["chat-thread"] });
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Unblock
          </Button>
        </div>
      ))}
    </details>
  );
}
function Chat({ id }: { id: string }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState<Message[]>([]);
  const [more, setMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const retry = useRef<{ body: string; nonce: string } | null>(null);
  const lastRead = useRef(0);
  const q = useQuery({
    queryKey: ["chat-thread", auth.session?.user.id, id],
    queryFn: () => rpc<Thread>("chat_thread", { p_id: id }),
    refetchInterval: 3000,
    retry: 1,
  });
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const latest = q.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (stickToBottom.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [latest]);
  useEffect(() => {
    const mark = () => {
      if (
        !latest ||
        latest <= lastRead.current ||
        document.visibilityState !== "visible"
      )
        return;
      void rpc("mark_chat_read", { p_id: id, p_message: latest })
        .then(() => {
          lastRead.current = latest;
          void qc.invalidateQueries({ queryKey: ["chat-unread"] });
          void qc.invalidateQueries({ queryKey: ["chat-inbox"] });
        })
        .catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [id, latest, q.dataUpdatedAt, qc]);
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["chat-thread"] }),
      qc.invalidateQueries({ queryKey: ["chat-inbox"] }),
      qc.invalidateQueries({ queryKey: ["chat-blocks"] }),
    ]);
  }
  if (q.isPending)
    return (
      <div className="panel">
        <Loading />
      </div>
    );
  // Never keep rendering cached messages when the server revokes access/deletes a thread.
  if (q.error || !q.data)
    return (
      <div className="panel">
        <ErrorBox
          error={q.error || "Conversation unavailable."}
          retry={() => void q.refetch()}
        />
        <Link className="text-brand underline" to="/messages">
          Back to messages
        </Link>
      </div>
    );
  const t = q.data;
  const messages = Array.from(
    new Map([...older, ...t.messages].map((m) => [m.id, m])).values(),
  ).sort((a, b) => a.id - b.id);
  return (
    <section className="panel min-w-0">
      <div className="flex flex-wrap justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="font-bold">{t.other_name}</h2>
          <Link
            to={`/listing/${t.listing_id}`}
            className="text-sm text-brand underline"
          >
            {t.title}
          </Link>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await rpc("set_chat_block", {
                  p_user: t.other_id,
                  p_block: !t.blocked_by_me,
                });
                await refresh();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.blocked_by_me ? "Unblock" : "Block"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setReason("");
              setNotice("");
              setError("");
              setReport(true);
            }}
          >
            Report
          </Button>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={() => {
          const el = scroller.current;
          if (el)
            stickToBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="py-4 space-y-3 max-h-[55vh] overflow-y-auto"
        aria-label="Conversation messages"
      >
        {more && messages.length >= 50 && (
          <Button
            variant="ghost"
            disabled={loadingOlder}
            onClick={async () => {
              setLoadingOlder(true);
              setError("");
              try {
                const result = await rpc<Thread>("chat_thread", {
                  p_id: id,
                  p_before: messages[0].id,
                });
                setOlder((prev) => [...result.messages, ...prev]);
                setMore(result.messages.length === 50);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setLoadingOlder(false);
              }
            }}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </Button>
        )}
        {!messages.length && (
          <p className="py-10 text-center text-stone-500">
            Start by asking about the listing.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender_id === auth.session?.user.id ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 ${m.sender_id === auth.session?.user.id ? "bg-brand text-white" : "bg-stone-100"}`}
            >
              <p className="whitespace-pre-wrap break-words text-sm">
                {m.body}
              </p>
              <time className="text-[10px] opacity-70" dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleString()}
              </time>
            </div>
          </div>
        ))}
      </div>
      {notice && (
        <p role="status" className="text-sm text-brand">
          {notice}
        </p>
      )}
      {error && <ErrorBox error={error} />}
      {t.can_send ? (
        <form
          className="border-t pt-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !body.trim()) return;
            setBusy(true);
            setError("");
            const text = body.trim();
            if (retry.current?.body !== text)
              retry.current = { body: text, nonce: crypto.randomUUID() };
            try {
              await rpc("send_chat_message", {
                p_id: id,
                p_body: text,
                p_client_id: retry.current.nonce,
              });
              setBody("");
              stickToBottom.current = true;
              retry.current = null;
              await refresh();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <textarea
            id="chat-message"
            rows={3}
            maxLength={2000}
            required
            value={body}
            disabled={busy}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500">{body.length}/2000</span>
            <Button disabled={busy || !body.trim()}>
              {busy ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl bg-stone-100 p-4 text-sm">
          Messaging is unavailable because this listing is closed, a participant
          is unavailable, or contact is blocked.
        </p>
      )}
      <p className="mt-3 text-xs text-stone-500">
        Messages refresh automatically. If this ad is deleted, its chats are
        permanently removed from the app.
      </p>
      <Modal
        open={report}
        onClose={() => setReport(false)}
        title="Report this conversation"
        description="Describe what happened. Your report goes to the administrator."
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("report_chat", { p_id: id, p_reason: reason });
              setReport(false);
              setNotice("Report submitted for admin review.");
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Reason">
            <textarea
              required
              minLength={5}
              maxLength={1500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && <ErrorBox error={error} />}
          <Button disabled={busy || reason.trim().length < 5}>
            Submit report
          </Button>
        </form>
      </Modal>
    </section>
  );
}

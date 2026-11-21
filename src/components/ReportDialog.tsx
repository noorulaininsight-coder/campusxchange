import { useState, useEffect } from "react";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, ErrorBox } from "./Common";
import { rpc } from "../lib/api";
import { errorMessage } from "../lib/supabase";
import { reportReasons, label } from "../lib/utils";
export function ReportDialog({
  open,
  onClose,
  listingId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  listingId?: string;
  userId?: string;
}) {
  const [reason, setReason] = useState(reportReasons[0]);
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setDone(false);
      setError("");
      setComments("");
      setReason(reportReasons[0]);
    }
  }, [open, listingId, userId]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Help keep your campus safe"
      description="Reports are reviewed privately by administrators."
    >
      {done ? (
        <p role="status" className="text-brand">
          Your report has been submitted. Thank you.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("submit_report", {
                p_reason: reason,
                p_comments: comments || null,
                p_listing: listingId || null,
                p_user: userId || null,
              });
              setDone(true);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {reportReasons.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Additional details (optional)">
            <textarea
              value={comments}
              maxLength={2000}
              onChange={(e) => setComments(e.target.value)}
            />
          </Field>
          {error && <ErrorBox error={error} />}
          <Button disabled={busy}>
            {busy ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      )}
    </Modal>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rpc } from "../lib/api";
import { errorMessage } from "../lib/supabase";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Field, ErrorBox } from "./Common";
export function DeleteListing({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setReason("");
          setError("");
          setOpen(true);
        }}
      >
        Delete ad
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Delete this ad?"
        description="This removes the ad and permanently deletes all its chats and messages for everyone. The removal reason is kept for moderation."
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await rpc("delete_listing", { p_id: id, p_reason: reason });
              await qc.invalidateQueries();
              setOpen(false);
              onDeleted?.();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Why are you deleting it?">
            <textarea
              required
              minLength={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: no longer available, duplicate ad, or posted by mistake"
            />
          </Field>
          {error && <ErrorBox error={error} />}
          <Button disabled={busy || reason.trim().length < 5}>
            {busy ? "Deleting…" : "Delete ad and all chats"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

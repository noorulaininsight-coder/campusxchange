import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { config } from "../lib/api";
import { configured } from "../lib/supabase";
import { Safety, ErrorBox } from "../components/Common";
export function Legal() {
  const path = useLocation().pathname;
  const rules = useQuery({
    queryKey: ["config", "marketplace_rules"],
    queryFn: () => config("marketplace_rules"),
    enabled: configured,
  });
  return (
    <div className="container-page py-12">
      <article className="mx-auto max-w-3xl panel space-y-6 leading-relaxed text-stone-600">
        <h1 className="text-3xl font-bold text-ink">
          {path === "/privacy"
            ? "Your privacy matters."
            : path === "/terms"
              ? "Marketplace guidelines & terms"
              : "A safer campus exchange."}
        </h1>
        {path === "/privacy" ? (
          <>
            <p>
              CampusXchange stores your verified university email through
              Supabase Auth, your profile, registration number, graduation year
              and contact number. We use these details to establish campus
              membership and enable student exchanges. We do not collect student
              ID-card images.
            </p>
            <p>
              Your name, photo, department, campus, verification date and active
              listings are public. Your registration number, graduation year,
              moderation information and email are not public profile fields.
              Your phone number is shared with active verified members only when
              you enable WhatsApp or Call on that listing. Chat-only listings do
              not expose your number through the contact flow. Administrators
              can access your private contact details for moderation.
            </p>
            <p>
              We store listing history, completion reasons, reports and
              administrator audit records to operate and moderate the
              marketplace. In-app messages are stored so conversation
              participants can read them; they are not end-to-end encrypted.
              Blocking stops further messages in both directions. Reports retain
              your description of the issue. Deleting an ad deletes all its
              in-app conversations and messages from the active database;
              existing downloads, screenshots and provider backups are not
              recalled. The ad record and removal reason are retained for
              moderation. We do not store WhatsApp conversations or process
              payments. Authentication tokens are stored in your browser; sign
              out on shared devices.
            </p>
            <p>
              Supabase provides authentication, database and image storage. Our
              configured email provider delivers authentication email, and
              Cloudflare provides hosting and the Turnstile security check.
              These providers process the data necessary to provide those
              services.
            </p>
            <p>
              You can edit your profile or deactivate your account in settings.
              Deactivation hides your profile and listings but retains
              historical records. To request deletion or review of your data,
              contact your campus administrator. Archived listing images are
              eligible for deletion after 90 days when the configured
              maintenance job runs.
            </p>
          </>
        ) : path === "/terms" ? (
          <>
            <p>
              CampusXchange helps university-email verified students discover
              items and arrange exchanges. Email verification confirms control
              of an approved email address; it does not guarantee identity,
              ownership, item quality or transaction safety. CampusXchange is
              not an official university service unless explicitly authorized by
              the university.
            </p>
            <p>
              Students are responsible for accurate listings, lawful ownership,
              agreeing prices, deposits and rental arrangements, and complying
              with campus rules. The platform does not provide payments, escrow,
              delivery or guarantees. Do not share verification codes or
              misrepresent yourself.
            </p>
            {rules.error ? (
              <ErrorBox error={rules.error} />
            ) : (
              rules.data?.map((r) => (
                <section key={r.id}>
                  <h2 className="font-semibold text-ink">{r.title}</h2>
                  <p>{r.description}</p>
                </section>
              ))
            )}
            <p>
              Prohibited items include illegal goods, weapons, controlled
              substances, stolen property, counterfeit academic documents and
              inappropriate content. Administrators may remove listings or
              restrict accounts and record a reason. Report suspected abuse
              through a listing or student profile.
            </p>
            <p>
              Contact your campus administrator to ask about an account
              restriction. Do not create replacement accounts to bypass
              moderation.
            </p>
          </>
        ) : (
          <>
            <Safety />
            <h2 className="text-xl font-semibold text-ink">Before you meet</h2>
            <p>
              Agree on the item, condition, price and meeting place. Use a busy
              campus location during active hours. Tell a friend where you are
              going, and avoid sharing unnecessary personal information.
            </p>
            <h2 className="text-xl font-semibold text-ink">Before you pay</h2>
            <p>
              Inspect and test the item. For rentals, agree the duration,
              deposit and return conditions in writing. Be cautious of
              advance-payment requests or pressure to move quickly.
            </p>
            <h2 className="text-xl font-semibold text-ink">
              If something feels wrong
            </h2>
            <p>
              Stop the exchange and report the listing or student. For an
              immediate safety concern, contact campus security or local
              emergency services.
            </p>
          </>
        )}
      </article>
    </div>
  );
}

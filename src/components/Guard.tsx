import { Navigate, useLocation, Outlet, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox, Loading } from "./Common";
import { configured } from "../lib/supabase";
export function Guard({
  admin = false,
  onboarding = false,
}: {
  admin?: boolean;
  onboarding?: boolean;
}) {
  const a = useAuth();
  const loc = useLocation();
  if (!configured) return <Navigate to="/signin" />;
  if (a.loading)
    return (
      <div className="container-page">
        <Loading />
      </div>
    );
  if (a.error)
    return (
      <div className="container-page">
        <ErrorBox error={a.error} retry={() => void a.refresh()} />
      </div>
    );
  if (!a.session)
    return (
      <Navigate
        to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  if (a.account && a.account.status !== "ACTIVE")
    return (
      <div className="container-page">
        <ErrorBox
          error={`Account ${a.account.status.toLowerCase()}: ${a.account.status_reason || "Please contact your campus administrator."}`}
        />
      </div>
    );
  if (a.profile && !a.eligible)
    return (
      <div className="container-page py-8">
        <ErrorBox error="Your campus or email domain is currently inactive. Please contact the administrator." />
      </div>
    );
  if (!a.profile && !onboarding) return <Navigate to="/onboarding" replace />;
  if (admin && a.account?.role !== "ADMIN")
    return (
      <div className="container-page">
        <ErrorBox error="Administrator access is required." />
        <Link to="/marketplace">Back to marketplace</Link>
      </div>
    );
  return <Outlet />;
}

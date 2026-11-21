import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, configured } from "../lib/supabase";
import type { Account, Profile } from "../lib/types";
interface AuthState {
  session: Session | null;
  profile: Profile | null;
  account: Account | null;
  loading: boolean;
  eligible: boolean;
  error: unknown;
  refresh: () => Promise<unknown>;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initial, setInitial] = useState(true);
  const qc = useQueryClient();
  useEffect(() => {
    if (!configured) {
      setInitial(false);
      return;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Session initialization failed");
      setSession(data.session);
      setInitial(false);
    });
    let previousId: string | undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (previousId !== next?.user.id) {
        qc.clear();
        previousId = next?.user.id;
      }
      setSession(next);
      setInitial(false);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const q = useQuery({
    queryKey: ["me", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const [p, a] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session!.user.id)
          .maybeSingle(),
        supabase
          .from("user_accounts")
          .select("*")
          .eq("user_id", session!.user.id)
          .maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      const eligibility = await supabase.rpc("my_eligibility");
      if (eligibility.error) throw eligibility.error;
      return {
        profile: p.data as Profile | null,
        account: a.data as Account | null,
        eligible: eligibility.data === true,
      };
    },
    refetchInterval: 30000,
  });
  return (
    <Context.Provider
      value={{
        session,
        profile: q.data?.profile || null,
        account: q.data?.account || null,
        loading: initial || (!!session && q.isPending),
        eligible: q.data?.eligible || false,
        error: q.error,
        refresh: q.refetch,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const v = useContext(Context);
  if (!v) throw new Error("Auth provider missing");
  return v;
}

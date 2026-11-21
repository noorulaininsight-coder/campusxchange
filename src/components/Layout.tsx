import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, Bookmark, Menu, X, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { rpc } from "../lib/api";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase, errorMessage } from "../lib/supabase";
import { Button } from "./ui/button";
export function Layout() {
  const { session, account, eligible } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const unread = useQuery({
    queryKey: ["chat-unread", session?.user.id],
    queryFn: () => rpc<number>("chat_unread_count"),
    enabled: !!session && eligible,
    refetchInterval: 15000,
  });
  const messageLabel = `Messages${unread.data ? ` (${unread.data})` : ""}`;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5 px-5 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-extrabold tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
              <ArrowUpRight />
            </span>
            Campus<span className="text-brand -ml-2">Xchange</span>
            <span className="sr-only">Home</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            <NavLink to="/marketplace">Explore</NavLink>
            {session && <NavLink to="/messages">{messageLabel}</NavLink>}
            <NavLink to="/saved" className="flex gap-1">
              <Bookmark size={18} />
              Saved
            </NavLink>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/dashboard">My campus</Link>
                </Button>
                {account?.role === "ADMIN" && <Link to="/admin">Admin</Link>}
                <button
                  aria-label="Sign out"
                  onClick={async () => {
                    const { error } = await supabase.auth.signOut();
                    if (error) setError(errorMessage(error));
                    else navigate("/");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link to="/signin" className="text-sm font-semibold">
                Sign in
              </Link>
            )}
            <Button asChild>
              <Link to="/post">
                <Plus size={17} />
                Post a listing
              </Link>
            </Button>
          </div>
          <button
            className="p-2 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            className="flex flex-col gap-4 border-t p-5 md:hidden"
            aria-label="Mobile"
          >
            {[
              ["/marketplace", "Explore"],
              ["/saved", "Saved items"],
              ...(session ? [["/messages", messageLabel]] : []),
              ["/post", "Post a listing"],
              [
                session ? "/dashboard" : "/signin",
                session ? "My dashboard" : "Sign in",
              ],
              ["/safety", "Safety"],
              ...(account?.role === "ADMIN" ? [["/admin", "Admin"]] : []),
            ].map(([path, text]) => (
              <Link key={path} to={path} onClick={() => setOpen(false)}>
                {text}
              </Link>
            ))}
            {session && (
              <button
                className="text-left"
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) setError(errorMessage(error));
                  else {
                    setOpen(false);
                    navigate("/");
                  }
                }}
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      <main className="min-h-[70vh]">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 text-sm text-stone-500 sm:flex-row">
          <p>
            <strong className="text-ink">CampusXchange</strong>
            <br />
            Good finds. Familiar faces.
          </p>
          <nav className="flex flex-wrap gap-5">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Guidelines & terms</Link>
            <Link to="/safety">Campus safety</Link>
          </nav>
          <p>Made for student life.</p>
        </div>
      </footer>
    </>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async (uid: string) => {
    // Get conversations the user is in
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`);
    const ids = (convs ?? []).map((c) => c.id);
    if (ids.length === 0) { setUnread(0); return; }
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .eq("read", false)
      .neq("sender_id", uid);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    const loadSellerRole = async (userId: string | null) => {
      if (!userId) { setIsSeller(false); return; }
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "seller").maybeSingle();
      setIsSeller(Boolean(data));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      void loadSellerRole(nextUser?.id ?? null);
      if (nextUser) void loadUnread(nextUser.id); else setUnread(0);
    });

    supabase.auth.getSession().then(({ data }) => {
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      void loadSellerRole(nextUser?.id ?? null);
      if (nextUser) void loadUnread(nextUser.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadUnread]);

  // Realtime: refresh unread when messages change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`navbar-unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void loadUnread(user.id);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, loadUnread]);

  // Refresh unread when navigating (e.g., leaving /messages where things got marked read)
  useEffect(() => {
    if (user) void loadUnread(user.id);
  }, [pathname, user, loadUnread]);

  // Ping last_seen_at so unread-message email notifications skip active users
  useEffect(() => {
    if (!user) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    };
    ping();
    const interval = window.setInterval(ping, 2 * 60 * 1000);
    document.addEventListener("visibilitychange", ping);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", ping); };
  }, [user]);

  const links = [
    { to: "/", label: "Home" },
    { to: "/browse", label: "Browse" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold text-accent-foreground shadow-gold">
            <Sparkles className="h-4 w-4" />
          </span>
          Artisaneo
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                pathname === l.to ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Messages" className="relative">
                <Link to="/messages">
                  <MessageSquare className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
              {isSeller ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/dashboard/seller">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/seller/profile">Profile</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/dashboard/buyer">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/become-a-seller">Sell on Artisaneo</Link>
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/become-a-seller">Sell</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/auth?mode=signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

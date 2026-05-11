import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string;
  booking_id: string | null;
  last_message_at: string;
  other?: { id: string; display_name: string | null; avatar_url: string | null } | null;
  last_body?: string | null;
  unread_count?: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (uid: string) => {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id,buyer_id,seller_id,booking_id,last_message_at")
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order("last_message_at", { ascending: false });

    const list = convs ?? [];
    if (list.length === 0) { setConversations([]); return; }

    const otherIds = Array.from(new Set(list.map((c) => (c.buyer_id === uid ? c.seller_id : c.buyer_id))));
    const convIds = list.map((c) => c.id);

    const [{ data: profiles }, { data: lastMsgs }, { data: unread }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,avatar_url").in("id", otherIds),
      supabase.from("messages").select("conversation_id,body,created_at").in("conversation_id", convIds).order("created_at", { ascending: false }),
      supabase.from("messages").select("conversation_id").in("conversation_id", convIds).eq("read", false).neq("sender_id", uid),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const lastMap = new Map<string, string>();
    (lastMsgs ?? []).forEach((m) => { if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m.body); });
    const unreadMap = new Map<string, number>();
    (unread ?? []).forEach((m) => unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1));

    setConversations(list.map((c) => {
      const otherId = c.buyer_id === uid ? c.seller_id : c.buyer_id;
      const p = profMap.get(otherId);
      return {
        ...c,
        other: p ? { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url } : { id: otherId, display_name: null, avatar_url: null },
        last_body: lastMap.get(c.id) ?? null,
        unread_count: unreadMap.get(c.id) ?? 0,
      };
    }));
  }, []);

  const loadMessages = useCallback(async (cid: string, uid: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,read,created_at")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);

    // mark unread (from other) as read
    const unreadIds = (data ?? []).filter((m) => !m.read && m.sender_id !== uid).map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ read: true }).in("id", unreadIds);
      setConversations((cur) => cur.map((c) => (c.id === cid ? { ...c, unread_count: 0 } : c)));
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { navigate("/auth?redirect=/messages"); return; }
      if (!active) return;
      setUserId(auth.user.id);
      await loadConversations(auth.user.id);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate, loadConversations]);

  // Initial activeId from query string
  useEffect(() => {
    if (loading) return;
    const requested = searchParams.get("c");
    if (requested && conversations.some((c) => c.id === requested)) {
      setActiveId(requested);
    } else if (!activeId && conversations[0]) {
      setActiveId(conversations[0].id);
    }
  }, [loading, conversations, searchParams, activeId]);

  useEffect(() => {
    if (activeId && userId) void loadMessages(activeId, userId);
  }, [activeId, userId, loadMessages]);

  // realtime: messages and conversations
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-inbox-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.conversation_id === activeId) {
          setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
          if (msg.sender_id !== userId) {
            void supabase.from("messages").update({ read: true }).eq("id", msg.id);
          }
        }
        void loadConversations(userId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        setMessages((cur) => cur.map((m) => (m.id === msg.id ? msg : m)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        void loadConversations(userId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, activeId, loadConversations]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, activeId]);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeId || !userId) return;
    if (body.length > 4000) { toast.error("Message too long"); return; }
    setSending(true);
    const { error } = await supabase.from("messages").insert({ conversation_id: activeId, sender_id: userId, body });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
  };

  const selectConv = (id: string) => {
    setActiveId(id);
    setSearchParams({ c: id }, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8">
        <header className="mb-6">
          <Badge variant="secondary" className="mb-3">Inbox</Badge>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Messages</h1>
          <p className="mt-2 text-muted-foreground">Conversations with buyers and sellers, in real time.</p>
        </header>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            <Skeleton className="h-[500px] rounded-2xl" />
            <Skeleton className="h-[500px] rounded-2xl" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 font-display text-lg font-semibold">No conversations yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Message an artisan from their profile to start a conversation.</p>
            <Button asChild variant="hero" className="mt-4"><Link to="/browse">Browse artisans</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            {/* Sidebar */}
            <aside className="overflow-hidden rounded-2xl border border-border bg-card">
              <ul className="max-h-[70vh] overflow-y-auto divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => selectConv(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40",
                        activeId === c.id && "bg-muted/60",
                      )}
                    >
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={c.other?.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary text-primary">
                          {(c.other?.display_name ?? "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{c.other?.display_name ?? "User"}</p>
                          <span className="text-xs text-muted-foreground">{formatTime(c.last_message_at)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className={cn("truncate text-sm text-muted-foreground", (c.unread_count ?? 0) > 0 && "font-medium text-foreground")}>
                            {c.last_body ?? "No messages yet"}
                          </p>
                          {(c.unread_count ?? 0) > 0 && (
                            <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{c.unread_count}</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Thread */}
            <section className="flex h-[70vh] flex-col rounded-2xl border border-border bg-card">
              {activeConv ? (
                <>
                  <header className="flex items-center gap-3 border-b border-border p-4">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={activeConv.other?.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-primary">
                        {(activeConv.other?.display_name ?? "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{activeConv.other?.display_name ?? "User"}</p>
                      {activeConv.booking_id && (
                        <p className="text-xs text-muted-foreground">Linked to a booking</p>
                      )}
                    </div>
                  </header>

                  <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
                    ) : messages.map((m) => {
                      const mine = m.sender_id === userId;
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                          )}>
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={cn("mt-1 flex items-center gap-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {formatTime(m.created_at)}
                              {mine && <span>· {m.read ? "Read" : "Sent"}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    className="flex items-end gap-2 border-t border-border p-3"
                    onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                  >
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message…"
                      rows={1}
                      maxLength={4000}
                      className="min-h-[44px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <Button type="submit" disabled={sending || !draft.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Select a conversation
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Messages;

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, CheckCircle2, Clock, DollarSign, Loader2, Pencil, Plus, Trash2, X, Wallet, Image as ImageIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Booking = {
  id: string;
  reference_number: string | null;
  service_type: string | null;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
  payment_status: string;
  price_pence: number;
  application_fee_pence: number | null;
  buyer_id: string;
  created_at: string;
  buyer?: { display_name: string | null; avatar_url: string | null } | null;
};

type Service = {
  id: string;
  title: string;
  description: string | null;
  price_pence: number;
  city: string;
};

const PLATFORM_FEE_RATE = 0.1;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(600).optional(),
  city: z.string().trim().min(2).max(100),
});

const serviceSchema = z.object({
  title: z.string().trim().min(2, "Title required").max(120),
  description: z.string().trim().max(1000).optional(),
  price_pounds: z.coerce.number().positive("Price must be positive").max(100000),
  city: z.string().trim().min(2).max(100),
});

const todayStr = () => new Date().toISOString().slice(0, 10);

const SellerDashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // profile state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  // availability state (seller_profiles row)
  const [availDays, setAvailDays] = useState<string[]>([]);
  const [availStart, setAvailStart] = useState<string>("09:00");
  const [availEnd, setAvailEnd] = useState<string>("17:00");
  const [savingAvail, setSavingAvail] = useState(false);
  const [hasSellerProfile, setHasSellerProfile] = useState(false);

  // service editor
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcCity, setSvcCity] = useState("");
  const [savingSvc, setSavingSvc] = useState(false);

  const fetchBookings = useCallback(async (uid: string) => {
    const { data: bRows } = await supabase
      .from("bookings")
      .select("id,reference_number,service_type,booking_date,booking_time,status,payment_status,price_pence,application_fee_pence,buyer_id,created_at")
      .eq("seller_id", uid)
      .order("created_at", { ascending: false });

    const buyerIds = Array.from(new Set((bRows ?? []).map((b) => b.buyer_id)));
    const buyerMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (buyerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", buyerIds);
      (profiles ?? []).forEach((p) => buyerMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url }));
    }
    setBookings((bRows ?? []).map((b) => ({ ...b, buyer: buyerMap.get(b.buyer_id) ?? null })));
  }, []);

  const fetchServices = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("services")
      .select("id,title,description,price_pence,city")
      .eq("seller_id", uid)
      .order("created_at", { ascending: false });
    setServices(data ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        navigate("/auth?redirect=/dashboard/seller");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "seller").maybeSingle();
      if (!roleRow) {
        toast.error("Seller account required");
        navigate("/become-a-seller");
        return;
      }
      if (!active) return;
      setUserId(user.id);

      const [{ data: profile }, { data: sp }] = await Promise.all([
        supabase.from("profiles").select("display_name,bio,city,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("seller_profiles").select("availability_days,availability_start,availability_end").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setDisplayName(profile?.display_name ?? "");
      setBio(profile?.bio ?? "");
      setCity(profile?.city ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      if (sp) {
        setHasSellerProfile(true);
        setAvailDays(sp.availability_days ?? []);
        setAvailStart((sp.availability_start ?? "09:00:00").slice(0, 5));
        setAvailEnd((sp.availability_end ?? "17:00:00").slice(0, 5));
      }

      await Promise.all([fetchBookings(user.id), fetchServices(user.id)]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [navigate, fetchBookings, fetchServices]);

  // realtime: bookings + services
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`seller-dashboard-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `seller_id=eq.${userId}` },
        () => { void fetchBookings(userId); })
      .on("postgres_changes", { event: "*", schema: "public", table: "services", filter: `seller_id=eq.${userId}` },
        () => { void fetchServices(userId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, fetchBookings, fetchServices]);

  const today = todayStr();
  const pendingRequests = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings],
  );
  const upcoming = useMemo(
    () => bookings
      .filter((b) => b.status === "confirmed" && (b.booking_date ?? "") >= today)
      .sort((a, b) => (a.booking_date ?? "").localeCompare(b.booking_date ?? "")),
    [bookings, today],
  );

  // Earnings: this month, pending, transactions
  const earnings = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthEarned = 0;
    let pendingPayout = 0;
    const txns: Booking[] = [];
    for (const b of bookings) {
      const net = Math.max(0, b.price_pence - (b.application_fee_pence ?? Math.round(b.price_pence * PLATFORM_FEE_RATE)));
      if (b.payment_status === "paid" && b.status !== "cancelled") {
        txns.push(b);
        if ((b.created_at ?? "").startsWith(monthKey)) monthEarned += net;
        if (b.status === "pending" || b.status === "confirmed") {
          // pending payout = paid but service not yet completed (date in future)
          if (!b.booking_date || b.booking_date >= today) pendingPayout += net;
        }
      }
    }
    return { monthEarned, pendingPayout, txns };
  }, [bookings, today]);

  const acceptBooking = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking accepted");
  };
  const declineBooking = async (id: string) => {
    if (!confirm("Decline this booking?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking declined");
  };

  const saveProfile = async () => {
    if (!userId) return;
    const parsed = profileSchema.safeParse({ display_name: displayName, bio, city });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid");
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: parsed.data.display_name,
      bio: parsed.data.bio || null,
      city: parsed.data.city,
      avatar_url: avatarUrl,
    });
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    await supabase.from("profiles").upsert({ id: userId, avatar_url: pub.publicUrl, display_name: displayName });
    setUploading(false);
    toast.success("Photo updated");
  };

  const toggleDay = (d: string) =>
    setAvailDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const saveAvailability = async () => {
    if (!userId) return;
    if (!hasSellerProfile) {
      toast.error("Complete seller onboarding first");
      return;
    }
    setSavingAvail(true);
    const { error } = await supabase.from("seller_profiles").update({
      availability_days: availDays,
      availability_start: availStart,
      availability_end: availEnd,
    }).eq("user_id", userId);
    setSavingAvail(false);
    if (error) return toast.error(error.message);
    toast.success("Availability updated");
  };

  const openCreate = () => {
    setEditing(null); setCreating(true);
    setSvcTitle(""); setSvcDesc(""); setSvcPrice(""); setSvcCity(city);
  };
  const openEdit = (s: Service) => {
    setCreating(false); setEditing(s);
    setSvcTitle(s.title); setSvcDesc(s.description ?? "");
    setSvcPrice((s.price_pence / 100).toFixed(2)); setSvcCity(s.city);
  };
  const closeSvc = () => { setEditing(null); setCreating(false); };

  const saveService = async () => {
    if (!userId) return;
    const parsed = serviceSchema.safeParse({ title: svcTitle, description: svcDesc, price_pounds: svcPrice, city: svcCity });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid");
    setSavingSvc(true);
    const payload = {
      title: parsed.data.title,
      description: parsed.data.description || null,
      price_pence: Math.round(parsed.data.price_pounds * 100),
      city: parsed.data.city,
      seller_id: userId,
    };
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    setSavingSvc(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Service updated" : "Service created");
    closeSvc();
  };

  const deleteService = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Service deleted");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <header className="mb-8">
          <Badge variant="secondary" className="mb-3">Seller dashboard</Badge>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">
            Welcome back{displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="mt-2 text-muted-foreground">Manage requests, schedule, earnings, and your public profile.</p>
        </header>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-4">
              <TabsTrigger value="requests">
                Requests {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            {/* REQUESTS */}
            <TabsContent value="requests" className="mt-6">
              {pendingRequests.length === 0 ? (
                <EmptyCard title="No pending requests" body="New booking requests from buyers will appear here in real time." />
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((b) => (
                    <BookingRow key={b.id} b={b}
                      action={
                        <div className="flex gap-2">
                          <Button size="sm" variant="hero" onClick={() => acceptBooking(b.id)}>
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => declineBooking(b.id)}>
                            <X className="mr-1 h-4 w-4" /> Decline
                          </Button>
                        </div>
                      } />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* SCHEDULE */}
            <TabsContent value="schedule" className="mt-6">
              {upcoming.length === 0 ? (
                <EmptyCard title="No upcoming bookings" body="Confirmed bookings will appear here in date order." />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingRow key={b.id} b={b} action={<Badge>Confirmed</Badge>} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* EARNINGS */}
            <TabsContent value="earnings" className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={<DollarSign className="h-5 w-5 text-primary" />}
                  label="This month (net)"
                  value={formatGBP(earnings.monthEarned)}
                  hint={`After ${PLATFORM_FEE_RATE * 100}% platform fee`}
                />
                <StatCard
                  icon={<Wallet className="h-5 w-5 text-primary" />}
                  label="Pending payouts"
                  value={formatGBP(earnings.pendingPayout)}
                  hint="Paid but not yet completed"
                />
                <StatCard
                  icon={<CalendarIcon className="h-5 w-5 text-primary" />}
                  label="Confirmed bookings"
                  value={String(upcoming.length)}
                  hint="Upcoming"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction history</CardTitle>
                  <CardDescription>All paid bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  {earnings.txns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Buyer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Net</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {earnings.txns.map((t) => {
                            const fee = t.application_fee_pence ?? Math.round(t.price_pence * PLATFORM_FEE_RATE);
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="font-mono text-xs">{t.reference_number ?? t.id.slice(0, 8)}</TableCell>
                                <TableCell>{t.buyer?.display_name ?? "—"}</TableCell>
                                <TableCell>{t.booking_date ?? new Date(t.created_at).toLocaleDateString()}</TableCell>
                                <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                                <TableCell className="text-right">{formatGBP(t.price_pence)}</TableCell>
                                <TableCell className="text-right font-medium">{formatGBP(t.price_pence - fee)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PROFILE */}
            <TabsContent value="profile" className="mt-6 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Profile & photo</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border border-border">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-primary text-2xl">
                        {(displayName || "S").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
                      <span className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted">
                        {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : <><ImageIcon className="mr-2 h-4 w-4" /> Change photo</>}
                      </span>
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dn">Business name</Label>
                      <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ct">City</Label>
                      <Input id="ct" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="bi">Bio</Label>
                      <Textarea id="bi" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} rows={4} />
                    </div>
                  </div>
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Availability</CardTitle>
                  <CardDescription>Days and hours buyers can book you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasSellerProfile && (
                    <p className="text-sm text-muted-foreground">
                      Complete <Link to="/sell/apply" className="text-primary underline">seller onboarding</Link> to manage availability.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => {
                      const on = availDays.includes(d);
                      return (
                        <button key={d} type="button" onClick={() => toggleDay(d)}
                          className={`rounded-full border px-4 py-1.5 text-sm transition ${
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="as">Start time</Label>
                      <Input id="as" type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ae">End time</Label>
                      <Input id="ae" type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={saveAvailability} disabled={savingAvail || !hasSellerProfile}>
                    {savingAvail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save availability
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Services & pricing</CardTitle>
                    <CardDescription>What you offer to buyers</CardDescription>
                  </div>
                  <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add service</Button>
                </CardHeader>
                <CardContent>
                  {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No services yet. Add your first to start receiving bookings.</p>
                  ) : (
                    <div className="space-y-3">
                      {services.map((s) => (
                        <div key={s.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
                          <div className="min-w-0">
                            <h4 className="font-medium">{s.title}</h4>
                            {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{formatGBP(s.price_pence)}</Badge>
                              <Badge variant="outline">{s.city}</Badge>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteService(s.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />

      <Dialog open={creating || !!editing} onOpenChange={(o) => !o && closeSvc()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="st">Title</Label>
              <Input id="st" value={svcTitle} onChange={(e) => setSvcTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sd">Description</Label>
              <Textarea id="sd" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} rows={3} maxLength={1000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sp">Price (£)</Label>
                <Input id="sp" type="number" step="0.01" min="0" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc">City</Label>
                <Input id="sc" value={svcCity} onChange={(e) => setSvcCity(e.target.value)} maxLength={100} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSvc}>Cancel</Button>
            <Button onClick={saveService} disabled={savingSvc}>
              {savingSvc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BookingRow = ({ b, action }: { b: Booking; action: React.ReactNode }) => (
  <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card-soft sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-12 w-12 border border-border">
        <AvatarImage src={b.buyer?.avatar_url || undefined} />
        <AvatarFallback className="bg-secondary text-primary">{(b.buyer?.display_name ?? "B").charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{b.buyer?.display_name ?? "Buyer"}</p>
        <p className="truncate text-sm text-muted-foreground">{b.service_type ?? "Service"}</p>
        <p className="mt-1 inline-flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {b.booking_date ?? "—"}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {b.booking_time?.slice(0, 5) ?? "—"}</span>
          <span>{formatGBP(b.price_pence)}</span>
        </p>
      </div>
    </div>
    <div className="flex items-center justify-end gap-2">{action}</div>
  </article>
);

const EmptyCard = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <h3 className="font-display text-lg font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const StatCard = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

export default SellerDashboard;

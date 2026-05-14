import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Heart, Loader2, MapPin, Star, Trash2, X } from "lucide-react";
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
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
  seller_id: string;
  seller?: { display_name: string | null; avatar_url: string | null } | null;
  has_review?: boolean;
};

type Favorite = {
  id: string;
  seller_id: string;
  created_at: string;
  seller?: { display_name: string | null; avatar_url: string | null; city: string | null } | null;
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email"),
});

const todayStr = () => new Date().toISOString().slice(0, 10);

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  // review dialog
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        navigate("/auth?redirect=/dashboard/buyer");
        return;
      }
      if (!active) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setDisplayName(profile?.display_name ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);

      const [{ data: bRows }, { data: fRows }, { data: rRows }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id,reference_number,service_type,booking_date,booking_time,status,payment_status,price_pence,seller_id")
          .eq("buyer_id", user.id)
          .order("booking_date", { ascending: false }),
        supabase
          .from("favorites")
          .select("id,seller_id,created_at")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("booking_id").eq("buyer_id", user.id),
      ]);

      const sellerIds = Array.from(
        new Set([...(bRows ?? []).map((b) => b.seller_id), ...(fRows ?? []).map((f) => f.seller_id)]),
      );
      const sellerMap = new Map<string, { display_name: string | null; avatar_url: string | null; city: string | null }>();
      if (sellerIds.length > 0) {
        const { data: sellerProfiles } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url,city")
          .in("id", sellerIds);
        (sellerProfiles ?? []).forEach((p) =>
          sellerMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url, city: p.city }),
        );
      }

      const reviewedSet = new Set((rRows ?? []).map((r) => r.booking_id));

      if (!active) return;
      setBookings(
        (bRows ?? []).map((b) => ({
          ...b,
          seller: sellerMap.get(b.seller_id) ?? null,
          has_review: reviewedSet.has(b.id),
        })),
      );
      setFavorites((fRows ?? []).map((f) => ({ ...f, seller: sellerMap.get(f.seller_id) ?? null })));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [navigate]);

  const today = todayStr();
  const upcoming = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled" && (b.booking_date ?? "") >= today),
    [bookings, today],
  );
  const past = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled" && (b.booking_date ?? "") < today),
    [bookings, today],
  );

  const cancelBooking = async (id: string) => {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setBookings((cur) => cur.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
    toast.success("Booking cancelled");
    void supabase.functions.invoke("notify-booking-cancelled", { body: { booking_id: id } });
  };

  const removeFavorite = async (id: string) => {
    const { error } = await supabase.from("favorites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFavorites((cur) => cur.filter((f) => f.id !== id));
    toast.success("Removed from saved");
  };

  const openReview = (b: Booking) => {
    setReviewBooking(b);
    setRating(5);
    setComment("");
  };

  const submitReview = async () => {
    if (!reviewBooking || !userId) return;
    const parsed = reviewSchema.safeParse({ rating, comment });
    if (!parsed.success) { toast.error("Please add a valid rating"); return; }
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: reviewBooking.id,
      buyer_id: userId,
      seller_id: reviewBooking.seller_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    });
    setSubmittingReview(false);
    if (error) { toast.error(error.message); return; }
    setBookings((cur) => cur.map((b) => (b.id === reviewBooking.id ? { ...b, has_review: true } : b)));
    setReviewBooking(null);
    toast.success("Thanks for your review!");
  };

  const saveProfile = async () => {
    if (!userId) return;
    const parsed = profileSchema.safeParse({ display_name: displayName, email });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    setSavingProfile(true);
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: parsed.data.display_name, avatar_url: avatarUrl });
    if (profileErr) { setSavingProfile(false); toast.error(profileErr.message); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user?.email !== parsed.data.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: parsed.data.email });
      if (emailErr) { setSavingProfile(false); toast.error(emailErr.message); return; }
    }
    setSavingProfile(false);
    toast.success("Profile updated");
  };

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    await supabase.from("profiles").upsert({ id: userId, avatar_url: pub.publicUrl, display_name: displayName });
    setUploading(false);
    toast.success("Photo updated");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <header className="mb-8">
          <Badge variant="secondary" className="mb-3">Buyer dashboard</Badge>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Welcome back{displayName ? `, ${displayName}` : ""}</h1>
          <p className="mt-2 text-muted-foreground">Manage your bookings, saved artisans, and account settings.</p>
        </header>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-6">
              {upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming bookings"
                  body="When you book an artisan, your future appointments will appear here."
                  cta={{ to: "/browse", label: "Browse artisans" }}
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingRow
                      key={b.id}
                      b={b}
                      action={
                        <Button variant="outline" size="sm" onClick={() => cancelBooking(b.id)}>
                          <X className="mr-1 h-4 w-4" /> Cancel
                        </Button>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-6">
              {past.length === 0 ? (
                <EmptyState title="No past bookings yet" body="After your first appointment, you'll be able to leave a review here." />
              ) : (
                <div className="space-y-3">
                  {past.map((b) => (
                    <BookingRow
                      key={b.id}
                      b={b}
                      action={
                        b.has_review ? (
                          <Badge variant="secondary">Reviewed</Badge>
                        ) : (
                          <Button variant="hero" size="sm" onClick={() => openReview(b)}>
                            <Star className="mr-1 h-4 w-4" /> Leave a review
                          </Button>
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-6">
              {favorites.length === 0 ? (
                <EmptyState
                  title="No saved artisans"
                  body="Tap the heart on any artisan profile to save them here."
                  cta={{ to: "/browse", label: "Find artisans" }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {favorites.map((f) => (
                    <article key={f.id} className="rounded-2xl border border-border bg-card p-5 shadow-card-soft">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 border border-border">
                          <AvatarImage src={f.seller?.avatar_url || undefined} />
                          <AvatarFallback className="bg-secondary text-primary">{(f.seller?.display_name ?? "A").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-display text-lg font-semibold">{f.seller?.display_name ?? "Artisan"}</h3>
                          {f.seller?.city && (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {f.seller.city}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                          <Link to={`/seller/${f.seller_id}`}>View profile</Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeFavorite(f.id)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <section className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-semibold">Profile settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">Update your name, email, and profile photo.</p>

                <div className="mt-6 flex items-center gap-4">
                  <Avatar className="h-20 w-20 border border-border">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-secondary text-primary text-2xl">{(displayName || email || "U").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }}
                    />
                    <span className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted">
                      {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : "Change photo"}
                    </span>
                  </label>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dn">Name</Label>
                    <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="em">Email</Label>
                    <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Changing your email sends a confirmation link to the new address.</p>
                  </div>
                </div>

                <Button className="mt-6" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </section>
            </TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />

      <Dialog open={!!reviewBooking} onOpenChange={(o) => !o && setReviewBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a review</DialogTitle>
            <DialogDescription>
              {reviewBooking?.seller?.display_name ?? "Artisan"} · {reviewBooking?.service_type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={`h-7 w-7 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="cm">Comment (optional)</Label>
              <Textarea id="cm" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewBooking(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={submittingReview}>
              {submittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BookingRow = ({ b, action }: { b: Booking; action: React.ReactNode }) => (
  <article className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card-soft">
    <Avatar className="h-12 w-12 border border-border">
      <AvatarImage src={b.seller?.avatar_url || undefined} />
      <AvatarFallback className="bg-secondary text-primary">{(b.seller?.display_name ?? "A").charAt(0)}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold">{b.seller?.display_name ?? "Artisan"}</h3>
        <Badge variant={b.status === "cancelled" ? "outline" : "secondary"} className="capitalize">{b.status}</Badge>
        {b.payment_status && b.payment_status !== "pending" && (
          <Badge variant="outline" className="capitalize">{b.payment_status}</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{b.service_type ?? "Service"}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="h-3 w-3" />
        {b.booking_date} {b.booking_time && `· ${b.booking_time}`} · {formatGBP(b.price_pence)} · Ref {b.reference_number}
      </p>
    </div>
    <div>{action}</div>
  </article>
);

const EmptyState = ({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) => (
  <div className="rounded-2xl border border-dashed border-border p-12 text-center">
    <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
    <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    {cta && (
      <Button asChild className="mt-4"><Link to={cta.to}>{cta.label}</Link></Button>
    )}
  </div>
);

export default BuyerDashboard;

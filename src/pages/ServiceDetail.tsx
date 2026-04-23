import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, ArrowLeft, CalendarCheck, MessageCircle, ShieldCheck, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Service } from "@/components/ServiceCard";

type SellerProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
};

type FullService = Service & {
  seller_id: string | null;
  category_id: string | null;
  created_at: string;
};

type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  is_booked: boolean;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(d, now)) return `Today · ${time}`;
  if (isSameDay(d, tomorrow)) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${time}`;
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);

const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<FullService | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: svc } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (!svc) {
        setLoading(false);
        return;
      }
      setService(svc as FullService);

      const [{ data: prof }, { data: cat }] = await Promise.all([
        svc.seller_id
          ? supabase.from("profiles").select("id,display_name,avatar_url,bio,city").eq("id", svc.seller_id).maybeSingle()
          : Promise.resolve({ data: null }),
        svc.category_id
          ? supabase.from("categories").select("name").eq("id", svc.category_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setSeller((prof as SellerProfile) ?? null);
      setCategory((cat as { name: string } | null)?.name ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load + realtime subscribe to availability slots
  useEffect(() => {
    if (!id) return;
    const loadSlots = async () => {
      const { data } = await supabase
        .from("service_slots")
        .select("id,starts_at,ends_at,is_booked")
        .eq("service_id", id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(20);
      setSlots((data as Slot[]) ?? []);
    };
    loadSlots();

    const channel = supabase
      .channel(`slots-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_slots", filter: `service_id=eq.${id}` },
        () => loadSlots(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const openSlots = slots.filter((s) => !s.is_booked);
  const selectedSlot = openSlots.find((s) => s.id === selectedSlotId) ?? null;
  const canBook = !!selectedSlot;
  const [booking, setBooking] = useState(false);

  const handleMessage = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      navigate(`/auth?redirect=/service/${id}`);
      return;
    }
    toast({ title: "Messaging coming soon", description: "Direct chat with artisans is on the way." });
  };

  const handleBook = async () => {
    if (!service || !selectedSlot) {
      toast({
        title: "Pick a slot first",
        description: "Select an available time from the sidebar to start booking.",
        variant: "destructive",
      });
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      toast({ title: "Sign in required", description: "Please sign in to book this artisan." });
      navigate(`/auth?redirect=/service/${id}`);
      return;
    }
    if (!service.seller_id) {
      toast({ title: "Unavailable", description: "This service has no assigned seller yet.", variant: "destructive" });
      return;
    }
    if (userRes.user.id === service.seller_id) {
      toast({ title: "Can't book yourself", description: "Sellers can't book their own services.", variant: "destructive" });
      return;
    }

    setBooking(true);
    const { error } = await supabase.from("bookings").insert({
      service_id: service.id,
      slot_id: selectedSlot.id,
      buyer_id: userRes.user.id,
      seller_id: service.seller_id,
      price_pence: service.price_pence,
    });
    setBooking(false);

    if (error) {
      toast({
        title: "Couldn't book that slot",
        description: error.message.includes("duplicate")
          ? "Someone just booked this slot. Pick another."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Booking requested!", description: "The artisan will confirm shortly." });
    setSelectedSlotId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-10">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-20 text-center">
          <h1 className="font-display text-3xl font-semibold">Service not found</h1>
          <p className="mt-2 text-muted-foreground">It may have been removed or the link is incorrect.</p>
          <Button asChild className="mt-6"><Link to="/browse">Back to browse</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  const gallery = service.image_url ? [service.image_url, service.image_url, service.image_url] : [];
  const sellerName = seller?.display_name ?? "Artisaneo seller";
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="container py-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/browse"><ArrowLeft className="mr-1 h-4 w-4" /> Back to browse</Link>
          </Button>
        </div>

        <section className="container pb-12">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            {/* Gallery */}
            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-soft shadow-card-soft">
                {gallery.length > 0 ? (
                  <img
                    src={gallery[activeImage]}
                    alt={service.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-hero font-display text-6xl text-primary-foreground/40">
                    {service.title.charAt(0)}
                  </div>
                )}
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-card/95 px-3 py-1.5 text-sm font-semibold text-foreground backdrop-blur">
                  <Star className="h-4 w-4 fill-accent text-accent" />
                  {Number(service.rating ?? 5).toFixed(1)}
                  <span className="text-muted-foreground">({service.review_count ?? 0})</span>
                </div>
              </div>
              {gallery.length > 1 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {gallery.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all ${
                        i === activeImage ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt={`${service.title} ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-10">
                {category && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">{category}</p>
                )}
                <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{service.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {service.city}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> Usually responds within 2h</span>
                </div>

                <div className="mt-8">
                  <h2 className="font-display text-xl font-semibold">About this service</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                    {service.description ?? "No description provided yet."}
                  </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    { icon: ShieldCheck, label: "Verified artisan" },
                    { icon: CalendarCheck, label: "Flexible booking" },
                    { icon: MessageCircle, label: "Direct messaging" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                        <f.icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
                <p className="font-display text-4xl font-semibold text-primary">{formatGBP(service.price_pence)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Final price agreed in chat with the artisan.</p>

                {/* Availability */}
                {(() => {
                  const availableToday = openSlots.some((s) => isSameDay(new Date(s.starts_at), new Date()));
                  const hasAvailability = openSlots.length > 0;
                  return (
                    <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              hasAvailability ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                            }`}
                            aria-hidden
                          />
                          {availableToday
                            ? "Available today"
                            : hasAvailability
                              ? "Upcoming availability"
                              : "Fully booked"}
                        </span>
                        <span className="text-xs text-muted-foreground">{openSlots.length} slots</span>
                      </div>
                      {hasAvailability ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {openSlots.slice(0, 4).map((slot) => {
                            const selected = selectedSlotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlotId(selected ? null : slot.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card hover:border-primary/50"
                                }`}
                              >
                                {formatSlot(slot.starts_at)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No open slots right now. Check back soon — availability updates live.
                        </p>
                      )}
                      {selectedSlot && (
                        <p className="mt-3 text-xs text-primary">
                          Selected: <span className="font-semibold">{formatSlot(selectedSlot.starts_at)}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <Button
                  variant="hero"
                  size="lg"
                  className="mt-6 w-full"
                  onClick={handleBook}
                  disabled={!canBook || booking}
                >
                  <CalendarCheck className="mr-1 h-4 w-4" />
                  {booking
                    ? "Booking..."
                    : openSlots.length === 0
                      ? "No slots available"
                      : canBook
                        ? "Confirm booking"
                        : "Select a slot to book"}
                </Button>
                <Button variant="outline" size="lg" className="mt-3 w-full" onClick={handleMessage}>
                  <MessageCircle className="mr-1 h-4 w-4" /> Message artisan
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
                <h3 className="font-display text-lg font-semibold">Meet your artisan</h3>
                <div className="mt-4 flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    {seller?.avatar_url && <AvatarImage src={seller.avatar_url} alt={sellerName} />}
                    <AvatarFallback className="bg-gradient-gold text-accent-foreground">{sellerInitial}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{sellerName}</p>
                    {seller?.city && (
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {seller.city}
                      </p>
                    )}
                  </div>
                </div>
                {seller?.bio && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{seller.bio}</p>
                )}
                {!seller && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Profile details coming soon. You'll meet the artisan in chat once you start booking.
                  </p>
                )}
                {service.seller_id && (
                  <Button variant="outline" className="mt-5 w-full" asChild>
                    <Link to={`/seller/${service.seller_id}`}>View full seller profile</Link>
                  </Button>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ServiceDetail;

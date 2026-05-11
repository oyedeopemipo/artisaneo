import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, MessageSquare, Star, Store, CalendarCheck, Heart } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Service } from "@/components/ServiceCard";
import { BookingPanel } from "@/components/BookingPanel";
import { getOrCreateConversation } from "@/lib/messaging";

type SellerProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
};

type SellerProfileExtra = {
  user_id: string;
  full_name: string;
  shop_name: string;
  service_category: string;
  availability_days: string[];
  availability_start: string | null;
  availability_end: string | null;
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);

const PublicSellerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [sellerExtra, setSellerExtra] = useState<SellerProfileExtra | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favLoading, setFavLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null));
  }, []);

  useEffect(() => {
    if (!id || !currentUserId) { setFavoriteId(null); return; }
    supabase
      .from("favorites")
      .select("id")
      .eq("buyer_id", currentUserId)
      .eq("seller_id", id)
      .maybeSingle()
      .then(({ data }) => setFavoriteId(data?.id ?? null));
  }, [id, currentUserId]);

  const toggleFavorite = async () => {
    if (!id) return;
    if (!currentUserId) { window.location.href = `/auth?redirect=/seller/${id}`; return; }
    setFavLoading(true);
    if (favoriteId) {
      const { error } = await supabase.from("favorites").delete().eq("id", favoriteId);
      setFavLoading(false);
      if (error) { toast.error(error.message); return; }
      setFavoriteId(null);
      toast.success("Removed from saved");
    } else {
      const { data, error } = await supabase
        .from("favorites")
        .insert({ buyer_id: currentUserId, seller_id: id })
        .select("id")
        .single();
      setFavLoading(false);
      if (error) { toast.error(error.message); return; }
      setFavoriteId(data.id);
      toast.success("Saved to your dashboard");
    }
  };

  const handleMessage = async () => {
    if (!id) return;
    if (!currentUserId) { window.location.href = `/auth?redirect=/seller/${id}`; return; }
    if (currentUserId === id) { toast.error("You can't message yourself"); return; }
    setMessageLoading(true);
    const convId = await getOrCreateConversation({ buyerId: currentUserId, sellerId: id });
    setMessageLoading(false);
    if (!convId) { toast.error("Could not start conversation"); return; }
    navigate(`/messages?c=${convId}`);
  };

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      const [{ data: profile }, { data: sellerServices }, { data: extra }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,avatar_url,bio,city").eq("id", id).maybeSingle(),
        supabase
          .from("services")
          .select("id,title,description,price_pence,city,rating,review_count,image_url,seller_id")
          .eq("seller_id", id)
          .order("rating", { ascending: false }),
        supabase
          .from("seller_profiles")
          .select("user_id,full_name,shop_name,service_category,availability_days,availability_start,availability_end")
          .eq("user_id", id)
          .maybeSingle(),
      ]);

      if (!active) return;

      setSeller((profile as SellerProfile) ?? null);
      setServices((sellerServices as Service[]) ?? []);
      setSellerExtra((extra as SellerProfileExtra) ?? null);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  const sellerName = seller?.display_name ?? "Artisaneo seller";
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  const stats = useMemo(() => {
    const reviewTotal = services.reduce((sum, service) => sum + (service.review_count ?? 0), 0);
    const ratedServices = services.filter((service) => typeof service.rating === "number");
    const avgRating = ratedServices.length
      ? ratedServices.reduce((sum, service) => sum + Number(service.rating ?? 0), 0) / ratedServices.length
      : null;

    return {
      reviewTotal,
      avgRating,
      serviceCount: services.length,
    };
  }, [services]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-10">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-6 h-64 rounded-2xl" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!seller && services.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-20 text-center">
          <h1 className="font-display text-3xl font-semibold">Seller not found</h1>
          <p className="mt-2 text-muted-foreground">This artisan profile may have been removed or is not available yet.</p>
          <Button asChild className="mt-6">
            <Link to="/browse">Back to browse</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-soft">
          <div className="container py-6">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/browse">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to browse
              </Link>
            </Button>
          </div>
          <div className="container pb-12 pt-2">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Seller profile</Badge>
                  <Badge variant="secondary">Public portfolio</Badge>
                </div>
                <div className="mt-6 flex items-start gap-5">
                  <Avatar className="h-24 w-24 border border-border">
                    <AvatarImage src={seller?.avatar_url || undefined} alt={sellerName} />
                    <AvatarFallback className="bg-secondary font-display text-3xl text-primary">{sellerInitial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h1 className="font-display text-4xl font-semibold md:text-5xl">{sellerName}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {seller?.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> {seller.city}
                        </span>
                      )}
                      {stats.avgRating !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-4 w-4 fill-accent text-accent" /> {stats.avgRating.toFixed(1)} average rating
                        </span>
                      )}
                      <span>{stats.reviewTotal} reviews</span>
                    </div>
                    <p className="mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
                      {seller?.bio ?? "This artisan has started listing services on Artisaneo. Browse the portfolio below to explore their work."}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button size="lg" variant="hero" onClick={() => setBookingOpen(true)}>
                        <CalendarCheck className="mr-2 h-5 w-5" /> Book Now
                      </Button>
                      <Button size="lg" variant="outline" onClick={handleMessage} disabled={messageLoading}>
                        <MessageSquare className="mr-2 h-5 w-5" /> Message
                      <Button size="lg" variant="outline" onClick={toggleFavorite} disabled={favLoading}>
                        <Heart className={`mr-2 h-5 w-5 ${favoriteId ? "fill-primary text-primary" : ""}`} />
                        {favoriteId ? "Saved" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  { icon: Store, label: "Active listings", value: stats.serviceCount.toString() },
                  { icon: Star, label: "Portfolio rating", value: stats.avgRating !== null ? stats.avgRating.toFixed(1) : "New" },
                  { icon: CalendarCheck, label: "Buyer reviews", value: stats.reviewTotal.toString() },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
                    <p className="inline-flex items-center gap-2 text-sm font-medium">
                      <item.icon className="h-4 w-4 text-primary" /> {item.label}
                    </p>
                    <p className="mt-3 font-display text-3xl font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold">Portfolio</h2>
              <p className="mt-2 text-muted-foreground">Open a listing to view full details, live availability, and booking options.</p>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No public listings yet.</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <article key={service.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <Link to={`/service/${service.id}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-soft">
                      {service.image_url ? (
                        <img src={service.image_url} alt={service.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-hero font-display text-4xl text-primary-foreground/40">
                          {service.title.charAt(0)}
                        </div>
                      )}
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
                        <Star className="h-3 w-3 fill-accent text-accent" /> {Number(service.rating ?? 5).toFixed(1)}
                      </div>
                    </div>
                  </Link>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-semibold">{service.title}</h3>
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" /> {service.city}
                        </p>
                      </div>
                      <p className="font-display text-2xl font-semibold text-primary">{formatGBP(service.price_pence)}</p>
                    </div>
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
                      <span>{service.review_count ?? 0} reviews</span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/service/${service.id}`}>View listing</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
      {sellerExtra && id && (
        <BookingPanel
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          seller={sellerExtra}
          defaultPricePence={services[0]?.price_pence ?? 5000}
        />
      )}
      {!sellerExtra && id && seller && (
        <BookingPanel
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          seller={{
            user_id: id,
            full_name: seller.display_name ?? "Artisan",
            shop_name: seller.display_name ?? "Artisan",
            service_category: "",
            availability_days: [],
            availability_start: null,
            availability_end: null,
          }}
          defaultPricePence={services[0]?.price_pence ?? 5000}
        />
      )}
    </div>
  );
};

export default PublicSellerProfile;
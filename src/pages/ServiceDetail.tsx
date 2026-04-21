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

  const handleBook = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast({ title: "Sign in required", description: "Please sign in to book this artisan." });
      navigate(`/auth?redirect=/service/${id}`);
      return;
    }
    toast({ title: "Booking flow coming soon", description: "We'll guide you to confirm your slot shortly." });
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

                <Button variant="hero" size="lg" className="mt-6 w-full" onClick={handleBook}>
                  <CalendarCheck className="mr-1 h-4 w-4" /> Start booking
                </Button>
                <Button variant="outline" size="lg" className="mt-3 w-full" onClick={handleBook}>
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

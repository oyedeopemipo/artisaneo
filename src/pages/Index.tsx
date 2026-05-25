import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { SocialProof } from "@/components/SocialProof";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ServiceCard, type Service } from "@/components/ServiceCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Search, MessageCircle, CalendarCheck, UserPlus, Clock, PoundSterling } from "lucide-react";

type Category = { id: string; slug: string; name: string; icon: string | null };

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => setCategories(data ?? []));
    supabase.from("services").select("*").order("rating", { ascending: false }).limit(8)
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />

        {/* How it works — two columns */}
        <section className="bg-secondary/40 py-20">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="font-display text-3xl font-semibold md:text-4xl">How Artisaneo works</h2>
              <p className="mt-2 text-muted-foreground">Whether you're booking or selling, we've made it simple.</p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Buyers column */}
              <div className="rounded-2xl border border-border bg-card p-8 shadow-card-soft">
                <h3 className="font-display text-xl font-semibold">For buyers</h3>
                <p className="mt-1 text-sm text-muted-foreground">Find and book the perfect artisan in three steps.</p>
                <div className="mt-6 space-y-6">
                  {[
                    { icon: Search, title: "Search by service and location", desc: "Browse artisans by craft, city and budget." },
                    { icon: MessageCircle, title: "Browse profiles and read reviews", desc: "Check ratings, portfolios and past client feedback." },
                    { icon: CalendarCheck, title: "Book and pay securely", desc: "Reserve your slot and pay safely through the platform." },
                  ].map((s, i) => (
                    <div key={s.title} className="flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-gold text-accent-foreground shadow-gold">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-accent">Step {i + 1}</p>
                        <p className="font-medium leading-snug">{s.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-8 w-full sm:w-auto">
                  <Link to="/browse">Find an artisan <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>

              {/* Sellers column */}
              <div className="rounded-2xl border border-border bg-card p-8 shadow-card-soft">
                <h3 className="font-display text-xl font-semibold">For sellers</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start earning from your craft in minutes.</p>
                <div className="mt-6 space-y-6">
                  {[
                    { icon: UserPlus, title: "Create your free profile", desc: "Sign up and tell customers about your skills and story." },
                    { icon: Clock, title: "Set your availability and prices", desc: "Choose when you work and how much you charge." },
                    { icon: PoundSterling, title: "Get booked and earn", desc: "Accept bookings, deliver great work, and get paid." },
                  ].map((s, i) => (
                    <div key={s.title} className="flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-gold text-accent-foreground shadow-gold">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-accent">Step {i + 1}</p>
                        <p className="font-medium leading-snug">{s.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" asChild className="mt-8 w-full sm:w-auto">
                  <Link to="/become-a-seller">Become a seller <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <CategoryGrid categories={categories} />

        {/* Featured services */}
        <section className="container py-20">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">Featured artisans</h2>
              <p className="mt-2 text-muted-foreground">Hand-picked, top-rated services across the UK.</p>
            </div>
            <Button variant="ghost" asChild className="hidden md:inline-flex">
              <Link to="/browse">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => <ServiceCard key={s.id} service={s} />)}
          </div>
        </section>

        {/* CTA */}
        <section className="container pb-20">
          <div className="overflow-hidden rounded-3xl bg-gradient-hero p-10 text-center text-primary-foreground shadow-elegant md:p-16">
            <h2 className="font-display text-3xl font-semibold md:text-5xl">Are you an artisan?</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Join hundreds of UK creatives growing their business on Artisaneo. List your services in minutes.
            </p>
            <Button variant="hero" size="lg" asChild className="mt-8">
              <Link to="/become-a-seller">Start selling today</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

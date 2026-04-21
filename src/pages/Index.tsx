import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ServiceCard, type Service } from "@/components/ServiceCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Search, MessageCircle, CalendarCheck } from "lucide-react";

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
        <CategoryGrid categories={categories} />

        {/* How it works */}
        <section className="bg-secondary/40 py-20">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="font-display text-3xl font-semibold md:text-4xl">How Artisaneo works</h2>
              <p className="mt-2 text-muted-foreground">Three simple steps to your next booking.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Search, title: "Discover", desc: "Search and filter trusted artisans by craft, city and budget." },
                { icon: MessageCircle, title: "Connect", desc: "Message directly to discuss details and agree on pricing." },
                { icon: CalendarCheck, title: "Book", desc: "Reserve your slot and pay securely — all in one place." },
              ].map((s, i) => (
                <div key={s.title} className="rounded-2xl border border-border bg-card p-8 shadow-card-soft">
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold text-accent-foreground shadow-gold">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">Step {i + 1}</p>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

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
              <Link to="/auth?mode=signup">Start selling today</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

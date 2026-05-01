import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Wand2, ShieldCheck, Sparkles } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Reach new customers",
    desc: "Get discovered by thousands of UK shoppers actively looking for handmade craft.",
  },
  {
    icon: Wand2,
    title: "Easy listing tools",
    desc: "Set up your shop in minutes with simple forms, photos, and bookable time slots.",
  },
  {
    icon: ShieldCheck,
    title: "Secure payments",
    desc: "Get paid reliably with built-in protection for both you and your buyers.",
  },
];

const BecomeASeller = () => (
  <div className="flex min-h-screen flex-col bg-background">
    <Navbar />
    <main>
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: "radial-gradient(60% 60% at 80% 20%, hsl(var(--accent)) 0%, transparent 60%)" }}
        />
        <div className="container relative py-20 md:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> For UK artisans
            </span>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-6xl">
              Turn your craft into a{" "}
              <span className="bg-gradient-gold bg-clip-text text-transparent">business</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/80">
              Join hundreds of UK creatives selling on Artisaneo. Open your shop, share your work,
              and start booking orders in minutes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/sell/apply">
                  Start selling <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <Link to="/browse">Explore the marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Why sell on Artisaneo</h2>
          <p className="mt-2 text-muted-foreground">Everything you need to grow your craft business.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-8 shadow-card-soft">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold text-accent-foreground shadow-gold">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-hero p-10 text-center text-primary-foreground shadow-elegant md:p-16">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Ready to open your shop?</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            It only takes a few minutes to apply. We'll review your application and get you set up.
          </p>
          <Button variant="hero" size="lg" asChild className="mt-8">
            <Link to="/sell/apply">Start selling</Link>
          </Button>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default BecomeASeller;

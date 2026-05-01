import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Star } from "lucide-react";
import heroImage from "@/assets/hero-artisan.jpg";

export const Hero = () => (
  <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
    <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(60% 60% at 80% 20%, hsl(var(--accent)) 0%, transparent 60%)" }} />
    <div className="container relative grid gap-12 py-20 md:grid-cols-2 md:py-28 lg:py-32">
      <div className="flex flex-col justify-center animate-fade-in-up">
        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" /> Trusted by 1,000+ UK artisans
        </span>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-6xl lg:text-7xl">
          Book the UK's most <span className="bg-gradient-gold bg-clip-text text-transparent">talented artisans</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-primary-foreground/80">
          From bridal makeup in Manchester to private chefs in Edinburgh — discover, message and book vetted local artisans in minutes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/browse">Browse artisans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button variant="glass" size="lg" asChild>
            <Link to="/become-a-seller">Become a seller</Link>
          </Button>
        </div>
        <div className="mt-10 flex items-center gap-6 text-sm text-primary-foreground/70">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Vetted profiles</div>
          <div className="flex items-center gap-2"><Star className="h-4 w-4 fill-accent text-accent" /> 4.9 avg rating</div>
        </div>
      </div>
      <div className="relative animate-fade-in-up">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-gold opacity-30 blur-2xl" />
        <img
          src={heroImage}
          alt="A skilled UK artisan styling a client's hair in a sunlit boutique studio"
          width={1600}
          height={1200}
          className="relative aspect-[4/3] w-full rounded-2xl object-cover shadow-elegant"
        />
      </div>
    </div>
  </section>
);

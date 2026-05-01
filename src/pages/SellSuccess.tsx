import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Mail, Sparkles } from "lucide-react";

const SellSuccess = () => {
  const [params] = useSearchParams();
  const shop = params.get("shop")?.trim() || "your shop";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container max-w-2xl py-16 md:py-24">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-elegant md:p-12">
          <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-gold text-accent-foreground shadow-gold">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">
            Thanks — {shop} is on its way!
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            We've received your seller application. Here's what happens next.
          </p>

          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            <Step icon={Clock} title="Review" desc="We'll review within 2–3 business days." />
            <Step icon={Mail} title="Email" desc="You'll get an email with your decision." />
            <Step icon={Sparkles} title="Launch" desc="Once approved, set up your first listing." />
          </div>

          <div className="mt-10">
            <Button variant="hero" size="lg" asChild>
              <Link to="/browse">Explore the marketplace</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Step = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Clock;
  title: string;
  desc: string;
}) => (
  <div className="rounded-2xl border border-border bg-secondary/40 p-5">
    <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-accent-foreground shadow-gold">
      <Icon className="h-4 w-4" />
    </span>
    <h3 className="font-display text-lg font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
  </div>
);

export default SellSuccess;

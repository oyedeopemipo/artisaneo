import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Stat counter with count-up animation ──

const useCountUp = (target: number, duration = 1600) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
};

// ── Stat display components ──

const StatCounter = ({ target, suffix, label }: { target: number; suffix: string; label: string }) => {
  const { value, ref } = useCountUp(target);
  return (
    <div ref={ref} className="text-center">
      <p className="font-display text-4xl font-semibold text-foreground md:text-5xl">
        {value.toLocaleString()}{suffix}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
};

const RatingStat = () => {
  const whole = useCountUp(4);
  const decimal = useCountUp(8);
  return (
    <div ref={whole.ref} className="text-center">
      <div className="flex items-center justify-center gap-1">
        <p className="font-display text-4xl font-semibold text-foreground md:text-5xl">
          4.{decimal.value}
        </p>
        <Star className="h-7 w-7 fill-accent text-accent md:h-8 md:w-8" />
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">average rating</p>
    </div>
  );
};

// ── Testimonials ──

const TESTIMONIALS = [
  {
    name: "Priya K.",
    rating: 5,
    quote: "Found an incredible makeup artist for my wedding in under 10 minutes. The whole booking was seamless.",
    service: "Makeup Artistry",
  },
  {
    name: "James T.",
    rating: 5,
    quote: "Booked a private chef for a dinner party and the food was outstanding. Will definitely use again.",
    service: "Catering",
  },
  {
    name: "Amara S.",
    rating: 4,
    quote: "The photographer we hired captured our event beautifully. Great communication from start to finish.",
    service: "Photography",
  },
  {
    name: "Oliver R.",
    rating: 5,
    quote: "Had my hair styled for a shoot — arrived on time, super professional, and the results were perfect.",
    service: "Hairdressing",
  },
];

export const SocialProof = () => {
  return (
    <section className="border-y border-border bg-secondary/30">
      {/* Stat counters */}
      <div className="container py-14">
        <div className="mx-auto grid max-w-2xl gap-8 sm:grid-cols-3">
          <StatCounter target={500} suffix="+" label="artisans" />
          <StatCounter target={2000} suffix="+" label="bookings made" />
          <RatingStat />
        </div>
      </div>

      {/* Testimonials */}
      <div className="border-t border-border">
        <div className="container py-14">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            What people are saying
          </h2>
          <p className="mt-1 text-muted-foreground">Real experiences from the Artisaneo community.</p>

          <div className="mt-8 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="w-[300px] shrink-0 snap-start rounded-xl border border-border bg-card p-6 shadow-card-soft transition-shadow hover:shadow-elegant"
              >
                <div className="mb-3 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Star
                      key={si}
                      className={cn(
                        "h-4 w-4",
                        si < t.rating ? "fill-accent text-accent" : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm font-medium">{t.name}</p>
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    {t.service}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

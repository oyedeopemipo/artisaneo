import { Link } from "react-router-dom";
import {
  Scissors, Sparkles, UtensilsCrossed, Paintbrush, Music, Palette,
  Disc3, GraduationCap, PartyPopper, Camera, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Scissors, Sparkles, UtensilsCrossed, Paintbrush, Music, Palette, Disc3, GraduationCap, PartyPopper, Camera,
};

type Category = { id: string; slug: string; name: string; icon: string | null };

export const CategoryGrid = ({ categories }: { categories: Category[] }) => (
  <section className="container py-20">
    <div className="mb-10 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Explore by craft</h2>
        <p className="mt-2 text-muted-foreground">Eleven categories of trusted artisans, all in one place.</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {categories.map((c) => {
        const Icon = ICONS[c.icon ?? "Sparkles"] ?? Sparkles;
        return (
          <Link
            key={c.id}
            to={`/browse?category=${c.slug}`}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center shadow-card-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant"
          >
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-accent-soft text-primary transition-colors group-hover:bg-gradient-gold group-hover:text-accent-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{c.name}</span>
          </Link>
        );
      })}
    </div>
  </section>
);

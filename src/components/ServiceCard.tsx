import { Star, MapPin } from "lucide-react";

export type Service = {
  id: string;
  title: string;
  description: string | null;
  price_pence: number;
  city: string;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);

export const ServiceCard = ({ service }: { service: Service }) => (
  <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-soft">
      {service.image_url ? (
        <img src={service.image_url} alt={service.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-hero font-display text-4xl text-primary-foreground/40">
          {service.title.charAt(0)}
        </div>
      )}
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
        <Star className="h-3 w-3 fill-accent text-accent" /> {Number(service.rating ?? 5).toFixed(1)}
      </div>
    </div>
    <div className="flex flex-1 flex-col p-5">
      <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{service.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> {service.city}
        <span className="mx-1.5">·</span>
        <span>{service.review_count ?? 0} reviews</span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
          <p className="font-display text-2xl font-semibold text-primary">{formatGBP(service.price_pence)}</p>
        </div>
      </div>
    </div>
  </article>
);

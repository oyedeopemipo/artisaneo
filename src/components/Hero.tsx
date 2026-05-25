import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; slug: string; name: string };

// The 6 category pills shown below the search bar
const HERO_CATEGORIES = ["hair", "makeup", "photo", "catering", "music", "other"];

export const Hero = () => {
  const navigate = useNavigate();
  const [serviceInput, setServiceInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCities, setAllCities] = useState<string[]>([]);
  const serviceRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("categories").select("id,slug,name").order("name").then(({ data }) => setCategories(data ?? []));
    supabase.from("services").select("city").then(({ data }) => {
      const cities = [...new Set((data ?? []).map((d) => d.city).filter(Boolean))];
      setAllCities(cities);
    });
  }, []);

  // Close suggestion dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setShowLocSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleServiceChange = (value: string) => {
    setServiceInput(value);
    if (value.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = value.toLowerCase();
    const matched = categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => c.name);
    // Also match common service keywords
    const keywords = ["Hair", "Makeup", "Photography", "Catering", "Music", "DJ", "Nails", "Painting", "Tutoring", "Events"];
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(q) && !matched.includes(kw)) matched.push(kw);
    }
    setSuggestions(matched.slice(0, 6));
    setShowSuggestions(matched.length > 0);
  };

  const handleLocationChange = (value: string) => {
    setLocationInput(value);
    if (value.trim().length === 0) {
      setLocationSuggestions([]);
      setShowLocSuggestions(false);
      return;
    }
    const q = value.toLowerCase();
    const matched = allCities.filter((c) => c.toLowerCase().includes(q)).slice(0, 5);
    // Add UK postcode prefix suggestions for common patterns
    const postcodePrefixes = ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Liverpool", "Leeds", "Glasgow", "Cardiff", "Belfast"];
    for (const p of postcodePrefixes) {
      if (p.toLowerCase().includes(q) && !matched.includes(p)) matched.push(p);
    }
    setLocationSuggestions(matched.slice(0, 6));
    setShowLocSuggestions(matched.length > 0);
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (serviceInput) params.set("q", serviceInput);
    if (locationInput) params.set("location", locationInput);
    navigate(`/browse?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const heroCats = categories.filter((c) => HERO_CATEGORIES.includes(c.slug));
  // Fallback if DB doesn't have these exact slugs
  const displayCats = heroCats.length >= 4
    ? heroCats.slice(0, 6)
    : categories.slice(0, 6);

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden bg-gradient-hero md:min-h-[calc(100vh-5rem)]">
      {/* Background glow */}
      <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(60% 60% at 80% 20%, hsl(var(--accent)) 0%, transparent 60%)" }} />

      <div className="container relative mx-auto w-full px-4">
        <div className="mx-auto max-w-3xl text-center">
          {/* Trust badge */}
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur mx-auto">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" /> Trusted by 1,000+ UK artisans
          </span>

          {/* Headline */}
          <h1 className="animate-fade-in-up font-display text-4xl font-semibold leading-[1.1] text-primary-foreground md:text-5xl lg:text-6xl">
            Book the UK's most{" "}
            <span className="bg-gradient-gold bg-clip-text text-transparent">talented artisans</span>
          </h1>
          <p className="mt-4 text-base text-primary-foreground/75 md:text-lg">
            From bridal makeup in Manchester to private chefs in Edinburgh — find and book vetted local creatives.
          </p>

          {/* Search bar */}
          <div className="mt-8 animate-fade-in-up">
            <div className="flex flex-col gap-0 overflow-hidden rounded-2xl bg-card shadow-elegant md:flex-row md:gap-0 md:rounded-xl">
              {/* Service input */}
              <div ref={serviceRef} className="relative flex-1 border-b border-border md:border-b-0 md:border-r">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={serviceInput}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hair, Photography, Catering..."
                  className="h-14 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0 md:h-16"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card py-1 shadow-lg">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                        onClick={() => {
                          setServiceInput(s);
                          setShowSuggestions(false);
                        }}
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Location input */}
              <div ref={locationRef} className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={locationInput}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => locationSuggestions.length > 0 && setShowLocSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="City or postcode..."
                  className="h-14 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0 md:h-16"
                />
                {showLocSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card py-1 shadow-lg">
                    {locationSuggestions.map((s) => (
                      <button
                        key={s}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                        onClick={() => {
                          setLocationInput(s);
                          setShowLocSuggestions(false);
                        }}
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search button */}
              <div className="flex items-stretch p-2 md:p-2">
                <Button
                  onClick={handleSearch}
                  className="h-full w-full rounded-lg px-8 text-base font-semibold md:rounded-md md:w-auto"
                  size="lg"
                >
                  Find an artisan
                </Button>
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up">
            {displayCats.map((c) => (
              <Link
                key={c.id}
                to={`/browse?categories=${c.slug}`}
                className={cn(
                  "rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2 text-sm font-medium text-primary-foreground backdrop-blur transition-all",
                  "hover:bg-primary-foreground/20 hover:border-primary-foreground/30",
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-primary-foreground/60">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Vetted profiles</div>
            <div className="flex items-center gap-2"><Star className="h-4 w-4 fill-accent text-accent" /> 4.9 avg rating</div>
          </div>
        </div>
      </div>
    </section>
  );
};

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ServiceCard, type Service } from "@/components/ServiceCard";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type Category = { id: string; slug: string; name: string };
type ServiceWithCat = Service & { category_id: string | null };

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const activeSlug = params.get("category") ?? "all";
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<ServiceWithCat[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.from("categories").select("id,slug,name").order("name").then(({ data }) => setCategories(data ?? []));
    supabase.from("services").select("*").order("rating", { ascending: false })
      .then(({ data }) => setServices((data as ServiceWithCat[]) ?? []));
  }, []);

  const activeCategory = useMemo(() => categories.find((c) => c.slug === activeSlug), [categories, activeSlug]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (activeCategory && s.category_id !== activeCategory.id) return false;
      if (query && !`${s.title} ${s.description ?? ""} ${s.city}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [services, activeCategory, query]);

  const setCat = (slug: string) => {
    if (slug === "all") setParams({});
    else setParams({ category: slug });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-soft">
          <div className="container py-10">
            <h1 className="font-display text-4xl font-semibold md:text-5xl">Browse artisans</h1>
            <p className="mt-2 text-muted-foreground">Find the perfect creative for your next moment.</p>
            <div className="relative mt-6 max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by service, city or keyword..."
                className="h-12 pl-11"
              />
            </div>
          </div>
        </section>

        <section className="container py-8">
          <div className="flex flex-wrap gap-2">
            <Button variant={activeSlug === "all" ? "default" : "outline"} size="sm" onClick={() => setCat("all")}>
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={activeSlug === c.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setCat(c.slug)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "result" : "results"}</p>

          {filtered.length === 0 ? (
            <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No artisans found. Try a different category or search.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Browse;

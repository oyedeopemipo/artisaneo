import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ServiceCard, type Service } from "@/components/ServiceCard";
import { FilterBar, type FilterState, defaultFilters } from "@/components/FilterBar";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type Category = { id: string; slug: string; name: string };
type ServiceWithCat = Service & { category_id: string | null; created_at: string };

// Parse filters from URL search params
const parseFiltersFromURL = (params: URLSearchParams, categories: Category[]): FilterState => {
  const query = params.get("q") ?? "";
  const location = params.get("location") ?? "";
  const priceMin = Number(params.get("priceMin")) || 0;
  const priceMax = Number(params.get("priceMax")) || 50000;
  const minRating = Number(params.get("minRating")) || 0;
  const availabilityDate = params.get("date") ?? "";
  const sort = (params.get("sort") as FilterState["sort"]) || "popular";

  // Categories from URL — comma-separated slugs
  const catSlugs = params.get("categories") ?? "";
  const categoryList = catSlugs
    ? catSlugs.split(",").filter((s) => categories.some((c) => c.slug === s))
    : [];

  return {
    query,
    categories: categoryList,
    location,
    priceMin,
    priceMax: priceMax > 0 ? priceMax : 50000,
    minRating,
    availabilityDate,
    sort,
  };
};

// Serialize filters to URL search params
const serializeFilters = (f: FilterState): Record<string, string> => {
  const p: Record<string, string> = {};
  if (f.query) p.q = f.query;
  if (f.categories.length > 0) p.categories = f.categories.join(",");
  if (f.location) p.location = f.location;
  if (f.priceMin > 0) p.priceMin = String(f.priceMin);
  if (f.priceMax < 50000) p.priceMax = String(f.priceMax);
  if (f.minRating > 0) p.minRating = String(f.minRating);
  if (f.availabilityDate) p.date = f.availabilityDate;
  if (f.sort !== "popular") p.sort = f.sort;
  return p;
};

// Count active (non-default) filters for badge
const countActiveFilters = (f: FilterState): number => {
  let count = 0;
  if (f.query) count++;
  if (f.categories.length > 0) count++;
  if (f.location) count++;
  if (f.priceMin > 0 || f.priceMax < 50000) count++;
  if (f.minRating > 0) count++;
  if (f.availabilityDate) count++;
  if (f.sort !== "popular") count++;
  return count;
};

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<ServiceWithCat[]>([]);
  const [activeSellerIds, setActiveSellerIds] = useState<Set<string>>(new Set());
  const [availableServiceIds, setAvailableServiceIds] = useState<Set<string> | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Load categories once
  useEffect(() => {
    supabase
      .from("categories")
      .select("id,slug,name")
      .order("name")
      .then(({ data }) => {
        setCategories(data ?? []);
        setCategoriesLoaded(true);
      });
  }, []);

  // Load services and active seller IDs once
  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .order("rating", { ascending: false })
      .then(({ data }) => setServices((data as ServiceWithCat[]) ?? []));

    supabase
      .from("seller_profiles")
      .select("user_id")
      .eq("status", "active")
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((s) => s.user_id));
        setActiveSellerIds(ids);
      });
  }, []);

  // Parse filters from URL once categories are loaded
  useEffect(() => {
    if (!categoriesLoaded) return;
    setFilters(parseFiltersFromURL(params, categories));
    // Only run on mount + when categories load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesLoaded]);

  // Availability query: find which services have open slots on a date
  useEffect(() => {
    if (!filters.availabilityDate) {
      setAvailableServiceIds(null);
      return;
    }

    const loadAvailability = async () => {
      const startOfDay = `${filters.availabilityDate}T00:00:00Z`;
      const endOfDay = `${filters.availabilityDate}T23:59:59Z`;

      const { data: slots } = await supabase
        .from("service_slots")
        .select("service_id")
        .eq("is_booked", false)
        .gte("starts_at", startOfDay)
        .lte("starts_at", endOfDay);

      const ids = new Set((slots ?? []).map((s) => s.service_id));
      setAvailableServiceIds(ids);
    };

    void loadAvailability();
  }, [filters.availabilityDate]);

  // Sync filters to URL (debounce-free: URL updates are cheap)
  const updateFilters = useCallback(
    (partial: Partial<FilterState>) => {
      setFilters((prev) => {
        const next = { ...prev, ...partial };
        const serialized = serializeFilters(next);
        setParams(serialized, { replace: true });
        return next;
      });
    },
    [setParams],
  );

  const clearAll = useCallback(() => {
    setFilters(defaultFilters);
    setParams({}, { replace: true });
  }, [setParams]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  // Build a lookup for category slug -> id
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories],
  );

  // Filter + sort
  const filtered = useMemo(() => {
    let result = services.filter((s) => {
      // Only show services from active sellers
      if (activeSellerIds.size > 0 && !activeSellerIds.has(s.seller_id)) return false;

      // Category filter (multi-select)
      if (filters.categories.length > 0) {
        const catIds = filters.categories.map((slug) => categoryMap.get(slug)?.id).filter(Boolean);
        if (!catIds.includes(s.category_id)) return false;
      }

      // Text search
      if (filters.query) {
        const haystack = `${s.title} ${s.description ?? ""} ${s.city}`.toLowerCase();
        if (!haystack.includes(filters.query.toLowerCase())) return false;
      }

      // Location filter (city/postcode match)
      if (filters.location) {
        const loc = filters.location.toLowerCase().trim();
        const city = (s.city ?? "").toLowerCase();
        // Match if city contains the search or search contains the city
        if (!city.includes(loc) && !loc.includes(city)) return false;
      }

      // Price range (compare pence)
      if (s.price_pence < filters.priceMin) return false;
      if (filters.priceMax < 50000 && s.price_pence > filters.priceMax) return false;

      // Minimum star rating
      if (filters.minRating > 0 && (s.rating ?? 0) < filters.minRating) return false;

      // Availability date
      if (filters.availabilityDate && availableServiceIds !== null) {
        if (!availableServiceIds.has(s.id)) return false;
      }

      return true;
    });

    // Sort
    switch (filters.sort) {
      case "rating":
        result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "price_asc":
        result.sort((a, b) => a.price_pence - b.price_pence);
        break;
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case "popular":
      default:
        result.sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0));
        break;
    }

    return result;
  }, [services, filters, categoryMap, availableServiceIds, activeSellerIds]);

  const isAvailabilityLoading = filters.availabilityDate && availableServiceIds === null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-soft">
          <div className="container py-10">
            <h1 className="font-display text-4xl font-semibold md:text-5xl">
              Browse artisans
            </h1>
            <p className="mt-2 text-muted-foreground">
              Find the perfect creative for your next moment.
            </p>
          </div>
        </section>

        <section className="container py-8">
          <FilterBar
            filters={filters}
            onChange={updateFilters}
            categories={categories}
            activeFilterCount={activeFilterCount}
            onClearAll={clearAll}
          />

          {/* Result count */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isAvailabilityLoading
                ? "Checking availability..."
                : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
            </p>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <SlidersHorizontal className="h-3 w-3" />
                {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active
              </Badge>
            )}
          </div>

          {filtered.length === 0 && !isAvailabilityLoading ? (
            <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">
                No artisans match your filters. Try broadening your search.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Browse;

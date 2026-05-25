import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, Star, MapPin, Calendar as CalendarIcon, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; slug: string; name: string };

export type FilterState = {
  query: string;
  categories: string[]; // slugs
  location: string;
  priceMin: number;
  priceMax: number;
  minRating: number;
  availabilityDate: string; // ISO date or ""
  sort: "popular" | "rating" | "price_asc" | "newest";
};

export const defaultFilters: FilterState = {
  query: "",
  categories: [],
  location: "",
  priceMin: 0,
  priceMax: 50000, // £500 in pence
  minRating: 0,
  availabilityDate: "",
  sort: "popular",
};

const PRICE_MAX = 50000;

const formatGBP = (pence: number) =>
  pence >= PRICE_MAX
    ? "£500+"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(pence / 100);

const STAR_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

type Props = {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  categories: Category[];
  activeFilterCount: number;
  onClearAll: () => void;
};

export const FilterBar = ({
  filters,
  onChange,
  categories,
  activeFilterCount,
  onClearAll,
}: Props) => {
  const toggleCategory = (slug: string) => {
    const next = filters.categories.includes(slug)
      ? filters.categories.filter((s) => s !== slug)
      : [...filters.categories, slug];
    onChange({ categories: next });
  };

  const anyFilterActive = activeFilterCount > 0;

  return (
    <div className="space-y-4">
      {/* Search + sort row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Search by service, city or keyword..."
            className="h-10 pl-10"
          />
          {filters.query && (
            <button
              onClick={() => onChange({ query: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select
          value={filters.sort}
          onValueChange={(v) =>
            onChange({ sort: v as FilterState["sort"] })
          }
        >
          <SelectTrigger className="h-10 w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most popular</SelectItem>
            <SelectItem value="rating">Highest rated</SelectItem>
            <SelectItem value="price_asc">Lowest price</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filters.categories.length === 0 ? "default" : "outline"}
          size="sm"
          onClick={() => onChange({ categories: [] })}
        >
          All
        </Button>
        {categories.map((c) => {
          const active = filters.categories.includes(c.slug);
          return (
            <Button
              key={c.id}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => toggleCategory(c.slug)}
            >
              {c.name}
              {active && (
                <X className="ml-1.5 h-3 w-3" />
              )}
            </Button>
          );
        })}
      </div>

      {/* Advanced filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Location */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.location ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <MapPin className="h-3.5 w-3.5" />
              {filters.location || "Location"}
              {filters.location && <X className="ml-1 h-3 w-3" onClick={(e) => { e.stopPropagation(); onChange({ location: "" }); }} />}
              {!filters.location && <ChevronDown className="h-3 w-3" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <Label className="text-xs text-muted-foreground">City or postcode</Label>
            <Input
              autoFocus
              value={filters.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="e.g. London, M1, Bristol"
              className="mt-1.5 h-9"
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </PopoverContent>
        </Popover>

        {/* Price range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.priceMin > 0 || filters.priceMax < PRICE_MAX ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <span className="text-xs font-medium">
                {filters.priceMin === 0 && filters.priceMax >= PRICE_MAX
                  ? "Any price"
                  : `${formatGBP(filters.priceMin)} – ${formatGBP(filters.priceMax)}`}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <Label className="text-xs text-muted-foreground">Price range</Label>
            <div className="mt-4 px-1">
              <Slider
                min={0}
                max={PRICE_MAX}
                step={500}
                value={[filters.priceMin, filters.priceMax]}
                onValueChange={([min, max]) => onChange({ priceMin: min, priceMax: max })}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatGBP(filters.priceMin)}</span>
              <span>{formatGBP(filters.priceMax)}</span>
            </div>
          </PopoverContent>
        </Popover>

        {/* Minimum rating */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.minRating > 0 ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Star className="h-3.5 w-3.5" />
              {filters.minRating > 0 ? `${filters.minRating}+ stars` : "Any rating"}
              {filters.minRating > 0 && <X className="ml-1 h-3 w-3" onClick={(e) => { e.stopPropagation(); onChange({ minRating: 0 }); }} />}
              {filters.minRating === 0 && <ChevronDown className="h-3 w-3" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {STAR_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => onChange({ minRating: n })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    filters.minRating === n
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {n === 0 ? (
                    "Any rating"
                  ) : (
                    <>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3.5 w-3.5",
                            i < n
                              ? "fill-accent text-accent"
                              : "text-muted-foreground"
                          )}
                        />
                      ))}
                      <span className="ml-1">& up</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Availability date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.availabilityDate ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.availabilityDate
                ? new Date(filters.availabilityDate + "T00:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : "Available on"}
              {filters.availabilityDate && (
                <X
                  className="ml-1 h-3 w-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ availabilityDate: "" });
                  }}
                />
              )}
              {!filters.availabilityDate && <ChevronDown className="h-3 w-3" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={
                filters.availabilityDate
                  ? new Date(filters.availabilityDate + "T00:00:00")
                  : undefined
              }
              onSelect={(d) =>
                onChange({
                  availabilityDate: d
                    ? d.toISOString().slice(0, 10)
                    : "",
                })
              }
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Clear all */}
        {anyFilterActive && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Clear all
          </Button>
        )}
      </div>
    </div>
  );
};

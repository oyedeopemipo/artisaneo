import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader as Loader2 } from "lucide-react";

type Booking = {
  id: string;
  buyer_id: string;
  seller_id: string;
  service_id: string | null;
  status: string;
  price_pence: number;
  payment_status: string;
  booking_date: string | null;
  booking_time: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

type ProfileMap = Record<string, { display_name: string | null }>;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export const BookingsOverview = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    setBookings((data as Booking[]) ?? []);

    // Load profile names for buyer/seller IDs
    const ids = new Set<string>();
    for (const b of data ?? []) {
      ids.add(b.buyer_id);
      ids.add(b.seller_id);
    }
    if (ids.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(ids));
      const map: ProfileMap = {};
      for (const p of profiles ?? []) {
        map[p.id] = { display_name: p.display_name };
      }
      setProfileMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = bookings.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const ref = (b.reference_number ?? "").toLowerCase();
      const buyer = (profileMap[b.buyer_id]?.display_name ?? "").toLowerCase();
      const seller = (profileMap[b.seller_id]?.display_name ?? "").toLowerCase();
      if (!ref.includes(q) && !buyer.includes(q) && !seller.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Bookings Overview</h1>
      <p className="mt-1 text-muted-foreground">All bookings across the platform.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, buyer, or seller..."
            className="h-10 pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "booking" : "bookings"}
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No bookings found.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.reference_number ?? b.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {profileMap[b.buyer_id]?.display_name || b.buyer_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {profileMap[b.seller_id]?.display_name || b.seller_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {b.booking_date
                      ? new Date(b.booking_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "—"}
                    {b.booking_time ? ` ${b.booking_time}` : ""}
                  </TableCell>
                  <TableCell>{formatGBP(b.price_pence)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={b.payment_status === "paid" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {b.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

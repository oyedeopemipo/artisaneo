import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type SellerInfo = {
  user_id: string;
  full_name: string;
  shop_name: string;
  service_category: string;
  availability_days: string[];
  availability_start: string | null;
  availability_end: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seller: SellerInfo;
  defaultPricePence?: number;
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const bookingSchema = z.object({
  serviceType: z.string().trim().min(1, "Select a service type").max(100),
  date: z.date({ required_error: "Pick a date" }),
  time: z.string().min(1, "Pick a time"),
  notes: z.string().trim().max(1000).optional(),
  pricePence: z.number().int().min(0).max(10_000_000),
});

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const generateRef = () =>
  `ART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const buildTimeSlots = (start: string | null, end: string | null) => {
  const s = start ?? "09:00";
  const e = end ?? "17:00";
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const slots: string[] = [];
  for (let m = startMin; m + 30 <= endMin; m += 30) {
    const hh = Math.floor(m / 60).toString().padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
};

export const BookingPanel = ({ open, onOpenChange, seller, defaultPricePence = 5000 }: Props) => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState(seller.service_category || "");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pricePence, setPricePence] = useState(defaultPricePence);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setDate(undefined);
      setTime("");
      setNotes("");
      setPricePence(defaultPricePence);
      setServiceType(seller.service_category || "");
    }
  }, [open, defaultPricePence, seller.service_category]);

  const allowedDayIndexes = useMemo(
    () => new Set((seller.availability_days || []).map((d) => DAY_INDEX[d]).filter((n) => n !== undefined)),
    [seller.availability_days],
  );

  const timeSlots = useMemo(
    () => buildTimeSlots(seller.availability_start, seller.availability_end),
    [seller.availability_start, seller.availability_end],
  );

  const isDayDisabled = (d: Date) => {
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    if (allowedDayIndexes.size === 0) return false;
    return !allowedDayIndexes.has(d.getDay());
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Please sign in to book");
      navigate(`/auth?redirect=/seller/${seller.user_id}`);
      return;
    }
    if (userId === seller.user_id) {
      toast.error("You cannot book your own services");
      return;
    }

    const parsed = bookingSchema.safeParse({ serviceType, date, time, notes, pricePence });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      toast.error(first || "Please complete all fields");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-booking-checkout", {
      body: {
        seller_id: seller.user_id,
        service_type: parsed.data.serviceType,
        booking_date: format(parsed.data.date, "yyyy-MM-dd"),
        booking_time: parsed.data.time,
        notes: parsed.data.notes || null,
        price_pence: parsed.data.pricePence,
      },
    });
    setSubmitting(false);

    if (error || !data?.url) {
      const msg = (data as { error?: string } | null)?.error || error?.message || "Could not start checkout";
      toast.error(typeof msg === "string" ? msg : "Could not start checkout");
      return;
    }

    window.location.href = data.url as string;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {(
          <></>
        )}
        {(
          <></>
        ) || (
          <>
            <SheetHeader>
              <SheetTitle>Book {seller.shop_name || seller.full_name}</SheetTitle>
              <SheetDescription>
                {allowedDayIndexes.size > 0
                  ? `Available ${seller.availability_days.join(", ")}`
                  : "Pick a date, time and add details for your booking."}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label>Service type</Label>
                <Input
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g. Bridal makeup"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={isDayDisabled}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the artisan should know"
                  maxLength={1000}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Price (£)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={(pricePence / 100).toString()}
                  onChange={(e) => setPricePence(Math.max(0, Math.round(Number(e.target.value) * 100)))}
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-semibold">{formatGBP(pricePence)}</span>
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={submitting || !authChecked} className="w-full" size="lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm booking
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

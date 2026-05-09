import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BookingConfirmation = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{ reference_number: string | null; payment_status: string; service_type: string | null; booking_date: string | null; booking_time: string | null } | null>(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("reference_number,payment_status,service_type,booking_date,booking_time")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data.payment_status === "paid" || attempts >= 6)) {
        setBooking(data);
        setLoading(false);
        return;
      }
      attempts += 1;
      setTimeout(poll, 1500);
    };
    void poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card-soft">
          {loading ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Confirming your payment…</h1>
              <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds.</p>
            </>
          ) : booking?.payment_status === "paid" ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Booking confirmed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We've notified the artisan. You'll get an update shortly.
              </p>
              <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
                <p className="mt-1 font-mono text-lg font-semibold">{booking.reference_number}</p>
                {booking.service_type && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {booking.service_type} · {booking.booking_date} at {booking.booking_time}
                  </p>
                )}
              </div>
              <Button asChild className="mt-6 w-full"><Link to="/browse">Explore more artisans</Link></Button>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-14 w-14 text-muted-foreground" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Payment pending</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We haven't received confirmation yet. You'll receive an email once payment clears.
              </p>
              <Button asChild className="mt-6 w-full"><Link to="/browse">Back to browse</Link></Button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingConfirmation;

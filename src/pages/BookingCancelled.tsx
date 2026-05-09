import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

const BookingCancelled = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = params.get("booking_id");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card-soft">
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Payment not completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your booking wasn't confirmed because the payment was cancelled or failed. No charge was made.
          </p>
          {bookingId && (
            <p className="mt-3 text-xs text-muted-foreground">Reference saved as pending — you can retry safely.</p>
          )}
          <div className="mt-6 grid gap-3">
            <Button onClick={() => navigate(-1)}>Try again</Button>
            <Button variant="outline" asChild><Link to="/browse">Back to browse</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingCancelled;

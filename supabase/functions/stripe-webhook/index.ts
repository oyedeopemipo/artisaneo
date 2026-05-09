import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.1?target=deno";

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-11-20.acacia" });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook secret not configured", { status: 500 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    console.error("Signature verification failed", e);
    return new Response("Bad signature", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.booking_id;
        if (bookingId) {
          await admin.from("bookings").update({
            payment_status: s.payment_status === "paid" ? "paid" : "pending",
            status: s.payment_status === "paid" ? "confirmed" : "pending",
            stripe_payment_intent_id: typeof s.payment_intent === "string" ? s.payment_intent : null,
          }).eq("id", bookingId);
        }
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.booking_id;
        if (bookingId) {
          await admin.from("bookings").update({ payment_status: "failed", status: "cancelled" }).eq("id", bookingId);
        }
        break;
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi = typeof c.payment_intent === "string" ? c.payment_intent : null;
        if (pi) {
          await admin.from("bookings").update({ payment_status: "refunded", status: "cancelled" })
            .eq("stripe_payment_intent_id", pi);
        }
        break;
      }
      case "account.updated": {
        const a = event.data.object as Stripe.Account;
        const complete = !!(a.details_submitted && a.charges_enabled && a.payouts_enabled);
        await admin.from("seller_profiles").update({ stripe_onboarding_complete: complete })
          .eq("stripe_account_id", a.id);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("webhook handler error", e);
    return new Response("Handler error", { status: 500 });
  }
});

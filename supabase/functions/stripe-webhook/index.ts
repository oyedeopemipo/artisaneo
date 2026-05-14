import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.1?target=deno";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function sendEmail(payload: Record<string, unknown>) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.error("send-email failed", r.status, await r.text());
  } catch (e) { console.error("send-email error", e); }
}

async function sendBookingConfirmed(admin: ReturnType<typeof createClient>, bookingId: string) {
  const { data: b } = await admin.from("bookings")
    .select("id,buyer_id,seller_id,service_type,booking_date,booking_time,reference_number,price_pence,application_fee_pence")
    .eq("id", bookingId).maybeSingle();
  if (!b) return;
  const [{ data: buyerProfile }, { data: sellerProfile }, { data: buyerAuth }, { data: sellerAuth }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", b.buyer_id).maybeSingle(),
    admin.from("seller_profiles").select("shop_name,full_name").eq("user_id", b.seller_id).maybeSingle(),
    admin.auth.admin.getUserById(b.buyer_id),
    admin.auth.admin.getUserById(b.seller_id),
  ]);
  const buyerName = (buyerProfile as any)?.display_name || buyerAuth?.user?.email?.split("@")[0] || "there";
  const sellerName = (sellerProfile as any)?.shop_name || (sellerProfile as any)?.full_name || "your artisan";
  const common = {
    serviceType: b.service_type, date: b.booking_date, time: b.booking_time,
    reference: b.reference_number, pricePence: b.price_pence, feePence: b.application_fee_pence,
    buyerName, sellerName,
  };
  if (buyerAuth?.user?.email) {
    await sendEmail({
      to: buyerAuth.user.email, template: "booking_confirmed_buyer", data: common,
      recipient_user_id: b.buyer_id, dedupe: { kind: "booking_confirmed_buyer", ref_id: b.id },
    });
  }
  if (sellerAuth?.user?.email) {
    await sendEmail({
      to: sellerAuth.user.email, template: "booking_confirmed_seller", data: common,
      recipient_user_id: b.seller_id, dedupe: { kind: "booking_confirmed_seller", ref_id: b.id },
    });
    // Funds are transferred to the connected account at capture (destination charge),
    // so notify the seller that their payout is on its way.
    await sendEmail({
      to: sellerAuth.user.email, template: "payout_processed",
      data: {
        sellerName,
        amountPence: (b.price_pence || 0) - (b.application_fee_pence || 0),
        reference: b.reference_number, serviceType: b.service_type,
      },
      recipient_user_id: b.seller_id, dedupe: { kind: "payout_processed", ref_id: b.id },
    });
  }
}

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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.booking_id;
        if (bookingId) {
          const paid = s.payment_status === "paid";
          await admin.from("bookings").update({
            payment_status: paid ? "paid" : "pending",
            status: paid ? "confirmed" : "pending",
            stripe_payment_intent_id: typeof s.payment_intent === "string" ? s.payment_intent : null,
          }).eq("id", bookingId);
          if (paid) await sendBookingConfirmed(admin, bookingId);
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

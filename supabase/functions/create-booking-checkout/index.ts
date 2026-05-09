import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.1?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  seller_id: z.string().uuid(),
  service_type: z.string().trim().min(1).max(100),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  booking_time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().trim().max(1000).optional().nullable(),
  price_pence: z.number().int().min(100).max(10_000_000),
});

const generateRef = () =>
  `ART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: corsHeaders });
    }
    const data = parsed.data;

    if (userId === data.seller_id) {
      return new Response(JSON.stringify({ error: "You cannot book your own services" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: seller } = await admin
      .from("seller_profiles")
      .select("user_id, shop_name, full_name, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", data.seller_id)
      .maybeSingle();

    if (!seller?.stripe_account_id || !seller.stripe_onboarding_complete) {
      return new Response(
        JSON.stringify({ error: "This seller hasn't finished setting up payouts yet. Please try again later." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-11-20.acacia" });
    const reference = generateRef();
    const applicationFee = Math.round(data.price_pence * 0.10);

    // Create booking row first (pending)
    const { data: booking, error: bookErr } = await admin.from("bookings").insert({
      buyer_id: userId,
      seller_id: data.seller_id,
      service_type: data.service_type,
      booking_date: data.booking_date,
      booking_time: data.booking_time,
      notes: data.notes || null,
      price_pence: data.price_pence,
      status: "pending",
      payment_status: "pending",
      reference_number: reference,
      application_fee_pence: applicationFee,
    }).select("id").single();

    if (bookErr || !booking) {
      console.error("booking insert error", bookErr);
      return new Response(JSON.stringify({ error: "Could not create booking" }), { status: 500, headers: corsHeaders });
    }

    const origin = req.headers.get("origin") || "https://artisaneo.lovable.app";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: {
            name: `${data.service_type} — ${seller.shop_name || seller.full_name}`,
            description: `Booking ${reference} on ${data.booking_date} at ${data.booking_time}`,
          },
          unit_amount: data.price_pence,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: seller.stripe_account_id },
        metadata: { booking_id: booking.id, reference_number: reference },
      },
      metadata: { booking_id: booking.id, reference_number: reference },
      success_url: `${origin}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking/cancelled?booking_id=${booking.id}`,
    });

    await admin.from("bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);

    return new Response(JSON.stringify({ url: session.url, booking_id: booking.id, reference_number: reference }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-booking-checkout error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

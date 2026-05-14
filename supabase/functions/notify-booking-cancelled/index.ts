// Called by client (buyer or seller) after a booking has been cancelled.
// Sends cancellation emails to BOTH parties using service-role lookups.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userId = claims.claims.sub as string;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: corsHeaders });
  }
  const { booking_id, reason } = parsed.data;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: booking } = await admin
    .from("bookings")
    .select("id,buyer_id,seller_id,service_type,booking_date,booking_time,reference_number,status")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
  if (userId !== booking.buyer_id && userId !== booking.seller_id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }
  if (booking.status !== "cancelled") {
    return new Response(JSON.stringify({ error: "Booking is not cancelled" }), { status: 400, headers: corsHeaders });
  }

  const [{ data: buyerProfile }, { data: sellerProfile }, { data: buyerAuth }, { data: sellerAuth }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", booking.buyer_id).maybeSingle(),
    admin.from("seller_profiles").select("shop_name,full_name").eq("user_id", booking.seller_id).maybeSingle(),
    admin.auth.admin.getUserById(booking.buyer_id),
    admin.auth.admin.getUserById(booking.seller_id),
  ]);

  const buyerName = buyerProfile?.display_name || buyerAuth?.user?.email?.split("@")[0] || "Buyer";
  const sellerName = sellerProfile?.shop_name || sellerProfile?.full_name || "Artisan";

  const common = {
    serviceType: booking.service_type,
    date: booking.booking_date,
    time: booking.booking_time,
    reference: booking.reference_number,
    reason: reason || null,
    buyerName,
    sellerName,
  };

  const send = (to: string, template: string, recipient_user_id: string) =>
    admin.functions.invoke("send-email", {
      body: {
        to, template, data: common, recipient_user_id,
        dedupe: { kind: template, ref_id: booking.id },
      },
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
    });

  const results = await Promise.allSettled([
    buyerAuth?.user?.email ? send(buyerAuth.user.email, "booking_cancelled_buyer", booking.buyer_id) : Promise.resolve(null),
    sellerAuth?.user?.email ? send(sellerAuth.user.email, "booking_cancelled_seller", booking.seller_id) : Promise.resolve(null),
  ]);
  results.forEach((r, i) => r.status === "rejected" && console.error("cancel email", i, r.reason));

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

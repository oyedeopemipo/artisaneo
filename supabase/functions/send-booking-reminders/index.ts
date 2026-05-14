// Cron: runs hourly. Sends 24h-before reminders for confirmed bookings to both buyer and seller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Window: bookings happening between 23h and 25h from now
  const now = new Date();
  const startISO = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
  const endISO = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();

  // Pull confirmed paid bookings, filter in JS by combined date+time
  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id,buyer_id,seller_id,service_type,booking_date,booking_time,reference_number,status,payment_status")
    .eq("status", "confirmed")
    .eq("payment_status", "paid")
    .gte("booking_date", now.toISOString().slice(0, 10))
    .lte("booking_date", new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10));

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let sent = 0;
  for (const b of bookings || []) {
    if (!b.booking_date || !b.booking_time) continue;
    const dt = new Date(`${b.booking_date}T${b.booking_time}Z`);
    const iso = dt.toISOString();
    if (iso < startISO || iso > endISO) continue;

    const [{ data: buyerProfile }, { data: sellerProfile }, { data: buyerAuth }, { data: sellerAuth }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", b.buyer_id).maybeSingle(),
      admin.from("seller_profiles").select("shop_name,full_name").eq("user_id", b.seller_id).maybeSingle(),
      admin.auth.admin.getUserById(b.buyer_id),
      admin.auth.admin.getUserById(b.seller_id),
    ]);

    const buyerName = buyerProfile?.display_name || "there";
    const sellerName = sellerProfile?.shop_name || sellerProfile?.full_name || "your artisan";

    const baseData = {
      serviceType: b.service_type,
      date: b.booking_date,
      time: b.booking_time,
      reference: b.reference_number,
    };

    const send = async (to: string, recipientName: string, counterpartyName: string, dashboardPath: string, kindSuffix: string, recipient_user_id: string) => {
      try {
        await admin.functions.invoke("send-email", {
          body: {
            to,
            template: "booking_reminder",
            data: { ...baseData, recipientName, counterpartyName, dashboardPath },
            recipient_user_id,
            dedupe: { kind: `booking_reminder_${kindSuffix}`, ref_id: b.id },
          },
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
        sent++;
      } catch (e) { console.error("reminder send", e); }
    };

    if (buyerAuth?.user?.email) await send(buyerAuth.user.email, buyerName, sellerName, "/dashboard/buyer", "buyer", b.buyer_id);
    if (sellerAuth?.user?.email) await send(sellerAuth.user.email, sellerName, buyerName, "/dashboard/seller", "seller", b.seller_id);
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

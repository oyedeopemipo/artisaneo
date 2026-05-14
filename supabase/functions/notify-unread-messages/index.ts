// Cron: every few minutes. For each unread message older than 10 minutes whose recipient
// hasn't been seen for >= 10 minutes, send a "new message" email (deduped per message).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: msgs, error } = await admin
    .from("messages")
    .select("id,conversation_id,sender_id,body,created_at,read,conversations!inner(buyer_id,seller_id)")
    .eq("read", false)
    .lte("created_at", cutoff)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(100);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let sent = 0;
  for (const m of msgs || []) {
    const convo = (m as any).conversations as { buyer_id: string; seller_id: string };
    const recipientId = m.sender_id === convo.buyer_id ? convo.seller_id : convo.buyer_id;

    const { data: recipientProfile } = await admin
      .from("profiles").select("display_name,last_seen_at").eq("id", recipientId).maybeSingle();
    if (recipientProfile?.last_seen_at && (Date.now() - new Date(recipientProfile.last_seen_at).getTime()) < 10 * 60 * 1000) {
      continue; // recipient was active recently
    }

    const { data: senderProfile } = await admin
      .from("profiles").select("display_name").eq("id", m.sender_id).maybeSingle();
    const { data: recipientAuth } = await admin.auth.admin.getUserById(recipientId);
    if (!recipientAuth?.user?.email) continue;

    try {
      await admin.functions.invoke("send-email", {
        body: {
          to: recipientAuth.user.email,
          template: "new_message",
          data: {
            senderName: senderProfile?.display_name || "Someone",
            recipientName: recipientProfile?.display_name || "there",
            preview: m.body,
          },
          recipient_user_id: recipientId,
          dedupe: { kind: "new_message", ref_id: m.id },
        },
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      sent++;
    } catch (e) { console.error("unread email", e); }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

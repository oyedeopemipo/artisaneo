// Generic transactional email sender via Resend (through Lovable connector gateway).
// Called by other edge functions. NOT exposed to clients (verify_jwt = true by default,
// and we additionally require a service-role bearer token).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { renderTemplate, type TemplateName } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Artisaneo <onboarding@resend.dev>";

const TEMPLATE_NAMES: TemplateName[] = [
  "booking_confirmed_buyer",
  "booking_confirmed_seller",
  "booking_reminder",
  "booking_cancelled_buyer",
  "booking_cancelled_seller",
  "new_message",
  "payout_processed",
];

const BodySchema = z.object({
  to: z.string().email(),
  template: z.enum(TEMPLATE_NAMES as [TemplateName, ...TemplateName[]]),
  data: z.record(z.any()).default({}),
  // Idempotency: pair (kind, ref_id) is unique in email_notifications_sent
  dedupe: z.object({ kind: z.string().min(1).max(80), ref_id: z.string().min(1).max(120) }).optional(),
  recipient_user_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal-only: must be called with the service role key
  const auth = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: corsHeaders });
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500, headers: corsHeaders });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: corsHeaders });
  }
  const { to, template, data, dedupe, recipient_user_id } = parsed.data;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  if (dedupe) {
    const { error: insErr } = await admin.from("email_notifications_sent").insert({
      kind: dedupe.kind,
      ref_id: dedupe.ref_id,
      recipient_user_id: recipient_user_id ?? null,
    });
    if (insErr) {
      // Unique violation = already sent. Silently succeed.
      if ((insErr as any).code === "23505") {
        return new Response(JSON.stringify({ skipped: "duplicate" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("dedupe insert error", insErr);
    }
  }

  const { subject, html } = renderTemplate(template, data);

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend error", res.status, body);
    return new Response(JSON.stringify({ error: "Resend failed", details: body }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: (body as any)?.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

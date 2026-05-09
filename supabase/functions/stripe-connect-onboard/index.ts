import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.1?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const email = claims.claims.email as string | undefined;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-11-20.acacia" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile, error: profileErr } = await admin
      .from("seller_profiles")
      .select("user_id, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Complete your seller profile first" }), { status: 400, headers: corsHeaders });
    }

    let accountId = profile.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email,
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      });
      accountId = account.id;
      await admin.from("seller_profiles").update({ stripe_account_id: accountId }).eq("user_id", userId);
    }

    const origin = req.headers.get("origin") || "https://artisaneo.lovable.app";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/seller/profile?stripe=refresh`,
      return_url: `${origin}/seller/profile?stripe=return`,
      type: "account_onboarding",
    });

    // Refresh status
    const account = await stripe.accounts.retrieve(accountId);
    const complete = !!(account.details_submitted && account.charges_enabled && account.payouts_enabled);
    await admin.from("seller_profiles").update({ stripe_onboarding_complete: complete }).eq("user_id", userId);

    return new Response(JSON.stringify({ url: link.url, account_id: accountId, onboarding_complete: complete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-connect-onboard error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

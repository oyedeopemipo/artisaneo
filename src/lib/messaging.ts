import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a conversation between the current user (buyer) and a seller.
 * Returns the conversation id, or null on error.
 */
export async function getOrCreateConversation(opts: {
  buyerId: string;
  sellerId: string;
  bookingId?: string | null;
}): Promise<string | null> {
  const { buyerId, sellerId, bookingId = null } = opts;

  // Try to find existing
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId);
  query = bookingId ? query.eq("booking_id", bookingId) : query.is("booking_id", null);

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ buyer_id: buyerId, seller_id: sellerId, booking_id: bookingId })
    .select("id")
    .single();

  if (error) {
    // Race: another insert may have happened. Retry select.
    const { data: retry } = await query.maybeSingle();
    return retry?.id ?? null;
  }
  return created.id;
}

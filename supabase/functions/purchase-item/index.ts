import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { traderId, itemToBuy } = await req.json();

  const { data: character, error: charError } = await supabaseClient
    .from("characters")
    .select("inventory, dollars")
    .eq("id", user.id)
    .single();

  if (charError || !character) {
    return new Response(JSON.stringify({ error: "Character not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  if ((character.dollars || 0) < itemToBuy.price) {
    return new Response(JSON.stringify({ error: "Insufficient funds" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  
  // Create a new Supabase client with the service role key to bypass RLS.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: fullItemData, error: itemError } = await supabaseAdmin
    .from("items")
    .select("*")
    .or(`id.eq.${itemToBuy.item_id},item_id.eq.${itemToBuy.item_id}`)
    .single();

  if (itemError || !fullItemData) {
    return new Response(JSON.stringify({ error: "Item details not found in database." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const newInventory = [...(character.inventory || []), { ...fullItemData, id: Date.now() + Math.random(), equipped: false }];
  const newDollars = (character.dollars || 0) - itemToBuy.price;

  const { error: updateError } = await supabaseAdmin
    .from("characters")
    .update({ inventory: newInventory, dollars: newDollars })
    .eq("id", user.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: "Failed to update character: " + updateError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const { data: traderData, error: traderError } = await supabaseAdmin
    .from("traders")
    .select("items")
    .eq("id", traderId)
    .single();
    
  if (traderError || !traderData) {
    // Character update should be rolled back here in a real transaction, but for now we'll just error.
    return new Response(JSON.stringify({ error: "Failed to find trader." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let newTraderItems = [...traderData.items];
  const tItemIdx = newTraderItems.findIndex(i => i.item_id === itemToBuy.item_id);

  if (tItemIdx >= 0) {
    newTraderItems[tItemIdx].qty -= 1;
    if (newTraderItems[tItemIdx].qty <= 0) {
      newTraderItems.splice(tItemIdx, 1);
    }
    const { error: traderUpdateError } = await supabaseAdmin
      .from("traders")
      .update({ items: newTraderItems })
      .eq("id", traderId);

    if (traderUpdateError) {
       return new Response(JSON.stringify({ error: "Failed to update trader stock." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ success: true, itemName: fullItemData.name }), { headers: { "Content-Type": "application/json" } });
});

-- migration to add dollars to traders
ALTER TABLE traders ADD COLUMN IF NOT EXISTS dollars INTEGER DEFAULT 0;

-- Update approve_trade_request to deduct from trader's budget
CREATE OR REPLACE FUNCTION public.approve_trade_request(
    p_request_id UUID,
    p_master_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_character RECORD;
    v_trader RECORD;
    v_inventory JSONB;
    v_new_inventory JSONB;
    v_item_found BOOLEAN := FALSE;
    v_item_instance_id TEXT;
    v_item_id TEXT;
    v_idx INTEGER;
BEGIN
    -- 1. Get the request
    SELECT * INTO v_request FROM public.trade_requests WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado ou já processado.');
    END IF;

    -- 2. Get the trader and check budget
    SELECT * INTO v_trader FROM public.traders WHERE id = v_request.trader_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Comerciante não encontrado.');
    END IF;

    IF COALESCE(v_trader.dollars, 0) < v_request.value THEN
        RETURN jsonb_build_object('success', false, 'error', 'O comerciante não tem dinheiro suficiente.');
    END IF;

    -- 3. Get the character
    SELECT * INTO v_character FROM public.characters WHERE id = v_request.player_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Personagem não encontrado.');
    END IF;

    v_inventory := v_character.inventory;
    v_item_instance_id := (v_request.item->>'id'); -- This is the unique instance ID
    v_item_id := (v_request.item->>'item_id');

    -- 4. Find and remove the item
    v_new_inventory := '[]'::jsonb;
    
    FOR i IN 0..jsonb_array_length(v_inventory) - 1 LOOP
        IF NOT v_item_found AND 
           (v_inventory->i->>'id' = v_item_instance_id OR 
            (v_item_instance_id IS NULL AND v_inventory->i->>'item_id' = v_item_id)) THEN
            v_item_found := TRUE;
            -- Skip this item (remove it)
        ELSE
            v_new_inventory := v_new_inventory || (v_inventory->i);
        END IF;
    END LOOP;

    IF NOT v_item_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado no inventário do jogador.');
    END IF;

    -- 5. Update character (Money + Inventory)
    UPDATE public.characters 
    SET 
        inventory = v_new_inventory,
        dollars = COALESCE(dollars, 0) + v_request.value
    WHERE id = v_request.player_id;

    -- 6. Update trader (Subtract Money)
    UPDATE public.traders
    SET dollars = dollars - v_request.value
    WHERE id = v_request.trader_id;

    -- 7. Update request status
    UPDATE public.trade_requests 
    SET status = 'approved' 
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Update process_item_purchase to add to trader's budget
CREATE OR REPLACE FUNCTION public.process_item_purchase(
    p_trader_id UUID,
    p_player_id UUID,
    p_item_id TEXT, -- This is the item_id from the trader items array
    p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_character RECORD;
    v_trader RECORD;
    v_trader_items JSONB;
    v_new_trader_items JSONB := '[]'::jsonb;
    v_item_data RECORD;
    v_item_found BOOLEAN := FALSE;
    v_new_inventory JSONB;
    v_item_weight INTEGER;
    v_item_to_add JSONB;
    i INTEGER;
BEGIN
    -- 1. Get character and check money
    SELECT * INTO v_character FROM public.characters WHERE id = p_player_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Personagem não encontrado.');
    END IF;

    IF COALESCE(v_character.dollars, 0) < p_price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dinheiro insuficiente.');
    END IF;

    -- 2. Get trader and check stock
    SELECT * INTO v_trader FROM public.traders WHERE id = p_trader_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Comerciante não encontrado.');
    END IF;

    v_trader_items := v_trader.items;
    
    FOR i IN 0..jsonb_array_length(v_trader_items) - 1 LOOP
        IF NOT v_item_found AND v_trader_items->i->>'item_id' = p_item_id THEN
            IF (v_trader_items->i->>'qty')::INTEGER > 0 THEN
                v_item_found := TRUE;
                -- Decrease quantity
                v_new_trader_items := v_new_trader_items || jsonb_build_object(
                    'item_id', v_trader_items->i->>'item_id',
                    'qty', (v_trader_items->i->>'qty')::INTEGER - 1,
                    'price', (v_trader_items->i->>'price')::INTEGER
                );
            ELSE
                RETURN jsonb_build_object('success', false, 'error', 'Item fora de estoque.');
            END IF;
        ELSE
            v_new_trader_items := v_new_trader_items || (v_trader_items->i);
        END IF;
    END LOOP;

    IF NOT v_item_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado no comerciante.');
    END IF;

    -- 3. Get item data to check weight and add to inventory
    SELECT * INTO v_item_data FROM public.items WHERE item_id = p_item_id OR id::TEXT = p_item_id LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dados do item não encontrados no banco.');
    END IF;

    v_item_weight := COALESCE((v_item_data.carga)::INTEGER, 1);
    
    -- 4. Process transaction
    v_item_to_add := row_to_json(v_item_data)::jsonb || jsonb_build_object('id', extract(epoch from now()) + random(), 'equipped', false);
    v_new_inventory := COALESCE(v_character.inventory, '[]'::jsonb) || v_item_to_add;

    UPDATE public.characters 
    SET 
        inventory = v_new_inventory,
        dollars = dollars - p_price
    WHERE id = p_player_id;

    UPDATE public.traders 
    SET 
        items = v_new_trader_items,
        dollars = COALESCE(dollars, 0) + p_price
    WHERE id = p_trader_id;

    RETURN jsonb_build_object('success', true, 'itemName', v_item_data.name);
END;
$$;

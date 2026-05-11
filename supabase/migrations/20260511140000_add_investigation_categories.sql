-- Create investigation_categories table
CREATE TABLE IF NOT EXISTS public.investigation_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    max_cards INTEGER DEFAULT 20,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add category_id to investigation_cards
ALTER TABLE public.investigation_cards ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.investigation_categories(id) ON DELETE CASCADE;

-- Create a default category
INSERT INTO public.investigation_categories (name, max_cards, display_order)
VALUES ('Default', (SELECT COALESCE(investigation_max_cards, 20) FROM public.global WHERE id = 1), 0)
ON CONFLICT DO NOTHING;

-- Map existing cards to the default category
DO $$
DECLARE
    default_cat_id UUID;
BEGIN
    SELECT id INTO default_cat_id FROM public.investigation_categories WHERE name = 'Default' LIMIT 1;
    UPDATE public.investigation_cards SET category_id = default_cat_id WHERE category_id IS NULL;
END $$;

-- Enable RLS for investigation_categories
ALTER TABLE public.investigation_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for investigation_categories
CREATE POLICY "Users can view all categories" 
    ON public.investigation_categories FOR SELECT 
    USING (true);

CREATE POLICY "Only master can insert categories" 
    ON public.investigation_categories FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Only master can update categories" 
    ON public.investigation_categories FOR UPDATE 
    USING (true);

CREATE POLICY "Only master can delete categories" 
    ON public.investigation_categories FOR DELETE 
    USING (true);

-- Update trigger for investigation_categories
CREATE TRIGGER update_investigation_categories_updated_at
    BEFORE UPDATE ON public.investigation_categories
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

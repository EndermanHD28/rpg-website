-- Add payment_amount column to reports table
ALTER TABLE public.reports ADD COLUMN payment_amount INTEGER DEFAULT 0;

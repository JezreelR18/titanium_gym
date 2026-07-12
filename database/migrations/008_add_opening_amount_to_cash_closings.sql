-- Migration 008: add opening_amount (fondo inicial) to cash_closings
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

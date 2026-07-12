-- Migration 004: add unit and location columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit     VARCHAR(30) NOT NULL DEFAULT 'unidad',
  ADD COLUMN IF NOT EXISTS location VARCHAR(100);

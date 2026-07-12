-- Migration 007: create cash_closings and cash_closing_denominations tables

CREATE TYPE cash_closing_status AS ENUM ('draft', 'closed');

CREATE TABLE cash_closings (
    id                   UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    closing_date         DATE                 NOT NULL,
    status               cash_closing_status  NOT NULL DEFAULT 'draft',
    total_sales_count    INT                  NOT NULL DEFAULT 0,
    total_sales_amount   DECIMAL(12,2)        NOT NULL DEFAULT 0,
    payment_breakdown    TEXT                 NOT NULL DEFAULT '[]',
    cash_sales_amount    DECIMAL(12,2)        NOT NULL DEFAULT 0,
    cash_counted_amount  DECIMAL(12,2)        NOT NULL DEFAULT 0,
    difference           DECIMAL(12,2)        NOT NULL DEFAULT 0,
    notes                TEXT,
    created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    closed_at            TIMESTAMPTZ,
    created_by           UUID                 REFERENCES users(id),
    closed_by            UUID                 REFERENCES users(id)
);

CREATE INDEX idx_cash_closings_date ON cash_closings(closing_date);

CREATE TABLE cash_closing_denominations (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    closing_id    UUID          NOT NULL REFERENCES cash_closings(id) ON DELETE CASCADE,
    type          VARCHAR(10)   NOT NULL,
    denomination  DECIMAL(8,2)  NOT NULL,
    quantity      INT           NOT NULL DEFAULT 0,
    subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_cash_closing_denominations_closing ON cash_closing_denominations(closing_id);

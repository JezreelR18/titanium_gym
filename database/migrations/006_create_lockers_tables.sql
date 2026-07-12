-- Migration 006: create lockers and locker_rentals tables with their enum types

CREATE TYPE locker_status AS ENUM ('available', 'rented', 'maintenance', 'reserved');
CREATE TYPE locker_rental_status AS ENUM ('active', 'expired', 'cancelled');

CREATE TABLE lockers (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    number      VARCHAR(20)  NOT NULL UNIQUE,
    zone        VARCHAR(50),
    status      locker_status NOT NULL DEFAULT 'available',
    has_lock    BOOLEAN      NOT NULL DEFAULT false,
    note        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID         REFERENCES users(id)
);

CREATE TABLE locker_rentals (
    id               UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    locker_id        UUID                 NOT NULL REFERENCES lockers(id),
    member_id        UUID                 NOT NULL REFERENCES members(id),
    start_date       DATE                 NOT NULL,
    end_date         DATE                 NOT NULL,
    price            DECIMAL(10,2)        NOT NULL,
    currency         VARCHAR(3)           NOT NULL DEFAULT 'MXN',
    includes_lock    BOOLEAN              NOT NULL DEFAULT false,
    deposit_amount   DECIMAL(10,2)        NOT NULL DEFAULT 0,
    deposit_returned BOOLEAN              NOT NULL DEFAULT false,
    status           locker_rental_status NOT NULL DEFAULT 'active',
    note             TEXT,
    created_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    created_by       UUID                 REFERENCES users(id),
    updated_by       UUID                 REFERENCES users(id)
);

CREATE INDEX idx_lockers_status          ON lockers(status);
CREATE INDEX idx_locker_rentals_locker   ON locker_rentals(locker_id);
CREATE INDEX idx_locker_rentals_member   ON locker_rentals(member_id);
CREATE INDEX idx_locker_rentals_status   ON locker_rentals(status);
CREATE INDEX idx_locker_rentals_end_date ON locker_rentals(end_date);

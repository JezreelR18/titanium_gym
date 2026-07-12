-- ==============================================================
-- TITANIUM GYM - DATABASE SCHEMA
-- Database: titanium_gym
-- Version : 1.0.0
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================
-- ENUMERATIONS
-- ==============================================================

CREATE TYPE user_status          AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE member_status        AS ENUM ('active', 'inactive', 'suspended', 'frozen');
CREATE TYPE gender_type          AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE difficulty_level     AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE membership_status    AS ENUM ('active', 'expired', 'cancelled', 'frozen', 'pending');
CREATE TYPE sale_status          AS ENUM ('draft', 'confirmed', 'cancelled', 'refunded');
CREATE TYPE payment_status       AS ENUM ('pending', 'partial', 'paid', 'refunded');
CREATE TYPE debt_status          AS ENUM ('pending', 'partial', 'paid', 'written_off', 'disputed');
CREATE TYPE class_status         AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE enrollment_status    AS ENUM ('enrolled', 'attended', 'absent', 'cancelled');
CREATE TYPE attendance_method    AS ENUM ('manual', 'qr_code', 'card');
CREATE TYPE routine_status       AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE reminder_type        AS ENUM ('membership_expiry', 'payment_due', 'birthday', 'class_reminder', 'custom');
CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp', 'sms', 'in_app');
CREATE TYPE notification_status  AS ENUM ('pending', 'sent', 'failed', 'cancelled');
CREATE TYPE promotion_type       AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE promotion_scope      AS ENUM ('all', 'memberships', 'products', 'classes');
CREATE TYPE movement_type        AS ENUM ('purchase', 'sale', 'adjustment', 'return');
CREATE TYPE audit_action         AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ==============================================================
-- DOMAIN: AUTH & USERS
-- ==============================================================

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    module      VARCHAR(50)  NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id           UUID        NOT NULL REFERENCES roles(id),
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    phone             VARCHAR(20),
    avatar_url        TEXT,
    status            user_status  NOT NULL DEFAULT 'active',
    last_login_at     TIMESTAMPTZ,
    is_active         BOOLEAN      NOT NULL DEFAULT true,
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID         REFERENCES users(id),
    updated_by        UUID         REFERENCES users(id),
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID         REFERENCES users(id)
);

CREATE TABLE role_permissions (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id       UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID        NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID        REFERENCES users(id),
    UNIQUE(role_id, permission_id)
);

-- ==============================================================
-- DOMAIN: MEMBERS
-- ==============================================================

CREATE TABLE members (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name        VARCHAR(100)  NOT NULL,
    last_name         VARCHAR(100)  NOT NULL,
    email             VARCHAR(255)  UNIQUE,
    phone             VARCHAR(20),
    birth_date        DATE,
    gender            gender_type,
    address           TEXT,
    avatar_url        TEXT,
    id_number         VARCHAR(50),
    occupation        VARCHAR(100),
    status            member_status NOT NULL DEFAULT 'active',
    joined_at         DATE          NOT NULL DEFAULT CURRENT_DATE,
    is_active         BOOLEAN       NOT NULL DEFAULT true,
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        UUID          REFERENCES users(id),
    updated_by        UUID          REFERENCES users(id),
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID          REFERENCES users(id)
);

CREATE TABLE member_emergency_contacts (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id    UUID         NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    full_name    VARCHAR(200) NOT NULL,
    relationship VARCHAR(50),
    phone        VARCHAR(20)  NOT NULL,
    phone_alt    VARCHAR(20),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   UUID         REFERENCES users(id)
);

CREATE TABLE member_physical_stats (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id      UUID          NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    weight_kg      DECIMAL(5,2),
    height_cm      DECIMAL(5,2),
    body_fat_pct   DECIMAL(4,2),
    muscle_mass_kg DECIMAL(5,2),
    bmi            DECIMAL(4,2),
    notes          TEXT,
    measured_at    DATE          NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by     UUID          REFERENCES users(id)
);

-- ==============================================================
-- DOMAIN: MEMBERSHIPS
-- ==============================================================

CREATE TABLE membership_plans (
    id                         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                       VARCHAR(100)  NOT NULL,
    description                TEXT,
    duration_days              INT           NOT NULL CHECK (duration_days > 0),
    price                      DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    currency                   VARCHAR(3)    NOT NULL DEFAULT 'USD',
    max_classes_per_week       INT,
    includes_personal_training BOOLEAN       NOT NULL DEFAULT false,
    includes_locker            BOOLEAN       NOT NULL DEFAULT false,
    is_active                  BOOLEAN       NOT NULL DEFAULT true,
    note                       TEXT,
    created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by                 UUID          REFERENCES users(id),
    updated_by                 UUID          REFERENCES users(id)
);

CREATE TABLE member_memberships (
    id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id         UUID              NOT NULL REFERENCES members(id),
    plan_id           UUID              NOT NULL REFERENCES membership_plans(id),
    start_date        DATE              NOT NULL,
    end_date          DATE              NOT NULL,
    status            membership_status NOT NULL DEFAULT 'pending',
    freeze_start      DATE,
    freeze_end        DATE,
    auto_renew        BOOLEAN           NOT NULL DEFAULT false,
    discount_pct      DECIMAL(4,2)      NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    final_price       DECIMAL(10,2)     NOT NULL CHECK (final_price >= 0),
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    created_by        UUID              REFERENCES users(id),
    updated_by        UUID              REFERENCES users(id),
    CONSTRAINT chk_membership_dates CHECK (end_date > start_date)
);

-- ==============================================================
-- DOMAIN: INVENTORY
-- (created before sales so sale_details can reference products)
-- ==============================================================

CREATE TABLE product_categories (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID         REFERENCES users(id)
);

CREATE TABLE products (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID          REFERENCES product_categories(id),
    name            VARCHAR(150)  NOT NULL,
    description     TEXT,
    sku             VARCHAR(50)   UNIQUE,
    price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock           INT           NOT NULL DEFAULT 0,
    min_stock_alert INT           NOT NULL DEFAULT 5,
    image_url       TEXT,
    is_active       BOOLEAN       NOT NULL DEFAULT true,
    note            TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      UUID          REFERENCES users(id),
    updated_by      UUID          REFERENCES users(id)
);

-- ==============================================================
-- DOMAIN: PAYMENTS & SALES
-- ==============================================================

CREATE TABLE payment_methods (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotions (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                VARCHAR(50)     NOT NULL UNIQUE,
    name                VARCHAR(150)    NOT NULL,
    description         TEXT,
    type                promotion_type  NOT NULL,
    value               DECIMAL(10,2)   NOT NULL CHECK (value > 0),
    min_purchase_amount DECIMAL(10,2)   NOT NULL DEFAULT 0,
    max_uses            INT,
    used_count          INT             NOT NULL DEFAULT 0,
    valid_from          DATE            NOT NULL,
    valid_to            DATE            NOT NULL,
    applies_to          promotion_scope NOT NULL DEFAULT 'all',
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    note                TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          UUID            REFERENCES users(id),
    updated_by          UUID            REFERENCES users(id),
    CONSTRAINT chk_promotion_dates CHECK (valid_to >= valid_from)
);

CREATE TABLE sales (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id         UUID           REFERENCES members(id),
    cashier_id        UUID           NOT NULL REFERENCES users(id),
    sale_number       VARCHAR(20)    NOT NULL UNIQUE,
    sale_date         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    subtotal          DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount   DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount        DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount      DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount       DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    change_amount     DECIMAL(10,2)  NOT NULL DEFAULT 0,
    status            sale_status    NOT NULL DEFAULT 'draft',
    payment_status    payment_status NOT NULL DEFAULT 'pending',
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by        UUID           REFERENCES users(id),
    updated_by        UUID           REFERENCES users(id)
);

CREATE TABLE sale_details (
    id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id            UUID          NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id         UUID          REFERENCES products(id),
    membership_plan_id UUID          REFERENCES membership_plans(id),
    description        VARCHAR(255)  NOT NULL,
    quantity           DECIMAL(8,2)  NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price         DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    discount_pct       DECIMAL(4,2)  NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    discount_amount    DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    subtotal           DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    note               TEXT,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by         UUID          REFERENCES users(id)
);

CREATE TABLE sale_payments (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id           UUID          NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method_id UUID          NOT NULL REFERENCES payment_methods(id),
    amount            DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reference_code    VARCHAR(100),
    paid_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        UUID          REFERENCES users(id)
);

CREATE TABLE debts (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id           UUID          NOT NULL REFERENCES members(id),
    sale_id             UUID          REFERENCES sales(id),
    membership_id       UUID          REFERENCES member_memberships(id),
    concept             VARCHAR(255)  NOT NULL,
    original_amount     DECIMAL(10,2) NOT NULL CHECK (original_amount > 0),
    paid_amount         DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    remaining_amount    DECIMAL(10,2) NOT NULL,
    status              debt_status   NOT NULL DEFAULT 'pending',
    due_date            DATE,
    is_overdue          BOOLEAN       NOT NULL DEFAULT false,
    overdue_notified_at TIMESTAMPTZ,
    note                TEXT,
    system_commentary   TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by          UUID          REFERENCES users(id),
    updated_by          UUID          REFERENCES users(id)
);

CREATE TABLE debt_payments (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id           UUID          NOT NULL REFERENCES debts(id),
    payment_method_id UUID          NOT NULL REFERENCES payment_methods(id),
    amount            DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reference_code    VARCHAR(100),
    paid_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        UUID          REFERENCES users(id)
);

CREATE TABLE promotion_usages (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotion_id     UUID          NOT NULL REFERENCES promotions(id),
    member_id        UUID          REFERENCES members(id),
    sale_id          UUID          REFERENCES sales(id),
    membership_id    UUID          REFERENCES member_memberships(id),
    discount_applied DECIMAL(10,2) NOT NULL CHECK (discount_applied > 0),
    used_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- DOMAIN: CLASSES
-- ==============================================================

CREATE TABLE class_categories (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    color_hex   VARCHAR(7),
    icon_url    TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID         REFERENCES users(id)
);

CREATE TABLE classes (
    id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id      UUID         REFERENCES class_categories(id),
    trainer_id       UUID         REFERENCES users(id),
    name             VARCHAR(150) NOT NULL,
    description      TEXT,
    duration_minutes INT          NOT NULL CHECK (duration_minutes > 0),
    max_capacity     INT          CHECK (max_capacity > 0),
    room             VARCHAR(50),
    is_active        BOOLEAN      NOT NULL DEFAULT true,
    note             TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by       UUID         REFERENCES users(id),
    updated_by       UUID         REFERENCES users(id)
);

CREATE TABLE class_schedules (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id            UUID         NOT NULL REFERENCES classes(id),
    scheduled_at        TIMESTAMPTZ  NOT NULL,
    status              class_status NOT NULL DEFAULT 'scheduled',
    cancellation_reason TEXT,
    enrolled_count      INT          NOT NULL DEFAULT 0,
    note                TEXT,
    system_commentary   TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         REFERENCES users(id),
    updated_by          UUID         REFERENCES users(id)
);

CREATE TABLE class_enrollments (
    id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id         UUID              NOT NULL REFERENCES class_schedules(id),
    member_id           UUID              NOT NULL REFERENCES members(id),
    status              enrollment_status NOT NULL DEFAULT 'enrolled',
    enrolled_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    attended_at         TIMESTAMPTZ,
    cancellation_reason TEXT,
    note                TEXT,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    created_by          UUID              REFERENCES users(id),
    UNIQUE(schedule_id, member_id)
);

-- ==============================================================
-- DOMAIN: ATTENDANCE
-- ==============================================================

CREATE TABLE attendance_records (
    id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id      UUID              NOT NULL REFERENCES members(id),
    checked_in_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    method         attendance_method NOT NULL DEFAULT 'manual',
    registered_by  UUID              REFERENCES users(id),
    note           TEXT,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- DOMAIN: TRAINING & ROUTINES
-- ==============================================================

CREATE TABLE muscle_groups (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    image_url   TEXT
);

CREATE TABLE exercises (
    id              UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    muscle_group_id UUID             REFERENCES muscle_groups(id),
    name            VARCHAR(150)     NOT NULL,
    description     TEXT,
    difficulty      difficulty_level,
    video_url       TEXT,
    image_url       TEXT,
    is_active       BOOLEAN          NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by      UUID             REFERENCES users(id)
);

CREATE TABLE routines (
    id             UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainer_id     UUID             REFERENCES users(id),
    name           VARCHAR(150)     NOT NULL,
    description    TEXT,
    goal           VARCHAR(100),
    duration_weeks INT,
    days_per_week  INT              CHECK (days_per_week BETWEEN 1 AND 7),
    difficulty     difficulty_level,
    is_template    BOOLEAN          NOT NULL DEFAULT false,
    is_active      BOOLEAN          NOT NULL DEFAULT true,
    note           TEXT,
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by     UUID             REFERENCES users(id),
    updated_by     UUID             REFERENCES users(id)
);

CREATE TABLE routine_exercises (
    id               UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id       UUID       NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id      UUID       NOT NULL REFERENCES exercises(id),
    day_of_week      SMALLINT   CHECK (day_of_week BETWEEN 1 AND 7),
    sets             INT,
    reps             INT,
    rest_seconds     INT,
    duration_seconds INT,
    order_index      SMALLINT   NOT NULL DEFAULT 0,
    notes            TEXT
);

CREATE TABLE member_routines (
    id         UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id  UUID           NOT NULL REFERENCES members(id),
    routine_id UUID           NOT NULL REFERENCES routines(id),
    assigned_at DATE          NOT NULL DEFAULT CURRENT_DATE,
    ends_at    DATE,
    status     routine_status NOT NULL DEFAULT 'active',
    note       TEXT,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by UUID           REFERENCES users(id)
);

-- ==============================================================
-- DOMAIN: REMINDERS & NOTIFICATIONS
-- ==============================================================

CREATE TABLE reminders (
    id                UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id         UUID                 REFERENCES members(id),
    type              reminder_type        NOT NULL,
    title             VARCHAR(200)         NOT NULL,
    message           TEXT                 NOT NULL,
    trigger_date      TIMESTAMPTZ          NOT NULL,
    channel           notification_channel NOT NULL DEFAULT 'in_app',
    status            notification_status  NOT NULL DEFAULT 'pending',
    is_sent           BOOLEAN              NOT NULL DEFAULT false,
    sent_at           TIMESTAMPTZ,
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    created_by        UUID                 REFERENCES users(id)
);

CREATE TABLE notification_logs (
    id            UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id   UUID                 REFERENCES reminders(id),
    member_id     UUID                 REFERENCES members(id),
    user_id       UUID                 REFERENCES users(id),
    channel       notification_channel NOT NULL,
    title         VARCHAR(200)         NOT NULL,
    message       TEXT                 NOT NULL,
    status        notification_status  NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- DOMAIN: INVENTORY MOVEMENTS
-- ==============================================================

CREATE TABLE inventory_movements (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id        UUID          NOT NULL REFERENCES products(id),
    type              movement_type NOT NULL,
    quantity          INT           NOT NULL,
    unit_price        DECIMAL(10,2),
    total_price       DECIMAL(10,2),
    reference         VARCHAR(100),
    sale_id           UUID          REFERENCES sales(id),
    note              TEXT,
    system_commentary TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        UUID          REFERENCES users(id)
);

-- ==============================================================
-- DOMAIN: AUDIT
-- ==============================================================

CREATE TABLE audit_log (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id  UUID         NOT NULL,
    action     audit_action NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID         REFERENCES users(id),
    changed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- ==============================================================
-- INDEXES
-- ==============================================================

-- users
CREATE INDEX idx_users_role_id    ON users(role_id);
CREATE INDEX idx_users_status     ON users(status);
CREATE INDEX idx_users_active     ON users(deleted_at) WHERE deleted_at IS NULL;

-- members
CREATE INDEX idx_members_status     ON members(status);
CREATE INDEX idx_members_id_number  ON members(id_number);
CREATE INDEX idx_members_active     ON members(deleted_at) WHERE deleted_at IS NULL;

-- member_memberships
CREATE INDEX idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX idx_member_memberships_plan_id   ON member_memberships(plan_id);
CREATE INDEX idx_member_memberships_status    ON member_memberships(status);
CREATE INDEX idx_member_memberships_end_date  ON member_memberships(end_date);

-- sales
CREATE INDEX idx_sales_member_id      ON sales(member_id);
CREATE INDEX idx_sales_cashier_id     ON sales(cashier_id);
CREATE INDEX idx_sales_sale_date      ON sales(sale_date);
CREATE INDEX idx_sales_status         ON sales(status);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);

-- sale_details
CREATE INDEX idx_sale_details_sale_id   ON sale_details(sale_id);
CREATE INDEX idx_sale_details_product_id ON sale_details(product_id);

-- sale_payments
CREATE INDEX idx_sale_payments_sale_id ON sale_payments(sale_id);

-- debts
CREATE INDEX idx_debts_member_id  ON debts(member_id);
CREATE INDEX idx_debts_status     ON debts(status);
CREATE INDEX idx_debts_due_date   ON debts(due_date);
CREATE INDEX idx_debts_overdue    ON debts(is_overdue) WHERE is_overdue = true;

-- debt_payments
CREATE INDEX idx_debt_payments_debt_id ON debt_payments(debt_id);

-- classes
CREATE INDEX idx_class_schedules_class_id      ON class_schedules(class_id);
CREATE INDEX idx_class_schedules_scheduled_at  ON class_schedules(scheduled_at);
CREATE INDEX idx_class_schedules_status        ON class_schedules(status);
CREATE INDEX idx_class_enrollments_schedule_id ON class_enrollments(schedule_id);
CREATE INDEX idx_class_enrollments_member_id   ON class_enrollments(member_id);

-- attendance
CREATE INDEX idx_attendance_member_id     ON attendance_records(member_id);
CREATE INDEX idx_attendance_checked_in_at ON attendance_records(checked_in_at);

-- products
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_stock       ON products(stock);

-- inventory
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_sale_id    ON inventory_movements(sale_id);

-- reminders
CREATE INDEX idx_reminders_member_id    ON reminders(member_id);
CREATE INDEX idx_reminders_trigger_date ON reminders(trigger_date);
CREATE INDEX idx_reminders_pending      ON reminders(is_sent) WHERE is_sent = false;

-- audit
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by   ON audit_log(changed_by);
CREATE INDEX idx_audit_log_changed_at   ON audit_log(changed_at);

-- ==============================================================
-- TRIGGER: auto-update updated_at
-- ==============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_membership_plans_updated_at
    BEFORE UPDATE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_member_memberships_updated_at
    BEFORE UPDATE ON member_memberships
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_class_schedules_updated_at
    BEFORE UPDATE ON class_schedules
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_routines_updated_at
    BEFORE UPDATE ON routines
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ==============================================================
-- SEED: Roles
-- ==============================================================

INSERT INTO roles (name, description) VALUES
    ('owner',        'Full access to all system modules'),
    ('admin',        'Administrative access excluding billing configuration'),
    ('trainer',      'Access to members routines, classes and attendance'),
    ('receptionist', 'Access to check-ins, memberships and basic member management');

-- ==============================================================
-- SEED: Permissions
-- ==============================================================

INSERT INTO permissions (name, module, description) VALUES
    ('users.view',          'users',       'View staff users'),
    ('users.create',        'users',       'Create staff users'),
    ('users.edit',          'users',       'Edit staff users'),
    ('users.delete',        'users',       'Soft delete staff users'),
    ('members.view',        'members',     'View gym members'),
    ('members.create',      'members',     'Register new members'),
    ('members.edit',        'members',     'Edit member information'),
    ('members.delete',      'members',     'Soft delete members'),
    ('memberships.view',    'memberships', 'View membership plans and assignments'),
    ('memberships.manage',  'memberships', 'Create and edit membership plans'),
    ('sales.view',          'sales',       'View sales records'),
    ('sales.create',        'sales',       'Create new sales'),
    ('sales.cancel',        'sales',       'Cancel existing sales'),
    ('debts.view',          'debts',       'View member debts'),
    ('debts.manage',        'debts',       'Create and manage debts'),
    ('classes.view',        'classes',     'View classes and schedules'),
    ('classes.manage',      'classes',     'Create and manage classes'),
    ('attendance.register', 'attendance',  'Register member check-ins'),
    ('routines.view',       'routines',    'View training routines'),
    ('routines.manage',     'routines',    'Create and assign routines'),
    ('inventory.view',      'inventory',   'View products and stock levels'),
    ('inventory.manage',    'inventory',   'Manage products and stock movements'),
    ('reports.view',        'reports',     'View reports and analytics'),
    ('settings.manage',     'settings',    'Manage system configuration');

-- ==============================================================
-- SEED: Payment methods
-- ==============================================================

INSERT INTO payment_methods (name, description) VALUES
    ('cash',          'Cash payment'),
    ('card',          'Credit or debit card'),
    ('bank_transfer', 'Bank wire transfer'),
    ('qr_code',       'QR code payment'),
    ('credit',        'Store credit / pay on account');

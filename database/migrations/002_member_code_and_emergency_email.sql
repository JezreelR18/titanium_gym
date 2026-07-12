-- Add member_code sequence and column
CREATE SEQUENCE IF NOT EXISTS member_code_seq START 1;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS member_code VARCHAR(20) UNIQUE;

-- Backfill existing members with codes
DO $$
DECLARE
  rec RECORD;
  n   BIGINT;
BEGIN
  FOR rec IN SELECT id FROM members WHERE member_code IS NULL ORDER BY created_at LOOP
    n := nextval('member_code_seq');
    UPDATE members SET member_code = 'MB-' || LPAD(n::text, 5, '0') WHERE id = rec.id;
  END LOOP;
END $$;

-- Make not-null after backfill
ALTER TABLE members ALTER COLUMN member_code SET NOT NULL;

-- Add email to emergency contacts
ALTER TABLE member_emergency_contacts
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

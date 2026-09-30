-- Supabase Auth users may not have a legacy local password hash.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

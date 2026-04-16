-- Drop the redundant email mirror on profiles.
-- auth.users.email is the single source of truth for user email.
ALTER TABLE profiles DROP COLUMN IF EXISTS email;

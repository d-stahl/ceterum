-- Block unauthenticated callers from calling submit_placement directly.
-- Authenticated callers are still allowed — the Edge Function uses the anon client
-- with the user's JWT (which runs as 'authenticated'), and the SQL function already
-- validates auth.uid() internally.
REVOKE EXECUTE ON FUNCTION submit_placement(UUID, UUID, worker_type, orator_role) FROM anon;

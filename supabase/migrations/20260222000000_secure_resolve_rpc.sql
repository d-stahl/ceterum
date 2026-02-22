-- Only the Edge Function (service role) may call resolve_demagogery.
REVOKE EXECUTE ON FUNCTION resolve_demagogery(UUID, JSONB, JSONB) FROM authenticated, anon;

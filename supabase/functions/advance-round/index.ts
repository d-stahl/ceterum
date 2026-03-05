import { createEdgeClients, verifyMembership, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id } = await req.json();
    if (!game_id) {
      return errorResponse('Missing game_id', 400);
    }

    const { anonClient, adminClient, user } = await createEdgeClients(req.headers.get('Authorization'));
    await verifyMembership(anonClient, game_id, user.id);

    const { data, error } = await adminClient.rpc('advance_round', {
      p_game_id: game_id,
    });
    if (error) throw error;

    return jsonResponse(data);
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});

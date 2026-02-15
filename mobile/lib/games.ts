import { supabase } from './supabase';
import { generateCrisisName } from './crisis-names';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/1/O/0 confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGame(name: string): Promise<{ id: string; inviteCode: string; name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inviteCode = generateInviteCode();

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({ invite_code: inviteCode, created_by: user.id, name })
    .select()
    .single();

  if (gameError) throw gameError;

  const { error: joinError } = await supabase
    .from('game_players')
    .insert({ game_id: game.id, player_id: user.id });

  if (joinError) throw joinError;

  return { id: game.id, inviteCode, name };
}

export async function joinGame(inviteCode: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: game, error: findError } = await supabase
    .from('games')
    .select('id, status')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (findError || !game) throw new Error('Game not found');
  if (game.status !== 'lobby') throw new Error('Game is no longer accepting players');

  const { error: joinError } = await supabase
    .from('game_players')
    .insert({ game_id: game.id, player_id: user.id });

  if (joinError) {
    if (joinError.code === '23505') throw new Error('Already in this game');
    throw joinError;
  }

  return game.id;
}

export async function leaveGame(gameId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase
    .from('game_players')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', user.id);
}

export async function getMyGames() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('game_players')
    .select(`
      game_id,
      games (
        id,
        name,
        invite_code,
        status,
        created_at
      )
    `)
    .eq('player_id', user.id);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.games);
}

export async function getGamePlayers(gameId: string) {
  const { data, error } = await supabase
    .from('game_players')
    .select(`
      player_id,
      profiles (
        id,
        display_name
      )
    `)
    .eq('game_id', gameId);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.profiles);
}

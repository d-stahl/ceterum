import { supabase } from './supabase';
import { generateCrisisName } from './crisis-names';
import { PLAYER_COLORS } from './player-colors';
import { selectAndBalanceFactions } from './game-engine/balance';
import { CONTROVERSIES } from './game-engine/controversies';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/1/O/0 confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGame(name: string, maxPlayers: number = 3): Promise<{ id: string; inviteCode: string; name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inviteCode = generateInviteCode();

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({ invite_code: inviteCode, created_by: user.id, name, max_players: maxPlayers })
    .select()
    .single();

  if (gameError) throw gameError;

  const { error: joinError } = await supabase
    .from('game_players')
    .insert({ game_id: game.id, player_id: user.id, color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)].id });

  if (joinError) throw joinError;

  return { id: game.id, inviteCode, name };
}

export async function joinGame(inviteCode: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: game, error: findError } = await supabase
    .from('games')
    .select('id, status, max_players')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (findError || !game) throw new Error('Game not found');
  if (game.status !== 'lobby') throw new Error('Game is no longer accepting players');

  // Check if game is full
  const { data: existing } = await supabase
    .from('game_players')
    .select('color')
    .eq('game_id', game.id);

  if ((existing ?? []).length >= game.max_players) throw new Error('Game is full');

  // Pick first available color
  const takenColors = new Set((existing ?? []).map((r: any) => r.color));
  const availableColor = PLAYER_COLORS.find(c => !takenColors.has(c.id))?.id ?? 'ivory';

  const { error: joinError } = await supabase
    .from('game_players')
    .insert({ game_id: game.id, player_id: user.id, color: availableColor });

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

export async function kickPlayer(gameId: string, playerId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify caller is the game creator
  const { data: game } = await supabase
    .from('games')
    .select('created_by, name')
    .eq('id', gameId)
    .single();

  if (!game || game.created_by !== user.id) throw new Error('Only the game creator can kick players');

  // Get creator's display name for the event message
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  // Remove the player
  await supabase
    .from('game_players')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', playerId);

  // Create event for the kicked player
  await supabase.from('events').insert({
    user_id: playerId,
    type: 'kicked',
    title: 'Removed from game',
    body: `You were removed from "${game.name}" by ${creatorProfile?.display_name ?? 'the host'}.`,
    data: { game_id: gameId },
  });
}

export async function deleteGame(gameId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: game } = await supabase
    .from('games')
    .select('created_by, name')
    .eq('id', gameId)
    .single();

  if (!game || game.created_by !== user.id) throw new Error('Only the game creator can delete games');

  // Get creator name
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  // Get all other players to notify them
  const { data: players } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId)
    .neq('player_id', user.id);

  // Create events for all other players
  if (players && players.length > 0) {
    await supabase.from('events').insert(
      players.map((p) => ({
        user_id: p.player_id,
        type: 'game_deleted',
        title: 'Game closed',
        body: `"${game.name}" was closed by ${creatorProfile?.display_name ?? 'the host'}.`,
        data: { game_id: gameId },
      }))
    );
  }

  // Delete the game (CASCADE will remove game_players)
  await supabase.from('games').delete().eq('id', gameId);
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

export async function launchGame(gameId: string): Promise<void> {
  // Get player count
  const { data: players, error: playersError } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId);

  if (playersError) throw playersError;
  const playerCount = (players ?? []).length;

  // Select and balance factions
  const factions = selectAndBalanceFactions(playerCount);

  // Stratified shuffle: ensures one controversy of each category per group of 5 drawn
  const categories = ['military', 'social', 'economic', 'political', 'religious'] as const;
  const byCategory = categories.map((cat) =>
    CONTROVERSIES.filter((c) => c.category === cat).map((c) => c.key).sort(() => Math.random() - 0.5)
  );
  const deckOrder: string[] = [];
  for (let i = 0; i < 4; i++) {
    const group = byCategory.map((keys) => keys[i]);
    group.sort(() => Math.random() - 0.5);
    deckOrder.push(...group);
  }

  // Call RPC to initialize game state in a single transaction
  const { error } = await supabase.rpc('launch_game', {
    p_game_id: gameId,
    p_factions: factions,
    p_controversies: CONTROVERSIES,
    p_deck_order: deckOrder,
  });

  if (error) throw error;
}

export async function getGamePlayers(gameId: string) {
  const { data, error } = await supabase
    .from('game_players')
    .select(`
      player_id,
      color,
      profiles (
        id,
        display_name
      )
    `)
    .eq('game_id', gameId);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row.profiles, color: row.color }));
}

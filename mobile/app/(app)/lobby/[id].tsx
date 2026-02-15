import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getGamePlayers, leaveGame, kickPlayer, deleteGame } from '../../../lib/games';
import { supabase } from '../../../lib/supabase';
import { PLAYER_COLORS, getColorHex } from '../../../lib/player-colors';

type Player = {
  id: string;
  display_name: string;
  color: string;
};

export default function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [gameName, setGameName] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatorId, setCreatorId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const currentUserIdRef = useRef('');

  useEffect(() => {
    loadLobby();

    const channel = supabase
      .channel(`lobby-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'DELETE' && payload.old?.player_id === currentUserIdRef.current) {
            router.replace('/(app)/home');
            return;
          }
          loadPlayers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          router.replace('/(app)/home');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  async function loadLobby() {
    setLoading(true);
    try {
      const { data: game } = await supabase
        .from('games')
        .select('invite_code, name, created_by')
        .eq('id', gameId)
        .single();

      if (game) {
        setInviteCode(game.invite_code);
        setGameName(game.name);
        setCreatorId(game.created_by);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
      }

      await loadPlayers();
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers() {
    const data = await getGamePlayers(gameId!);
    setPlayers(data);
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleKick(playerId: string) {
    await kickPlayer(gameId!, playerId);
  }

  async function handleColorChange(newColor: string) {
    await supabase
      .from('game_players')
      .update({ color: newColor })
      .eq('game_id', gameId)
      .eq('player_id', currentUserId);
    await loadPlayers();
  }

  async function handleLeave() {
    if (currentUserId === creatorId) {
      const otherPlayers = players.filter(p => p.id !== currentUserId);
      if (otherPlayers.length > 0) {
        Alert.alert(
          'Close Game?',
          'Are you sure? This will close the game for all players.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Close Game', style: 'destructive', onPress: async () => {
              await deleteGame(gameId!);
              router.replace('/(app)/home');
            }},
          ]
        );
        return;
      }
      await deleteGame(gameId!);
    } else {
      await leaveGame(gameId!);
    }
    router.replace('/(app)/home');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e0c097" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.gameName}>{gameName}</Text>

      <Pressable style={styles.codeBox} onPress={handleCopy}>
        <Text style={styles.codeLabel}>Invite Code</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.copyHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
      </Pressable>

      <View style={styles.colorPickerSection}>
        <Text style={styles.colorPickerLabel}>Your Color</Text>
        <View style={styles.colorPickerRow}>
          {PLAYER_COLORS.map((c) => {
            const taken = players.some(p => p.color === c.id && p.id !== currentUserId);
            const isSelected = players.find(p => p.id === currentUserId)?.color === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => !taken && handleColorChange(c.id)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c.hex },
                  isSelected && styles.colorDotSelected,
                  taken && styles.colorDotTaken,
                ]}
              />
            );
          })}
        </View>
      </View>

      <Text style={styles.playersLabel}>
        Players ({players.length})
      </Text>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.playerCard}>
            <View style={[styles.playerColorDot, { backgroundColor: getColorHex(item.color) }]} />
            <Text style={styles.playerName}>{item.display_name}</Text>
            {currentUserId === creatorId && item.id !== creatorId && (
              <Pressable onPress={() => handleKick(item.id)} hitSlop={8}>
                <Text style={styles.kickIcon}>✕</Text>
              </Pressable>
            )}
          </View>
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <Pressable onPress={() => router.replace('/(app)/home')}>
          <Text style={styles.homeText}>Home</Text>
        </Pressable>
        <Pressable onPress={handleLeave}>
          <Text style={styles.leaveText}>Leave Game</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  gameName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#e0c097',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  codeBox: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 16,
    backgroundColor: 'rgba(224, 192, 151, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.3)',
  },
  codeLabel: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 14,
    marginBottom: 4,
  },
  code: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e0c097',
    letterSpacing: 8,
  },
  copyHint: {
    color: '#e0c097',
    opacity: 0.5,
    fontSize: 12,
    marginTop: 6,
  },
  playersLabel: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
  },
  playerCard: {
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  playerName: {
    color: '#e0c097',
    fontSize: 16,
    flex: 1,
  },
  colorPickerSection: {
    marginBottom: 24,
  },
  colorPickerLabel: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 14,
    marginBottom: 8,
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#e0c097',
  },
  colorDotTaken: {
    opacity: 0.2,
  },
  kickIcon: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  homeText: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 16,
  },
  leaveText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
});

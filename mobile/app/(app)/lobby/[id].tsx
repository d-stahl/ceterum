import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, Modal, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getGamePlayers, leaveGame, kickPlayer, deleteGame } from '../../../lib/games';
import { supabase } from '../../../lib/supabase';
import { PLAYER_COLORS, getColorHex } from '../../../lib/player-colors';

const lobbyBg = require('../../../assets/images/lobby-bg.png');

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
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
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
        .select('invite_code, name, created_by, max_players')
        .eq('id', gameId)
        .single();

      if (game) {
        setInviteCode(game.invite_code);
        setGameName(game.name);
        setCreatorId(game.created_by);
        setMaxPlayers(game.max_players);
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
    setColorPickerOpen(false);
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
      <ImageBackground source={lobbyBg} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#e0c097" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={lobbyBg} style={styles.background} resizeMode="cover">
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.gameName}>{gameName}</Text>

      <Pressable style={styles.codeBox} onPress={handleCopy}>
        <Text style={styles.codeLabel}>Invite Code</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.copyHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
      </Pressable>

      <Text style={styles.playersLabel}>
        Players ({players.length}/{maxPlayers})
      </Text>

      <FlatList
        data={[
          ...players.map(p => ({ type: 'player' as const, player: p, key: p.id })),
          ...Array.from({ length: maxPlayers - players.length }, (_, i) => ({
            type: 'empty' as const, player: null, key: `empty-${i}`,
          })),
        ]}
        keyExtractor={(item) => item.key}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => {
          if (item.type === 'empty') {
            return (
              <View style={styles.emptySlot}>
                <Text style={styles.emptySlotText}>Waiting...</Text>
              </View>
            );
          }
          const p = item.player!;
          const isMe = p.id === currentUserId;
          const isHost = p.id === creatorId;
          const card = (
            <View style={styles.playerCard}>
              <View style={[styles.playerColorDot, { backgroundColor: getColorHex(p.color) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName} numberOfLines={1}>{p.display_name}</Text>
                {isMe && <Text style={styles.changeColorHint}>Tap to change color</Text>}
                {!isMe && isHost && <Text style={styles.changeColorHint}>Game host</Text>}
              </View>
              {currentUserId === creatorId && p.id !== creatorId && (
                <Pressable onPress={() => handleKick(p.id)} hitSlop={8}>
                  <Text style={styles.kickIcon}>✕</Text>
                </Pressable>
              )}
            </View>
          );
          if (isMe) {
            return <Pressable style={styles.columnItem} onPress={() => setColorPickerOpen(true)}>{card}</Pressable>;
          }
          return <View style={styles.columnItem}>{card}</View>;
        }}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={colorPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setColorPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Your Color</Text>
            <View style={styles.colorGrid}>
              {PLAYER_COLORS.map((c) => {
                const taken = players.some(p => p.color === c.id && p.id !== currentUserId);
                const isSelected = players.find(p => p.id === currentUserId)?.color === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => !taken && handleColorChange(c.id)}
                    disabled={taken}
                    style={[
                      styles.colorOption,
                      taken && styles.colorOptionTaken,
                      isSelected && styles.colorOptionSelected,
                    ]}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                    <Text style={[styles.colorLabel, taken && { opacity: 0.3 }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.modalDismiss} onPress={() => setColorPickerOpen(false)}>
              <Text style={styles.modalDismissText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {currentUserId === creatorId && (
        <Pressable
          style={[styles.launchButton, players.length < maxPlayers && styles.launchButtonDisabled]}
          disabled={players.length < maxPlayers}
          onPress={() => {}}
        >
          <Text style={[styles.launchButtonText, players.length < maxPlayers && styles.launchButtonTextDisabled]}>
            {players.length < maxPlayers ? `Waiting for ${maxPlayers - players.length} more...` : 'Launch Game'}
          </Text>
        </Pressable>
      )}

      <View style={styles.footer}>
        <Pressable onPress={() => router.replace('/(app)/home')}>
          <Text style={styles.homeText}>Home</Text>
        </Pressable>
        <Pressable onPress={handleLeave}>
          <Text style={styles.leaveText}>Leave Game</Text>
        </Pressable>
      </View>
    </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
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
  columnWrapper: {
    gap: 8,
  },
  columnItem: {
    flex: 1,
  },
  playerCard: {
    flex: 1,
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptySlot: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(224, 192, 151, 0.2)',
  },
  emptySlotText: {
    color: '#e0c097',
    opacity: 0.3,
    fontSize: 14,
    fontStyle: 'italic',
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
  },
  changeColorHint: {
    color: '#e0c097',
    opacity: 0.4,
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.3)',
  },
  modalTitle: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  colorOption: {
    alignItems: 'center',
    width: 60,
    paddingVertical: 8,
    borderRadius: 8,
  },
  colorOptionTaken: {
    opacity: 0.3,
  },
  colorOptionSelected: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  colorLabel: {
    color: '#e0c097',
    fontSize: 10,
  },
  modalDismiss: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalDismissText: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 14,
  },
  kickIcon: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  launchButton: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  launchButtonDisabled: {
    borderColor: 'rgba(224, 192, 151, 0.2)',
    backgroundColor: 'rgba(224, 192, 151, 0.05)',
  },
  launchButtonText: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
  },
  launchButtonTextDisabled: {
    opacity: 0.3,
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

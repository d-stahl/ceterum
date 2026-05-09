import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMyGames, setGameHidden } from '../../lib/games';
import { C, parchmentBg, navyBg } from '../../lib/theme';

const myGamesBg = require('../../assets/images/my-games-bg.png');

type Game = {
  id: string;
  name: string;
  invite_code: string;
  status: string;
  created_at: string;
  hidden: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  lobby: 'In lobby',
  in_progress: 'In progress',
  finished: 'Ended',
};

const STATUS_ORDER: Record<string, number> = {
  lobby: 0,
  in_progress: 1,
  finished: 2,
};

function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function MyGamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [])
  );

  async function loadGames() {
    setLoading(true);
    try {
      const data = await getMyGames();
      setGames(sortGames(data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleHidden(game: Game) {
    const nextHidden = !game.hidden;
    setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, hidden: nextHidden } : g)));
    try {
      await setGameHidden(game.id, nextHidden);
    } catch (e) {
      console.error(e);
      setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, hidden: game.hidden } : g)));
    }
  }

  const visibleGames = showHidden ? games : games.filter((g) => !g.hidden);
  const hiddenCount = games.filter((g) => g.hidden).length;

  function renderGame({ item }: { item: Game }) {
    return (
      <View style={styles.gameRow}>
        <Pressable
          style={[styles.gameCard, item.hidden && styles.gameCardHidden]}
          onPress={() => {
            if (item.status === 'in_progress' || item.status === 'finished') {
              router.push(`/(app)/game/${item.id}` as any);
            } else {
              router.push(`/(app)/lobby/${item.id}`);
            }
          }}
        >
          <Text style={styles.gameName}>{item.name}</Text>
          <View style={styles.gameInfo}>
            <Text style={styles.gameStatus}>{STATUS_LABELS[item.status] ?? item.status}</Text>
            <Text style={styles.gameCode}>{item.invite_code}</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.hideButton}
          onPress={() => toggleHidden(item)}
          hitSlop={8}
        >
          <Ionicons
            name={item.hidden ? 'eye-outline' : 'eye-off-outline'}
            size={22}
            color={C.parchment}
            style={{ opacity: item.hidden ? 0.9 : 0.5 }}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <ImageBackground source={myGamesBg} style={styles.background} resizeMode="cover">
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.heading}>My Games</Text>

      {loading ? (
        <ActivityIndicator size="large" color={C.parchment} />
      ) : games.length === 0 ? (
        <Text style={styles.empty}>No games yet. Create or join one!</Text>
      ) : visibleGames.length === 0 ? (
        <Text style={styles.empty}>
          {hiddenCount > 0 ? 'All your games are hidden.' : 'No games yet. Create or join one!'}
        </Text>
      ) : (
        <FlatList
          data={visibleGames}
          keyExtractor={(item) => item.id}
          renderItem={renderGame}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.footerButton} onPress={() => router.back()}>
          <Text style={styles.footerText}>Back</Text>
        </Pressable>
        {hiddenCount > 0 && (
          <Pressable style={styles.footerButton} onPress={() => setShowHidden((s) => !s)}>
            <Text style={styles.footerText}>
              {showHidden ? 'Hide hidden games' : `Show hidden games (${hiddenCount})`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: navyBg(0.7),
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: C.parchment,
    marginBottom: 24,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  gameCard: {
    flex: 1,
    backgroundColor: parchmentBg(0.1),
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    borderRadius: 8,
    padding: 16,
  },
  gameCardHidden: {
    opacity: 0.5,
  },
  hideButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    borderRadius: 8,
    backgroundColor: parchmentBg(0.05),
  },
  gameName: {
    color: C.parchment,
    fontSize: 17,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameStatus: {
    color: C.parchment,
    fontSize: 13,
    opacity: 0.5,
  },
  gameCode: {
    color: C.parchment,
    fontSize: 13,
    opacity: 0.5,
    letterSpacing: 2,
  },
  empty: {
    color: C.parchment,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  footerText: {
    color: C.parchment,
    opacity: 0.6,
    fontSize: 16,
  },
});

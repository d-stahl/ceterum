import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMyGames } from '../../lib/games';

const myGamesBg = require('../../assets/images/my-games-bg.png');

type Game = {
  id: string;
  name: string;
  invite_code: string;
  status: string;
  created_at: string;
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

  function renderGame({ item }: { item: Game }) {
    return (
      <Pressable
        style={styles.gameCard}
        onPress={() => router.push(`/(app)/lobby/${item.id}`)}
      >
        <Text style={styles.gameName}>{item.name}</Text>
        <View style={styles.gameInfo}>
          <Text style={styles.gameStatus}>{STATUS_LABELS[item.status] ?? item.status}</Text>
          <Text style={styles.gameCode}>{item.invite_code}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <ImageBackground source={myGamesBg} style={styles.background} resizeMode="cover">
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.heading}>My Games</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#e0c097" />
      ) : games.length === 0 ? (
        <Text style={styles.empty}>No games yet. Create or join one!</Text>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.id}
          renderItem={renderGame}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
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
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0c097',
    marginBottom: 24,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  gameCard: {
    backgroundColor: 'rgba(224, 192, 151, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.3)',
    borderRadius: 8,
    padding: 16,
  },
  gameName: {
    color: '#e0c097',
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
    color: '#e0c097',
    fontSize: 13,
    opacity: 0.5,
  },
  gameCode: {
    color: '#e0c097',
    fontSize: 13,
    opacity: 0.5,
    letterSpacing: 2,
  },
  empty: {
    color: '#e0c097',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
  },
  backButton: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  backText: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 16,
  },
});

import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { joinGame } from '../../lib/games';
import { CodeEntry } from '../../components/CodeEntry';
import { C, navyBg } from '../../lib/theme';

const joinGameBg = require('../../assets/images/join-game-bg.png');

export default function JoinGameScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const cleaned = code.replace(/\u200B/g, '');
    if (cleaned.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const gameId = await joinGame(cleaned);
      router.replace(`/(app)/lobby/${gameId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={joinGameBg} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <Text style={styles.heading}>Join Game</Text>

        <CodeEntry
          value={code}
          onChangeText={setCode}
          onSubmit={handleJoin}
          buttonLabel="Join"
          submitting={loading}
          error={error}
        />

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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: navyBg(0.7),
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: C.parchment,
    marginBottom: 32,
  },
  backButton: {
    marginTop: 32,
  },
  backText: {
    color: C.parchment,
    opacity: 0.6,
    fontSize: 16,
  },
});

import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { joinGame } from '../../lib/games';

const joinGameBg = require('../../assets/images/join-game-bg.png');

export default function JoinGameScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (code.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const gameId = await joinGame(code);
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

      <TextInput
        style={styles.input}
        placeholder="ABCDEF"
        placeholderTextColor="rgba(224, 192, 151, 0.3)"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#e0c097" />
      ) : (
        <Pressable style={styles.button} onPress={handleJoin}>
          <Text style={styles.buttonText}>Join</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

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
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0c097',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0c097',
    textAlign: 'center',
    letterSpacing: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e0c097',
    paddingVertical: 12,
    marginBottom: 32,
  },
  button: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: '#ff6b6b',
    marginTop: 16,
  },
  backButton: {
    marginTop: 32,
  },
  backText: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 16,
  },
});

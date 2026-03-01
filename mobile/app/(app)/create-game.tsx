import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { createGame } from '../../lib/games';
import { generateCrisisName } from '../../lib/crisis-names';
import { C, parchmentBg, navyBg } from '../../lib/theme';

const createGameBg = require('../../assets/images/create-game-bg.png');

export default function CreateGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gameName, setGameName] = useState(generateCrisisName());
  const [playerCount, setPlayerCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!gameName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { id, inviteCode } = await createGame(gameName.trim(), playerCount);
      setGameId(id);
      setInviteCode(inviteCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ImageBackground source={createGameBg} style={styles.background} resizeMode="cover">
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.heading}>Create Game</Text>

      {!inviteCode ? (
        <View style={styles.form}>
          <Text style={styles.label}>Game Name</Text>
          <TextInput
            style={styles.nameInput}
            value={gameName}
            onChangeText={setGameName}
            placeholderTextColor={parchmentBg(0.3)}
            autoCorrect={false}
          />

          <Text style={styles.label}>Number of Players</Text>
          <View style={styles.counterRow}>
            <Pressable
              style={[styles.counterButton, playerCount <= 3 && styles.counterButtonDisabled]}
              onPress={() => setPlayerCount(c => Math.max(3, c - 1))}
              disabled={playerCount <= 3}
            >
              <Text style={[styles.counterButtonText, playerCount <= 3 && styles.counterButtonTextDisabled]}>−</Text>
            </Pressable>
            <Text style={styles.counterValue}>{playerCount}</Text>
            <Pressable
              style={[styles.counterButton, playerCount >= 8 && styles.counterButtonDisabled]}
              onPress={() => setPlayerCount(c => Math.min(8, c + 1))}
              disabled={playerCount >= 8}
            >
              <Text style={[styles.counterButtonText, playerCount >= 8 && styles.counterButtonTextDisabled]}>+</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={C.parchment} />
          ) : (
            <Pressable style={styles.button} onPress={handleCreate}>
              <Text style={styles.buttonText}>Create Game</Text>
            </Pressable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.gameName}>{gameName}</Text>
          <Text style={styles.shareLabel}>Share this code with your friends:</Text>
          <Pressable onPress={handleCopy}>
            <Text style={styles.code}>{inviteCode}</Text>
            <Text style={styles.copyHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => router.push(`/(app)/lobby/${gameId}`)}
          >
            <Text style={styles.buttonText}>Go to Lobby</Text>
          </Pressable>
        </View>
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
  form: {
    width: '100%',
    gap: 20,
    alignItems: 'center',
  },
  label: {
    color: C.parchment,
    fontSize: 14,
    opacity: 0.6,
    alignSelf: 'flex-start',
  },
  nameInput: {
    width: '100%',
    fontSize: 18,
    color: C.parchment,
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    borderRadius: 8,
    padding: 14,
    backgroundColor: parchmentBg(0.08),
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.parchment,
    backgroundColor: parchmentBg(0.15),
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.3,
  },
  counterButtonText: {
    color: C.parchment,
    fontSize: 22,
    fontWeight: '600',
  },
  counterButtonTextDisabled: {
    opacity: 0.5,
  },
  counterValue: {
    color: C.parchment,
    fontSize: 28,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
  resultContainer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  gameName: {
    fontSize: 20,
    fontWeight: '600',
    color: C.parchment,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  shareLabel: {
    color: C.parchment,
    fontSize: 16,
    opacity: 0.8,
  },
  code: {
    fontSize: 48,
    fontWeight: 'bold',
    color: C.parchment,
    letterSpacing: 8,
    textAlign: 'center',
  },
  copyHint: {
    color: C.parchment,
    opacity: 0.5,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: C.error,
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

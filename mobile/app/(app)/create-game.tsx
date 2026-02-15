import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { createGame } from '../../lib/games';
import { generateCrisisName } from '../../lib/crisis-names';

export default function CreateGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gameName, setGameName] = useState(generateCrisisName());
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
      const { id, inviteCode } = await createGame(gameName.trim());
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
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.heading}>Create Game</Text>

      {!inviteCode ? (
        <View style={styles.form}>
          <Text style={styles.label}>Game Name</Text>
          <TextInput
            style={styles.nameInput}
            value={gameName}
            onChangeText={setGameName}
            placeholderTextColor="rgba(224, 192, 151, 0.3)"
            autoCorrect={false}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#e0c097" />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0c097',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    gap: 20,
    alignItems: 'center',
  },
  label: {
    color: '#e0c097',
    fontSize: 14,
    opacity: 0.6,
    alignSelf: 'flex-start',
  },
  nameInput: {
    width: '100%',
    fontSize: 18,
    color: '#e0c097',
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.3)',
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
  },
  button: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#e0c097',
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
    color: '#e0c097',
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  shareLabel: {
    color: '#e0c097',
    fontSize: 16,
    opacity: 0.8,
  },
  code: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e0c097',
    letterSpacing: 8,
    textAlign: 'center',
  },
  copyHint: {
    color: '#e0c097',
    opacity: 0.5,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: '#ff6b6b',
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

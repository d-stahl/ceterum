import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ImageBackground } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAnonymousUser, signInWithEmail } from '../lib/auth';
import { EmailOtpModal } from '../components/EmailOtpModal';
import { C, parchmentBg, navyBg } from '../lib/theme';

const homeBg = require('../assets/images/home-bg.png');

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sentToEmail, setSentToEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      await createAnonymousUser();
      // onAuthStateChange in _layout picks this up and routes to /home.
    } catch (e: any) {
      setError(e.message ?? 'Could not create profile');
    } finally {
      setCreating(false);
    }
  }

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setSendingOtp(true);
    setError(null);
    try {
      await signInWithEmail(trimmed);
      setSentToEmail(trimmed);
      setModalVisible(true);
    } catch (e: any) {
      setError(e.message ?? 'Could not send code');
    } finally {
      setSendingOtp(false);
    }
  }

  function handleOtpSuccess() {
    setModalVisible(false);
    // onAuthStateChange routes to /home; nothing else to do here.
  }

  return (
    <ImageBackground source={homeBg} style={styles.background} resizeMode="cover">
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>CETERUM</Text>

        <View style={styles.content}>
          {creating ? (
            <ActivityIndicator size="large" color={C.parchment} style={{ marginVertical: 8 }} />
          ) : (
            <Pressable style={styles.primaryButton} onPress={handleCreate}>
              <Text style={styles.primaryButtonText}>Create Profile</Text>
            </Pressable>
          )}

          <View style={styles.spacer} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.emailInput}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={parchmentBg(0.3)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          {sendingOtp ? (
            <ActivityIndicator size="large" color={C.parchment} style={{ marginTop: 16 }} />
          ) : (
            <Pressable style={styles.primaryButton} onPress={handleSignIn}>
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </Pressable>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <EmailOtpModal
          visible={modalVisible}
          email={sentToEmail}
          mode="signin"
          onCancel={() => setModalVisible(false)}
          onSuccess={handleOtpSuccess}
        />
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
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: C.parchment,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 48,
    marginTop: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: {
    height: 64,
  },
  label: {
    color: C.parchment,
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 6,
  },
  emailInput: {
    fontSize: 18,
    color: C.parchment,
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    borderRadius: 8,
    padding: 14,
    backgroundColor: parchmentBg(0.08),
    marginBottom: 16,
  },
  error: {
    color: C.error,
    marginTop: 16,
    textAlign: 'center',
  },
});

import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { requestEmailUpdate } from '../../lib/auth';
import { EmailOtpModal } from '../../components/EmailOtpModal';
import { C, parchmentBg, navyBg } from '../../lib/theme';

const profileBg = require('../../assets/images/profile-bg.png');

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [email, setEmail] = useState('');            // persisted email on profile row
  const [emailInput, setEmailInput] = useState('');  // draft email for register/change
  const [sentToEmail, setSentToEmail] = useState(''); // snapshot of email at OTP-send time
  const [editingEmail, setEditingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name);
        setOriginalName(data.display_name);
        setEmail(data.email ?? '');
      }
    }
    setLoading(false);
  }

  const hasChanges = displayName.trim() !== originalName;
  const hasLinkedEmail = email.length > 0;

  async function handleSave() {
    if (!hasChanges || !displayName.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName.trim() })
          .eq('id', user.id);
        setOriginalName(displayName.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterEmail() {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid email address');
      return;
    }
    setSendingOtp(true);
    setEmailError(null);
    try {
      await requestEmailUpdate(trimmed);
      setSentToEmail(trimmed);
      setModalVisible(true);
    } catch (e: any) {
      setEmailError(e.message ?? 'Could not send code');
    } finally {
      setSendingOtp(false);
    }
  }

  function handleOtpSuccess() {
    setModalVisible(false);
    setEditingEmail(false);
    setEmailInput('');
    loadProfile();
  }

  if (loading) {
    return (
      <ImageBackground source={profileBg} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator size="large" color={C.parchment} />
        </View>
      </ImageBackground>
    );
  }

  const showEmailEntry = editingEmail || !hasLinkedEmail;

  return (
    <ImageBackground source={profileBg} style={styles.background} resizeMode="cover">
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              autoCorrect={false}
              maxLength={28}
            />
            <Text style={styles.hint}>Name changes do not affect games in progress.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            {showEmailEntry ? (
              <>
                <TextInput
                  style={styles.input}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="you@example.com"
                  placeholderTextColor={parchmentBg(0.3)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                {sendingOtp ? (
                  <ActivityIndicator size="small" color={C.parchment} style={{ marginTop: 8 }} />
                ) : (
                  <Pressable style={styles.emailButton} onPress={handleRegisterEmail}>
                    <Text style={styles.emailButtonText}>
                      {hasLinkedEmail ? 'Update Email' : 'Register Email'}
                    </Text>
                  </Pressable>
                )}
                {hasLinkedEmail && (
                  <Pressable
                    style={styles.inlineCancel}
                    onPress={() => {
                      setEditingEmail(false);
                      setEmailInput('');
                      setEmailError(null);
                    }}
                  >
                    <Text style={styles.inlineCancelText}>Cancel</Text>
                  </Pressable>
                )}
                {emailError && <Text style={styles.error}>{emailError}</Text>}
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={email}
                  editable={false}
                />
                <Pressable style={styles.emailButton} onPress={() => setEditingEmail(true)}>
                  <Text style={styles.emailButtonText}>Change Email</Text>
                </Pressable>
              </>
            )}
          </View>

          {saving ? (
            <ActivityIndicator size="small" color={C.parchment} />
          ) : (
            <Pressable
              style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!hasChanges}
            >
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
                {saved ? 'Saved!' : 'Save Changes'}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <EmailOtpModal
          visible={modalVisible}
          email={sentToEmail}
          mode="update"
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
    paddingTop: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: C.parchment,
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    gap: 24,
  },
  field: {
    gap: 6,
  },
  label: {
    color: C.parchment,
    fontSize: 14,
    opacity: 0.6,
  },
  input: {
    fontSize: 18,
    color: C.parchment,
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    borderRadius: 8,
    padding: 14,
    backgroundColor: parchmentBg(0.08),
  },
  inputDisabled: {
    opacity: 0.5,
  },
  hint: {
    color: C.parchment,
    fontSize: 12,
    opacity: 0.4,
    marginTop: 2,
  },
  emailButton: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  emailButtonText: {
    color: C.parchment,
    fontSize: 15,
    fontWeight: '600',
  },
  inlineCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  inlineCancelText: {
    color: C.parchment,
    opacity: 0.6,
    fontSize: 14,
  },
  error: {
    color: C.error,
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    borderColor: parchmentBg(0.2),
    backgroundColor: parchmentBg(0.05),
  },
  saveButtonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    opacity: 0.3,
  },
  backButton: {
    marginTop: 32,
    alignItems: 'center',
  },
  backText: {
    color: C.parchment,
    opacity: 0.6,
    fontSize: 16,
  },
});

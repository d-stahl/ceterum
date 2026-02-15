import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e0c097" />
      </View>
    );
  }

  return (
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
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email || 'Not linked'}
            editable={false}
          />
          <Text style={styles.hint}>Email linking available after deployment</Text>
        </View>

        {saving ? (
          <ActivityIndicator size="small" color="#e0c097" />
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
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0c097',
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
    color: '#e0c097',
    fontSize: 14,
    opacity: 0.6,
  },
  input: {
    fontSize: 18,
    color: '#e0c097',
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.3)',
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
  },
  inputDisabled: {
    opacity: 0.4,
  },
  hint: {
    color: '#e0c097',
    fontSize: 12,
    opacity: 0.4,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    borderColor: 'rgba(224, 192, 151, 0.2)',
    backgroundColor: 'rgba(224, 192, 151, 0.05)',
  },
  saveButtonText: {
    color: '#e0c097',
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
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 16,
  },
});

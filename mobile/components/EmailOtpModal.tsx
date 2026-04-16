import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { CodeEntry } from './CodeEntry';
import { verifyEmailOtp, verifyEmailUpdate } from '../lib/auth';
import { C, parchmentBg, navyBg, blackBg } from '../lib/theme';

type Props = {
  visible: boolean;
  email: string;
  mode: 'signin' | 'update';
  onCancel: () => void;
  onSuccess: () => void;
};

export function EmailOtpModal({ visible, email, mode, onCancel, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  async function handleVerify() {
    const cleaned = code.replace(/\u200B/g, '');
    if (cleaned.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await verifyEmailOtp(email, cleaned);
      } else {
        await verifyEmailUpdate(email, cleaned);
      }
      onSuccess();
    } catch (e: any) {
      setError('Invalid code');
    } finally {
      setSubmitting(false);
    }
  }

  const message = mode === 'signin'
    ? `If the mail address ${email} exists a one-time confirmation code has been sent.`
    : `A one-time confirmation code has been sent to ${email}.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Enter code</Text>
          <Text style={styles.message}>{message}</Text>

          <CodeEntry
            value={code}
            onChangeText={setCode}
            onSubmit={handleVerify}
            buttonLabel="Verify"
            submitting={submitting}
            error={error}
            autoCapitalize="none"
            keyboardType="number-pad"
          />

          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: blackBg(0.6),
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: navyBg(0.98),
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: parchmentBg(0.3),
    alignItems: 'center',
  },
  heading: {
    color: C.parchment,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    color: C.parchment,
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 24,
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 8,
  },
  cancelText: {
    color: C.parchment,
    opacity: 0.6,
    fontSize: 16,
  },
});

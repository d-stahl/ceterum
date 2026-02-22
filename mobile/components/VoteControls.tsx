import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';

type Resolution = {
  key: string;
  title: string;
  description: string;
};

type Props = {
  resolutions: Resolution[];
  forcedResolutionKey: string | null;  // Senate Leader is forced to vote for their declaration
  currentInfluence: number;
  senateLeaderDeclaration: string | null;
  onSubmit: (resolutionKey: string, influenceSpent: number) => Promise<void>;
};

export default function VoteControls({
  resolutions,
  forcedResolutionKey,
  currentInfluence,
  senateLeaderDeclaration,
  onSubmit,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(
    forcedResolutionKey ?? senateLeaderDeclaration ?? resolutions[0]?.key ?? ''
  );
  const [influenceInput, setInfluenceInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const influenceSpent = Math.min(Math.max(0, parseInt(influenceInput, 10) || 0), currentInfluence);

  async function handleSubmit() {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(selectedKey, influenceSpent);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.submittedContainer}>
        <ActivityIndicator color="#c9a84c" size="small" />
        <Text style={styles.submittedText}>Vote submitted — waiting for others…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Cast Your Vote</Text>

      <Text style={styles.influenceLabel}>
        Influence available: <Text style={styles.influenceValue}>{currentInfluence}</Text>
      </Text>

      {/* Resolution selection */}
      <View style={styles.resolutionList}>
        {resolutions.map((r) => {
          const isForced = forcedResolutionKey !== null && r.key !== forcedResolutionKey;
          const isSelected = selectedKey === r.key;
          const isSLDeclaration = r.key === senateLeaderDeclaration;

          return (
            <Pressable
              key={r.key}
              style={[
                styles.resolutionOption,
                isSelected && styles.resolutionOptionSelected,
                isForced && styles.resolutionOptionDisabled,
              ]}
              onPress={() => !isForced && setSelectedKey(r.key)}
              disabled={isForced}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]} />
              <View style={styles.resolutionInfo}>
                <View style={styles.resolutionTitleRow}>
                  <Text style={[styles.resolutionTitle, isForced && { opacity: 0.35 }]}>
                    {r.title}
                  </Text>
                  {isSLDeclaration && (
                    <View style={styles.slBadge}>
                      <Text style={styles.slBadgeText}>Senate Leader</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Influence slider / input */}
      <View style={styles.influenceSection}>
        <Text style={styles.influenceSpendLabel}>
          Influence to spend: <Text style={styles.influenceValue}>{influenceSpent}</Text>
        </Text>
        <View style={styles.influenceInputRow}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setInfluenceInput(String(Math.max(0, influenceSpent - 1)))}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <TextInput
            style={styles.influenceInput}
            value={influenceInput}
            onChangeText={setInfluenceInput}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Pressable
            style={styles.stepButton}
            onPress={() => setInfluenceInput(String(Math.min(currentInfluence, influenceSpent + 1)))}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.abstainNote}>Spending 0 influence counts as an abstain</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#1a1209" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Vote</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingVertical: 12 },
  sectionTitle: {
    color: '#c9a84c',
    fontSize: 16,
    fontWeight: '700',
  },
  influenceLabel: {
    color: '#e8d5a3',
    fontSize: 13,
    opacity: 0.7,
  },
  influenceValue: {
    color: '#c9a84c',
    fontWeight: '700',
  },
  resolutionList: { gap: 8 },
  resolutionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  resolutionOptionSelected: {
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderColor: '#c9a84c',
  },
  resolutionOptionDisabled: {
    opacity: 0.35,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.5)',
  },
  radioSelected: {
    backgroundColor: '#c9a84c',
    borderColor: '#c9a84c',
  },
  resolutionInfo: { flex: 1 },
  resolutionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resolutionTitle: {
    color: '#e8d5a3',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  slBadge: {
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slBadgeText: {
    color: '#c9a84c',
    fontSize: 10,
    fontWeight: '700',
  },
  influenceSection: { gap: 6 },
  influenceSpendLabel: { color: '#e8d5a3', fontSize: 13 },
  influenceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    color: '#c9a84c',
    fontSize: 20,
    lineHeight: 24,
  },
  influenceInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 8,
    color: '#e8d5a3',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    width: 70,
    height: 36,
    paddingVertical: 0,
  },
  abstainNote: {
    color: '#e8d5a3',
    fontSize: 11,
    opacity: 0.45,
  },
  submitButton: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: '#1a1209',
    fontSize: 16,
    fontWeight: '700',
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  submittedText: {
    color: '#c9a84c',
    fontSize: 14,
    opacity: 0.8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
});

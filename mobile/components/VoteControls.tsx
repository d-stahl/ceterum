import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { C, goldBg, whiteBg } from '../lib/theme';
import { AxisEffectSlider, PowerEffectRow, getFactionStances } from './ControversyCard';
import { PlayerAgendaInfo } from './AgendaDots';

type Resolution = {
  key: string;
  title: string;
  description: string;
  axisEffects: Partial<Record<string, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
};

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
  preferences: Record<string, number>;
};

type Props = {
  resolutions: Resolution[];
  forcedResolutionKey: string | null;  // Senate Leader is forced to vote for their declaration
  currentInfluence: number;
  senateLeaderDeclaration: string | null;
  activeFactionKeys: string[];
  factionInfoMap: Record<string, FactionInfo>;
  axisValues?: Record<string, number>;
  playerAgendas?: PlayerAgendaInfo[];
  onSubmit: (resolutionKey: string, influenceSpent: number) => Promise<void>;
};

export default function VoteControls({
  resolutions,
  forcedResolutionKey,
  currentInfluence,
  senateLeaderDeclaration,
  activeFactionKeys,
  factionInfoMap,
  axisValues,
  playerAgendas,
  onSubmit,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(
    forcedResolutionKey ?? senateLeaderDeclaration ?? resolutions[0]?.key ?? ''
  );
  const [influenceInput, setInfluenceInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedInfluence = parseInt(influenceInput, 10);
  const isValidInfluence = influenceInput.trim() !== '' && !isNaN(parsedInfluence) && parsedInfluence >= 0 && parsedInfluence <= currentInfluence;
  const influenceSpent = isValidInfluence ? parsedInfluence : 0;

  async function handleSubmit() {
    if (submitting || submitted || !isValidInfluence) return;
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
        <ActivityIndicator color={C.gold} size="small" />
        <Text style={styles.submittedText}>Vote submitted — waiting for others…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Cast Your Vote</Text>

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

                {(() => {
                  const axisKeys = Object.keys(r.axisEffects);
                  const factionKeys = Object.keys(r.factionPowerEffects).filter((k) =>
                    activeFactionKeys.includes(k)
                  );
                  const stances = getFactionStances(r.axisEffects, activeFactionKeys, factionInfoMap, axisValues);
                  const hasStances = stances.some((s) => s.stance !== 'neutral');
                  if (axisKeys.length === 0 && factionKeys.length === 0 && !hasStances) return null;
                  return (
                    <View style={styles.effectsBlock}>
                      {axisKeys.length > 0 && (
                        <View style={styles.effectsSection}>
                          <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                          {axisKeys.map((axis) => {
                            const change = r.axisEffects[axis] ?? 0;
                            const currentVal = axisValues?.[axis] ?? 0;
                            return (
                              <AxisEffectSlider
                                key={axis}
                                axis={axis}
                                change={change}
                                currentValue={currentVal}
                                playerAgendas={playerAgendas}
                              />
                            );
                          })}
                        </View>
                      )}
                      {factionKeys.length > 0 && (
                        <View style={styles.effectsSection}>
                          <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                          {factionKeys.map((fkey) => {
                            const change = r.factionPowerEffects[fkey] ?? 0;
                            const info = factionInfoMap?.[fkey];
                            return (
                              <PowerEffectRow
                                key={fkey}
                                factionName={info?.displayName ?? fkey}
                                currentPower={info?.power ?? 3}
                                change={change}
                              />
                            );
                          })}
                        </View>
                      )}
                      {hasStances && (
                        <View style={styles.effectsSection}>
                          <Text style={styles.effectsSectionLabel}>Faction Reactions</Text>
                          {stances.map(({ key: fkey, stance }) => (
                            <View key={fkey} style={styles.stanceRow}>
                              <Text style={styles.stanceFactionName}>
                                {factionInfoMap?.[fkey]?.displayName ?? fkey}
                              </Text>
                              <Text style={[
                                styles.stanceLabel,
                                stance === 'opposed' && styles.stanceOpposed,
                                stance === 'in_favor' && styles.stanceInFavor,
                              ]}>
                                {stance === 'opposed' ? 'Opposed' : stance === 'in_favor' ? 'In Favor' : 'Neutral'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Influence slider / input */}
      <View style={styles.influenceSection}>
        <Text style={styles.influenceSpendLabel}>
          Influence to spend: <Text style={styles.influenceValue}>{influenceSpent}/{currentInfluence}</Text>
        </Text>
        <View style={styles.influenceInputRow}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setInfluenceInput(String(Math.max(0, influenceSpent - 1)))}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <TextInput
            style={[styles.influenceInput, !isValidInfluence && styles.influenceInputInvalid]}
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
        style={[styles.submitButton, (submitting || !isValidInfluence) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !isValidInfluence}
      >
        {submitting ? (
          <ActivityIndicator color={C.darkText} size="small" />
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
    color: C.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  influenceLabel: {
    color: C.paleGold,
    fontSize: 13,
    opacity: 0.7,
  },
  influenceValue: {
    color: C.gold,
    fontWeight: '700',
  },
  resolutionList: { gap: 8 },
  resolutionOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: goldBg(0.06),
    borderWidth: 1,
    borderColor: goldBg(0.2),
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  resolutionOptionSelected: {
    backgroundColor: goldBg(0.18),
    borderColor: C.gold,
  },
  resolutionOptionDisabled: {
    opacity: 0.35,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: goldBg(0.5),
    marginTop: 2,
  },
  radioSelected: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  resolutionInfo: { flex: 1, gap: 8 },
  resolutionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resolutionTitle: {
    color: C.paleGold,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  slBadge: {
    backgroundColor: goldBg(0.2),
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slBadgeText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
  },
  influenceSection: { gap: 6 },
  influenceSpendLabel: { color: C.paleGold, fontSize: 13 },
  influenceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    backgroundColor: goldBg(0.15),
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    color: C.gold,
    fontSize: 20,
    lineHeight: 24,
  },
  influenceInput: {
    backgroundColor: whiteBg(0.06),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 8,
    color: C.paleGold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    width: 70,
    height: 36,
    paddingVertical: 0,
  },
  influenceInputInvalid: {
    borderColor: C.negative,
  },
  abstainNote: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.45,
  },
  submitButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: C.darkText,
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
    color: C.gold,
    fontSize: 14,
    opacity: 0.8,
  },
  effectsBlock: {
    gap: 8,
    marginTop: 2,
  },
  effectsSection: {
    gap: 6,
  },
  effectsSectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  stanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stanceFactionName: {
    color: C.paleGold,
    fontSize: 12,
    flex: 1,
  },
  stanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
    color: C.paleGold,
  },
  stanceOpposed: {
    color: C.negative,
    opacity: 1,
  },
  stanceInFavor: {
    color: C.positive,
    opacity: 1,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
});

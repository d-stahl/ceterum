import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { declareControversyOpen, submitClashAction } from '../lib/game-actions';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import type { ClashControversy } from '../lib/game-engine/controversies';
import { bidStrength } from '../lib/game-engine/clash';
import { AxisEffectSlider, PowerEffectRow } from './ControversyCard';
import ControversyHeader from './ControversyHeader';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg, whiteBg, navyBg, CONTROVERSY_TYPE_COLORS } from '../lib/theme';

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
  preferences: Record<string, number>;
};

type Props = {
  gameId: string;
  roundId: string;
  controversyKey: string;
  currentUserId: string;
  senateLeaderId: string;
  currentInfluence: number;
  players: PlayerInfo[];
  activeFactionKeys: string[];
  factionInfoMap: Record<string, FactionInfo>;
  axisValues?: Record<string, number>;
  playerAffinities?: Record<string, number>; // current user's affinities: factionKey -> affinity
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
};

export default function ClashVoting({
  gameId,
  roundId,
  controversyKey,
  currentUserId,
  senateLeaderId,
  currentInfluence,
  players,
  activeFactionKeys,
  factionInfoMap,
  axisValues,
  playerAffinities,
  onContinue,
}: Props) {
  const [csState, setCsState] = useState<ControversyStateRow | null>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [bids, setBids] = useState<Record<string, string>>({});
  const [commits, setCommits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSL = currentUserId === senateLeaderId;
  const controversy = CONTROVERSY_MAP[controversyKey] as ClashControversy | undefined;

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('status')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey)
      .single();
    if (data) setCsState(data as ControversyStateRow);
    setLoading(false);
  }, [roundId, controversyKey]);

  const fetchOutcome = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_outcomes')
      .select('type_data, axis_outcomes, faction_power_outcomes, affinity_outcomes')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey)
      .single();
    if (data) setOutcome(data);
  }, [roundId, controversyKey]);

  useEffect(() => {
    fetchState();
    const sub = supabase
      .channel(`cs-clash-${roundId}-${controversyKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_controversy_state',
        filter: `round_id=eq.${roundId}`,
      }, () => fetchState())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchState, roundId, controversyKey]);

  useEffect(() => {
    if (csState?.status === 'resolved') {
      fetchOutcome();
    }
  }, [csState?.status, fetchOutcome]);

  if (!controversy || controversy.type !== 'clash') {
    return <Text style={styles.errorText}>Unknown clash: {controversyKey}</Text>;
  }

  const config = controversy.clashConfig;
  const pe = config.personalEffects ?? null;
  const amplifiedFactions = activeFactionKeys.map((fkey) => ({
    key: fkey,
    name: factionInfoMap?.[fkey]?.displayName ?? fkey,
    basePower: factionInfoMap?.[fkey]?.power ?? 3,
    amplifier: config.factionAmplifiers[fkey] ?? 1,
    amplifiedPower: (factionInfoMap?.[fkey]?.power ?? 3) * (config.factionAmplifiers[fkey] ?? 1),
  }));

  // Parse bids
  const parsedBids: Record<string, number> = {};
  let totalBid = 0;
  for (const fkey of activeFactionKeys) {
    const v = parseInt(bids[fkey] ?? '0', 10);
    parsedBids[fkey] = isNaN(v) || v < 0 ? 0 : v;
    totalBid += parsedBids[fkey];
  }
  const bidValid = totalBid <= currentInfluence;

  async function handleDeclareOpen() {
    if (declaring) return;
    setDeclaring(true);
    setError(null);
    try {
      await declareControversyOpen(gameId, controversyKey);
    } catch (e: any) {
      setError(e.message ?? 'Failed to open clash');
    } finally {
      setDeclaring(false);
    }
  }

  async function handleSubmit() {
    if (submitting || submitted || !bidValid) return;
    setSubmitting(true);
    setError(null);
    try {
      // SL is forced to commit
      await submitClashAction(gameId, controversyKey, parsedBids, isSL ? true : commits);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  const status = csState?.status ?? 'declared';

  // --- RESOLVED ---
  if (status === 'resolved' && outcome) {
    const td = outcome.type_data;
    const succeeded = td.succeeded;

    const axisEffects: Record<string, number> = {};
    const outcomeAxisValues: Record<string, number> = {};
    for (const [axis, vals] of Object.entries(outcome.axis_outcomes as Record<string, { before: number; after: number }>)) {
      axisEffects[axis] = vals.after - vals.before;
      outcomeAxisValues[axis] = vals.before;
    }

    const factionEffects: Record<string, number> = {};
    const factionPowerBefore: Record<string, number> = {};
    for (const [fkey, vals] of Object.entries(outcome.faction_power_outcomes as Record<string, { before: number; after: number }>)) {
      factionEffects[fkey] = vals.after - vals.before;
      factionPowerBefore[fkey] = vals.before;
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} showFlavor={false} />

        <View style={[styles.resultBanner, succeeded ? styles.resultSuccess : styles.resultFailure]}>
          <Text style={styles.resultLabel}>
            {succeeded ? 'Rome Prevails' : 'Rome Falters'}
          </Text>
          <Text style={styles.resultCommitted}>{td.committedPower} power committed</Text>
          {td.withdrawnPower > 0 && (
            <Text style={styles.resultWithdrawn}>{td.withdrawnPower} power withdrawn</Text>
          )}
          <Text style={styles.resultThreshold}>Threshold: {td.threshold}</Text>
        </View>

        {/* Per-faction breakdown */}
        {td.factionAssignments && (
          <View style={styles.section}>
            {td.factionAssignments.filter((fa: any) => fa.winners.length > 0).map((fa: any) => {
              const winner = fa.winners[0];
              const player = players.find((p) => p.player_id === winner?.playerId);
              const isCommitter = (td.committers ?? []).includes(winner?.playerId);
              const factionPower = fa.amplifiedPower ?? fa.power ?? 0;
              return (
                <View key={fa.factionKey} style={styles.factionResultRow}>
                  <Text style={styles.factionResultName}>
                    {factionInfoMap?.[fa.factionKey]?.displayName ?? fa.factionKey}
                  </Text>
                  <View style={styles.factionResultDetail}>
                    <View style={styles.winnerChip}>
                      <View style={[styles.playerDot, { backgroundColor: getColorHex(player?.color ?? '') }]} />
                      <Text style={styles.winnerName}>{player?.player_name ?? 'Unknown'}</Text>
                    </View>
                    <Text style={[
                      styles.factionPowerContrib,
                      isCommitter ? styles.powerContribCommit : styles.powerContribWithdraw,
                    ]}>
                      {factionPower} power {isCommitter ? 'contributed' : 'withheld'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Effects */}
        {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).length > 0 && (
          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Policy Effects</Text>
            {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).map((axis) => (
              <AxisEffectSlider
                key={axis}
                axis={axis}
                change={axisEffects[axis]}
                currentValue={outcomeAxisValues[axis]}
              />
            ))}
          </View>
        )}

        {Object.keys(factionEffects).filter((k) => activeFactionKeys.includes(k) && factionEffects[k] !== 0).length > 0 && (
          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Power Effects</Text>
            {Object.keys(factionEffects).filter((k) => activeFactionKeys.includes(k) && factionEffects[k] !== 0).map((fkey) => (
              <PowerEffectRow
                key={fkey}
                factionName={factionInfoMap?.[fkey]?.displayName ?? fkey}
                currentPower={factionPowerBefore[fkey] ?? (factionInfoMap?.[fkey]?.power ?? 3)}
                change={factionEffects[fkey] ?? 0}
              />
            ))}
          </View>
        )}

        {/* Personal effects per player */}
        {td.personalEffects && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Player Outcomes</Text>
            {players.map((p) => {
              const eff = td.personalEffects?.[p.player_id];
              if (!eff) return null;
              const committed = eff.committed;
              const parts: string[] = [];
              if (eff.vpAwarded > 0) parts.push(`+${eff.vpAwarded} VP`);
              if (eff.influenceLoss > 0) parts.push(`−${eff.influenceLoss} influence`);
              if (eff.affinityDelta !== 0 && eff.wonFactions.length > 0) {
                const sign = eff.affinityDelta > 0 ? '+' : '';
                const fNames = eff.wonFactions.map((fk: string) => factionInfoMap?.[fk]?.displayName ?? fk).join(', ');
                parts.push(`Affinity ${sign}${eff.affinityDelta} with ${fNames}`);
              }
              return (
                <View key={p.player_id} style={styles.personalEffectRow}>
                  <View style={styles.personalEffectHeader}>
                    <View style={[styles.playerDot, { backgroundColor: getColorHex(p.color) }]} />
                    <Text style={styles.personalEffectName}>{p.player_name}</Text>
                    <Text style={[
                      styles.personalEffectChoice,
                      committed ? styles.powerContribCommit : styles.powerContribWithdraw,
                    ]}>
                      {committed ? 'Committed' : 'Withdrew'}
                    </Text>
                  </View>
                  {parts.length > 0 ? (
                    parts.map((part, i) => (
                      <Text key={i} style={styles.personalEffectDetail}>{part}</Text>
                    ))
                  ) : (
                    <Text style={styles.personalEffectDetail}>No effect</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- DECLARED: SL opens the clash ---
  if (status === 'declared' && isSL) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} />
        <Text style={styles.instruction}>
          As Senate Leader, open this Clash for all players to bid on factions.
        </Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable
          style={[styles.declareButton, declaring && { opacity: 0.4 }]}
          onPress={handleDeclareOpen}
          disabled={declaring}
        >
          {declaring ? (
            <ActivityIndicator color={C.darkText} size="small" />
          ) : (
            <Text style={styles.declareButtonText}>Open Clash</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  if (status === 'declared' && !isSL) {
    const slPlayer = players.find((p) => p.player_id === senateLeaderId);
    return (
      <View style={styles.centerContainer}>
        <ControversyHeader controversy={controversy} />
        <View style={styles.waitRow}>
          <Text style={styles.waitText}>Waiting for </Text>
          {slPlayer && <View style={[styles.playerDot, { backgroundColor: getColorHex(slPlayer.color) }]} />}
          <Text style={styles.waitTextBold}>{slPlayer?.player_name ?? 'Senate Leader'}</Text>
          <Text style={styles.waitText}> to open…</Text>
        </View>
      </View>
    );
  }

  // --- SUBMITTED (waiting) ---
  if (submitted) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={C.gold} size="small" />
        <Text style={styles.waitingText}>Action submitted — waiting for others…</Text>
      </View>
    );
  }

  // --- VOTING: Bid on factions + commit/withdraw ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ControversyHeader controversy={controversy} />

      {/* Threshold info */}
      <View style={styles.thresholdBanner}>
        <Text style={styles.thresholdLabel}>
          Threshold: {Math.round(amplifiedFactions.reduce((s, f) => s + f.amplifiedPower, 0) * config.thresholdPercent)} power
        </Text>
        <Text style={styles.thresholdNote}>
          {Math.round(config.thresholdPercent * 100)}% of {amplifiedFactions.reduce((s, f) => s + f.amplifiedPower, 0)} total faction power
        </Text>
      </View>

      {/* Faction bid cards */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Bid for Factions</Text>
        <Text style={styles.sectionNote}>
          Influence spent: {totalBid} / {currentInfluence}
        </Text>

        {amplifiedFactions.map((f) => {
          const affinity = playerAffinities?.[f.key] ?? 0;
          const bidVal = parsedBids[f.key];
          const strength = bidStrength(bidVal, affinity);
          const isAmplified = f.amplifier > 1;
          const atLimit = totalBid >= currentInfluence;

          return (
            <View key={f.key} style={styles.factionBidCard}>
              <View style={styles.factionBidHeader}>
                <Text style={styles.factionBidName}>{f.name}</Text>
                <View style={styles.factionBidMeta}>
                  <Text style={styles.factionPowerLabel}>
                    Power: {f.amplifiedPower}
                    {isAmplified && <Text style={styles.amplifierText}> ({f.amplifier}x)</Text>}
                  </Text>
                </View>
              </View>

              <View style={styles.bidInputRow}>
                <Pressable
                  style={[styles.stepButton, bidVal <= 0 && styles.stepButtonDisabled]}
                  onPress={() => setBids((prev) => ({
                    ...prev,
                    [f.key]: String(Math.max(0, (parsedBids[f.key] ?? 0) - 1)),
                  }))}
                  disabled={bidVal <= 0}
                >
                  <Text style={[styles.stepButtonText, bidVal <= 0 && styles.stepButtonTextDisabled]}>−</Text>
                </Pressable>
                <TextInput
                  style={[styles.bidInput, !bidValid && bidVal > 0 && styles.bidInputOverspend]}
                  value={bids[f.key] ?? '0'}
                  onChangeText={(t) => setBids((prev) => ({ ...prev, [f.key]: t }))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Pressable
                  style={[styles.stepButton, atLimit && styles.stepButtonDisabled]}
                  onPress={() => {
                    if (atLimit) return;
                    setBids((prev) => ({
                      ...prev,
                      [f.key]: String((parsedBids[f.key] ?? 0) + 1),
                    }));
                  }}
                  disabled={atLimit}
                >
                  <Text style={[styles.stepButtonText, atLimit && styles.stepButtonTextDisabled]}>+</Text>
                </Pressable>

                {bidVal > 0 && (
                  <Text style={styles.strengthPreview}>
                    Strength: {Math.round(strength * 10) / 10}
                    {affinity !== 0 && (
                      <Text style={{ color: affinity > 0 ? C.positive : C.negative }}>
                        {' '}({affinity > 0 ? '+' : ''}{Math.round(affinity * 10)}% aff.)
                      </Text>
                    )}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {!bidValid && (
          <Text style={styles.errorText}>Total bids ({totalBid}) exceed available influence ({currentInfluence})</Text>
        )}
      </View>

      {/* Commit / Withdraw with consequences */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your Decision</Text>
        <View style={styles.commitToggle}>
          <Pressable
            style={[styles.quadrantBox, commits && styles.quadrantBoxCommitActive]}
            onPress={() => setCommits(true)}
            disabled={isSL}
          >
            <Text style={[styles.quadrantTitle, commits && styles.quadrantTitleActive]}>
              {isSL ? '■ COMMIT (Required)' : '■ COMMIT'}
            </Text>
            {pe ? (
              <>
                <Text style={styles.quadrantSubhead}>On Success</Text>
                <Text style={styles.quadrantEffect}>+{config.successOutcome.victoryPoints} VP</Text>
                {pe.commitSuccess.affinityBonus !== 0 && (
                  <Text style={styles.quadrantEffect}>Affinity +{pe.commitSuccess.affinityBonus} with your factions</Text>
                )}
                <View style={styles.quadrantDivider} />
                <Text style={styles.quadrantSubhead}>On Failure</Text>
                {pe.commitFailure.influenceLoss > 0 && (
                  <Text style={styles.quadrantEffectBad}>−{pe.commitFailure.influenceLoss} influence</Text>
                )}
                {pe.commitFailure.affinityPenalty !== 0 && (
                  <Text style={styles.quadrantEffectBad}>Affinity {pe.commitFailure.affinityPenalty} with your factions</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.quadrantSubhead}>On Success</Text>
                <Text style={styles.quadrantEffect}>+{config.successOutcome.victoryPoints} VP</Text>
                <View style={styles.quadrantDivider} />
                <Text style={styles.quadrantSubhead}>On Failure</Text>
                <Text style={styles.quadrantEffectNeutral}>No VP</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.quadrantBox, !commits && styles.quadrantBoxWithdrawActive, isSL && styles.quadrantBoxDisabled]}
            onPress={() => setCommits(false)}
            disabled={isSL}
          >
            <Text style={[styles.quadrantTitle, !commits && styles.quadrantTitleActive, isSL && { opacity: 0.3 }]}>
              WITHDRAW
            </Text>
            {pe ? (
              <>
                <Text style={styles.quadrantSubhead}>On Success</Text>
                <Text style={styles.quadrantEffectBad}>No VP</Text>
                {pe.withdrawSuccess.affinityPenalty !== 0 && (
                  <Text style={styles.quadrantEffectBad}>Affinity {pe.withdrawSuccess.affinityPenalty} with your factions</Text>
                )}
                <View style={styles.quadrantDivider} />
                <Text style={styles.quadrantSubhead}>On Failure</Text>
                <Text style={styles.quadrantEffectNeutral}>No effect</Text>
              </>
            ) : (
              <>
                <Text style={styles.quadrantSubhead}>On Success</Text>
                <Text style={styles.quadrantEffectNeutral}>No VP</Text>
                <View style={styles.quadrantDivider} />
                <Text style={styles.quadrantSubhead}>On Failure</Text>
                <Text style={styles.quadrantEffectNeutral}>No effect</Text>
              </>
            )}
            {isSL && <Text style={styles.slDisabledNote}>Senate Leader must commit</Text>}
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.submitButton, (submitting || !bidValid) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !bidValid}
      >
        {submitting ? (
          <ActivityIndicator color={C.darkText} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>
            {commits || isSL ? 'Commit & Submit' : 'Withdraw & Submit'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const clashColor = CONTROVERSY_TYPE_COLORS.clash;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 24,
  },
  instruction: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
  },
  thresholdBanner: {
    backgroundColor: clashColor + '18',
    borderWidth: 1,
    borderColor: clashColor + '50',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  thresholdLabel: {
    color: clashColor,
    fontSize: 12,
    fontWeight: '700',
  },
  thresholdNote: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'center',
  },
  section: { gap: 8 },
  sectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  sectionNote: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.6,
  },
  factionBidCard: {
    backgroundColor: navyBg(0.88),
    borderWidth: 1,
    borderColor: goldBg(0.25),
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  factionBidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factionBidName: {
    color: C.paleGold,
    fontSize: 14,
    fontWeight: '600',
  },
  factionBidMeta: { flexDirection: 'row', gap: 8 },
  factionPowerLabel: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.6,
  },
  amplifierText: {
    color: clashColor,
    fontWeight: '700',
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 32,
    height: 32,
    backgroundColor: goldBg(0.15),
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.3,
  },
  stepButtonText: {
    color: C.gold,
    fontSize: 18,
    lineHeight: 22,
  },
  stepButtonTextDisabled: {
    opacity: 0.4,
  },
  bidInput: {
    backgroundColor: whiteBg(0.06),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 6,
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    width: 56,
    height: 32,
    paddingVertical: 0,
  },
  bidInputOverspend: {
    borderColor: C.error,
    borderWidth: 2,
  },
  strengthPreview: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.7,
    marginLeft: 4,
    flex: 1,
  },
  commitToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  quadrantBox: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: goldBg(0.25),
    backgroundColor: navyBg(0.5),
  },
  quadrantBoxCommitActive: {
    backgroundColor: C.positive + '18',
    borderColor: C.positive + '50',
    borderWidth: 2,
  },
  quadrantBoxWithdrawActive: {
    backgroundColor: C.negative + '18',
    borderColor: C.negative + '50',
    borderWidth: 2,
  },
  quadrantBoxDisabled: {
    opacity: 0.35,
  },
  quadrantTitle: {
    color: C.paleGold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.5,
    marginBottom: 4,
  },
  quadrantTitleActive: {
    opacity: 1,
    color: C.gold,
  },
  quadrantSubhead: {
    color: C.paleGold,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    opacity: 0.5,
    marginTop: 2,
  },
  quadrantEffect: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  quadrantEffectBad: {
    color: C.negative,
    fontSize: 12,
    fontWeight: '600',
  },
  quadrantEffectNeutral: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.5,
  },
  quadrantDivider: {
    height: 1,
    backgroundColor: goldBg(0.15),
    marginVertical: 4,
  },
  slDisabledNote: {
    color: C.paleGold,
    fontSize: 10,
    opacity: 0.5,
    fontStyle: 'italic',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  declareButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declareButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  waitingText: {
    color: C.gold,
    fontSize: 14,
    opacity: 0.8,
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  waitText: { color: C.gold, fontSize: 14, opacity: 0.7 },
  waitTextBold: { color: C.gold, fontSize: 14, fontWeight: '700', opacity: 0.7 },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  // Resolved
  resultBanner: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: C.positive + '18',
    borderColor: C.positive + '50',
  },
  resultFailure: {
    backgroundColor: C.negative + '18',
    borderColor: C.negative + '50',
  },
  resultLabel: {
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
  },
  resultCommitted: {
    color: C.positive,
    fontSize: 13,
    fontWeight: '600',
  },
  resultWithdrawn: {
    color: C.negative,
    fontSize: 13,
    fontWeight: '600',
  },
  resultThreshold: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.7,
  },
  factionResultRow: {
    backgroundColor: goldBg(0.06),
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  factionResultName: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  factionResultDetail: {
    gap: 2,
    paddingLeft: 4,
  },
  winnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  winnerName: {
    color: C.paleGold,
    fontSize: 12,
  },
  factionPowerContrib: {
    fontSize: 11,
    fontWeight: '600',
    paddingLeft: 16,
  },
  powerContribCommit: {
    color: C.positive,
  },
  powerContribWithdraw: {
    color: C.negative,
  },
  effectsSection: { gap: 6, marginTop: 4 },
  continueButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
  personalEffectRow: {
    backgroundColor: navyBg(0.5),
    borderRadius: 8,
    padding: 10,
    gap: 3,
    marginBottom: 6,
  },
  personalEffectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  personalEffectName: {
    color: C.paleGold,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  personalEffectChoice: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personalEffectDetail: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.8,
    paddingLeft: 18,
  },
});

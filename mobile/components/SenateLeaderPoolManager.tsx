import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useState } from 'react';
import { Controversy, CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import { submitSenateLeaderActions } from '../lib/game-actions';
import ControversyCard from './ControversyCard';
import { PlayerAgendaInfo } from './AgendaDots';

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type Props = {
  gameId: string;
  poolKeys: string[];
  activeFactionKeys: string[];
  isSenateLeader: boolean;
  axisValues?: Record<string, number>;
  factionInfoMap?: Record<string, FactionInfo>;
  playerAgendas?: PlayerAgendaInfo[];
};

type Step = 'discard' | 'order' | 'submitting' | 'done';

export default function SenateLeaderPoolManager({
  gameId,
  poolKeys,
  activeFactionKeys,
  isSenateLeader,
  axisValues,
  factionInfoMap,
  playerAgendas,
}: Props) {
  const [step, setStep] = useState<Step>('discard');
  const [discardedKey, setDiscardedKey] = useState<string | null>(null);
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const controversies = poolKeys.map((k) => CONTROVERSY_MAP[k]).filter(Boolean);
  const remainingKeys = poolKeys.filter((k) => k !== discardedKey);

  function handleDiscard(key: string) {
    setDiscardedKey(key);
    setOrderedKeys(poolKeys.filter((k) => k !== key));
    setStep('order');
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...orderedKeys];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setOrderedKeys(next);
  }

  function moveDown(index: number) {
    if (index === orderedKeys.length - 1) return;
    const next = [...orderedKeys];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setOrderedKeys(next);
  }

  async function handleConfirm() {
    if (!discardedKey || orderedKeys.length !== 3) return;
    setStep('submitting');
    setError(null);
    try {
      await submitSenateLeaderActions(gameId, discardedKey, orderedKeys);
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'Submission failed');
      setStep('order');
    }
  }

  if (!isSenateLeader) {
    return (
      <View style={styles.waitContainer}>
        <ActivityIndicator color="#c9a84c" size="large" />
        <Text style={styles.waitTitle}>Awaiting the Senate Leader</Text>
        <Text style={styles.waitBody}>
          The Senate Leader is reviewing the controversy pool and will select which matters
          to debate this round.
        </Text>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={styles.waitContainer}>
        <Text style={styles.waitTitle}>Order Submitted</Text>
        <Text style={styles.waitBody}>The controversies are being prepared for debate.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manage the Controversy Pool</Text>
      <Text style={styles.senateLeaderBadge}>You are the Senate Leader</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {step === 'discard' && (
        <>
          <Text style={styles.instruction}>
            Select one controversy to discard. The Senate will debate the remaining three,
            but only the top two you order will come to a vote this round.
          </Text>
          <View style={styles.cards}>
            {controversies.map((c) => (
              <View key={c.key}>
                <ControversyCard
                  controversy={c}
                  activeFactionKeys={activeFactionKeys}
                  axisValues={axisValues}
                  factionInfoMap={factionInfoMap}
                  playerAgendas={playerAgendas}
                />
                <Pressable style={styles.discardButton} onPress={() => handleDiscard(c.key)}>
                  <Text style={styles.discardButtonText}>Discard This</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {step === 'order' && (
        <>
          <Text style={styles.instruction}>
            Order the remaining three controversies. The top two will be voted on this round.
            The third will carry over to the next round.
          </Text>

          <View style={styles.orderList}>
            {orderedKeys.map((key, index) => {
              const c = CONTROVERSY_MAP[key];
              if (!c) return null;
              const isLeftover = index === 2;
              return (
                <View key={key} style={[styles.orderItem, isLeftover && styles.orderItemLeftover]}>
                  <View style={styles.orderRank}>
                    <Text style={styles.orderRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle}>{c.title}</Text>
                    {isLeftover && (
                      <Text style={styles.leftoverNote}>Carries over to next round</Text>
                    )}
                  </View>
                  <View style={styles.orderControls}>
                    <Pressable
                      onPress={() => moveUp(index)}
                      style={[styles.arrowButton, index === 0 && styles.arrowDisabled]}
                      disabled={index === 0}
                    >
                      <Text style={styles.arrowText}>▲</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => moveDown(index)}
                      style={[styles.arrowButton, index === 2 && styles.arrowDisabled]}
                      disabled={index === 2}
                    >
                      <Text style={styles.arrowText}>▼</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Order</Text>
          </Pressable>

          <Pressable style={styles.backButton} onPress={() => setStep('discard')}>
            <Text style={styles.backButtonText}>← Change Discard</Text>
          </Pressable>
        </>
      )}

      {step === 'submitting' && (
        <View style={styles.waitContainer}>
          <ActivityIndicator color="#c9a84c" size="large" />
          <Text style={styles.waitBody}>Submitting your choices…</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  waitContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    color: '#c9a84c',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 4,
  },
  senateLeaderBadge: {
    color: '#e8d5a3',
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 12,
  },
  instruction: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  cards: { gap: 0 },
  discardButton: {
    backgroundColor: 'rgba(229,57,53,0.15)',
    borderWidth: 1,
    borderColor: '#e53935',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  discardButtonText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '700',
  },
  orderList: { gap: 10, marginBottom: 24 },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  orderItemLeftover: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  orderRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(201,168,76,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderRankText: {
    color: '#c9a84c',
    fontSize: 16,
    fontWeight: '700',
  },
  orderInfo: { flex: 1 },
  orderTitle: {
    color: '#e8d5a3',
    fontSize: 14,
    fontWeight: '600',
  },
  leftoverNote: {
    color: '#e8d5a3',
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  orderControls: { flexDirection: 'column', gap: 4 },
  arrowButton: {
    padding: 4,
    alignItems: 'center',
  },
  arrowDisabled: { opacity: 0.2 },
  arrowText: {
    color: '#c9a84c',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: '#1a1209',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.6,
  },
  waitTitle: {
    color: '#c9a84c',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  waitBody: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.65,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
});

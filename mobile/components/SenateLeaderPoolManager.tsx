import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image } from 'react-native';
import { useCallback, useState } from 'react';
import { Controversy, CONTROVERSY_MAP, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/game-engine/controversies';
import { submitSenateLeaderActions } from '../lib/game-actions';
import ControversyCard, { ILLUSTRATION_MAP } from './ControversyCard';
import { PlayerAgendaInfo } from './AgendaDots';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg } from '../lib/theme';

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
  senateLeaderName?: string;
  senateLeaderColor?: string;
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
  senateLeaderName,
  senateLeaderColor,
  axisValues,
  factionInfoMap,
  playerAgendas,
}: Props) {
  const [step, setStep] = useState<Step>('discard');
  const [discardedKey, setDiscardedKey] = useState<string | null>(null);
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const controversies = poolKeys.map((k) => CONTROVERSY_MAP[k]).filter(Boolean);

  function handleDiscard(key: string) {
    setDiscardedKey(key);
    setOrderedKeys(poolKeys.filter((k) => k !== key));
    setStep('order');
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

  const ITEM_HEIGHT = 76; // 64px card + 12px margin

  const renderOrderItem = useCallback(({ item, drag, isActive }: RenderItemParams<string>) => {
    const c = CONTROVERSY_MAP[item];
    if (!c) return null;
    const illustration = ILLUSTRATION_MAP[c.illustration];
    const catLabel = CATEGORY_LABELS[c.category] ?? c.category;
    const catColor = CATEGORY_COLORS[c.category] ?? '#888';

    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[styles.orderCard, isActive && styles.orderCardActive, { marginBottom: 12, marginLeft: 44 }]}
        >
          {illustration && (
            <Image source={illustration} style={styles.orderIllustration} resizeMode="cover" />
          )}
          <View style={styles.orderCardContent}>
            <Text style={styles.orderTitle} numberOfLines={2}>{c.title}</Text>
            <View style={[styles.categoryTag, { backgroundColor: catColor + '30', borderColor: catColor + '60' }]}>
              <Text style={[styles.categoryText, { color: catColor }]}>{catLabel}</Text>
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    );
  }, []);

  if (!isSenateLeader) {
    return (
      <View style={styles.waitContainer}>
        <Text style={styles.waitPhaseTitle}>Senate Leader Phase</Text>
        <View style={styles.waitRow}>
          <Text style={styles.waitBody}>Waiting for </Text>
          {senateLeaderColor && <View style={[styles.slDot, { backgroundColor: getColorHex(senateLeaderColor) }]} />}
          <Text style={styles.waitBodyBold}>{senateLeaderName ?? 'Senate Leader'}</Text>
          <Text style={styles.waitBody}> to discard &amp; order…</Text>
        </View>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={styles.waitContainer}>
        <Text style={styles.waitPhaseTitle}>Order Submitted</Text>
        <Text style={styles.waitBody}>The controversies are being prepared for debate.</Text>
      </View>
    );
  }

  if (step === 'order') {
    return (
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.orderHeader}>
          <Text style={styles.title}>Order the Controversies</Text>
          <Text style={styles.senateLeaderBadge}>You are the Senate Leader</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.instruction}>
            Set the order for the remaining three controversies. Two will be randomly chosen
            for debate this round, but they will be heard in the order you set.
          </Text>
          <Text style={styles.dragHint}>Long press and drag to reorder</Text>
        </View>
        <View style={styles.orderListContainer}>
          {/* Static slot numbers positioned on the left */}
          <View style={styles.slotNumberColumn} pointerEvents="none">
            {[1, 2, 3].map((n, i) => (
              <View key={n} style={[styles.slotNumber, { top: i * ITEM_HEIGHT + (64 - 32) / 2 }]}>
                <Text style={styles.slotNumberText}>{n}</Text>
              </View>
            ))}
          </View>
          <DraggableFlatList
          data={orderedKeys}
          onDragEnd={({ data }) => setOrderedKeys(data)}
          keyExtractor={(item) => item}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.orderListContent}
          ListFooterComponent={
            <View style={styles.orderFooter}>
              <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm Order</Text>
              </Pressable>
              <Pressable style={styles.backButton} onPress={() => setStep('discard')}>
                <Text style={styles.backButtonText}>← Change Discard</Text>
              </Pressable>
            </View>
          }
        />
        </View>
      </GestureHandlerRootView>
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
            Select one controversy to discard. Two of the remaining three will be randomly
            chosen for debate this round.
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

      {step === 'submitting' && (
        <View style={styles.waitContainer}>
          <ActivityIndicator color={C.gold} size="large" />
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
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 4,
  },
  senateLeaderBadge: {
    color: C.paleGold,
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 12,
  },
  instruction: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  dragHint: {
    color: C.gold,
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  cards: { gap: 0 },
  discardButton: {
    backgroundColor: 'rgba(229,57,53,0.15)',
    borderWidth: 1,
    borderColor: C.negative,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  discardButtonText: {
    color: C.negative,
    fontSize: 14,
    fontWeight: '700',
  },
  // Order step
  orderHeader: {
    padding: 20,
    paddingBottom: 8,
  },
  orderListContainer: {
    flex: 1,
    position: 'relative',
  },
  orderListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  slotNumberColumn: {
    position: 'absolute',
    left: 20,
    top: 0,
    zIndex: 10,
  },
  slotNumber: {
    position: 'absolute',
    left: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: goldBg(0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotNumberText: {
    color: C.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  orderCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: goldBg(0.08),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 10,
    overflow: 'hidden',
    gap: 12,
  },
  orderCardActive: {
    backgroundColor: goldBg(0.22),
    borderColor: C.gold,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  orderIllustration: {
    width: 64,
    height: 64,
  },
  orderCardContent: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    gap: 6,
  },
  orderTitle: {
    color: C.paleGold,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderFooter: {
    marginTop: 12,
  },
  confirmButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.6,
  },
  waitPhaseTitle: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 8,
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  waitBody: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.65,
    lineHeight: 20,
  },
  waitBodyBold: {
    color: C.paleGold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
});

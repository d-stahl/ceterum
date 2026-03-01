import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, Platform, PanResponder,
} from 'react-native';
import { useEffect, useRef, useMemo, useState } from 'react';
import { CONTROVERSY_MAP, Controversy } from '../lib/game-engine/controversies';
import ControversyCard from './ControversyCard';
import { C, goldBg, darkBrownBg } from '../lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type PlayerAgendaInfo = {
  playerId: string;
  name: string;
  color: string;
  agenda: Record<string, number>;
};

type Props = {
  poolKeys: string[];            // 4 controversy keys for this round
  activeFactionKeys: string[];   // factions in this game
  activeControversyKey?: string; // currently being voted on (highlighted)
  visible: boolean;
  onClose: () => void;
  axisValues?: Record<string, number>;
  factionInfoMap?: Record<string, FactionInfo>;
  playerAgendas?: PlayerAgendaInfo[];
};

export default function OnTheHorizon({
  poolKeys,
  activeFactionKeys,
  activeControversyKey,
  visible,
  onClose,
  axisValues,
  factionInfoMap,
  playerAgendas,
}: Props) {
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : PANEL_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && Math.abs(gs.dy) < Math.abs(gs.dx),
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) slideAnim.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 60 || gs.vx > 0.5) {
        Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 200, useNativeDriver: true }).start(() => onClose());
      } else {
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    },
  }), [onClose]);

  const controversies: Controversy[] = poolKeys
    .map((k) => CONTROVERSY_MAP[k])
    .filter(Boolean);

  return (
    <>
      {/* Tab trigger — always visible on right edge */}
      <Pressable style={styles.tabTrigger} onPress={onClose}>
        <Text style={styles.tabText}>O</Text>
        <Text style={styles.tabText}>N</Text>
        <Text style={styles.tabDot} />
        <Text style={styles.tabText}>T</Text>
        <Text style={styles.tabText}>H</Text>
        <Text style={styles.tabText}>E</Text>
        <Text style={styles.tabDot} />
        <Text style={styles.tabText}>H</Text>
        <Text style={styles.tabText}>O</Text>
        <Text style={styles.tabText}>R</Text>
        <Text style={styles.tabText}>I</Text>
        <Text style={styles.tabText}>Z</Text>
        <Text style={styles.tabText}>O</Text>
        <Text style={styles.tabText}>N</Text>
      </Pressable>

      {/* Backdrop */}
      {visible && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      )}

      {/* Slide-in panel */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents={visible ? 'box-none' : 'none'}
        {...panResponder.panHandlers}
      >
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>On the Horizon</Text>
            <Text style={styles.panelSubtitle}>Upcoming controversies</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {controversies.length === 0 ? (
            <Text style={styles.emptyText}>No controversies drawn yet.</Text>
          ) : (
            controversies.map((c) => (
              <ControversyCard
                key={c.key}
                controversy={c}
                activeFactionKeys={activeFactionKeys}
                isActive={c.key === activeControversyKey}
                axisValues={axisValues}
                factionInfoMap={factionInfoMap}
                playerAgendas={playerAgendas}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  tabTrigger: {
    position: 'absolute',
    right: -1,
    top: '25%',
    backgroundColor: goldBg(0.15),
    borderWidth: 1,
    borderColor: goldBg(0.4),
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  tabText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  tabDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: goldBg(0.4),
    marginVertical: 2,
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: darkBrownBg(0.97),
    borderLeftWidth: 1,
    borderLeftColor: goldBg(0.4),
    zIndex: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: goldBg(0.2),
  },
  panelTitle: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  panelSubtitle: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: C.paleGold,
    fontSize: 18,
    opacity: 0.6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  emptyText: {
    color: C.paleGold,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 40,
  },
});

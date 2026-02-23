import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { CONTROVERSY_MAP, Controversy } from '../lib/game-engine/controversies';
import ControversyCard from './ControversyCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type Props = {
  poolKeys: string[];            // 4 controversy keys for this round
  activeFactionKeys: string[];   // factions in this game
  activeControversyKey?: string; // currently being voted on (highlighted)
  visible: boolean;
  onClose: () => void;
  axisValues?: Record<string, number>;
  factionInfoMap?: Record<string, FactionInfo>;
};

export default function OnTheHorizon({
  poolKeys,
  activeFactionKeys,
  activeControversyKey,
  visible,
  onClose,
  axisValues,
  factionInfoMap,
}: Props) {
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : PANEL_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

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
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  tabText: {
    color: '#c9a84c',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  tabDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(201,168,76,0.4)',
    marginVertical: 2,
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(12,8,2,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(201,168,76,0.4)',
    zIndex: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.2)',
  },
  panelTitle: {
    color: '#c9a84c',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  panelSubtitle: {
    color: '#e8d5a3',
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: '#e8d5a3',
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
    color: '#e8d5a3',
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 40,
  },
});

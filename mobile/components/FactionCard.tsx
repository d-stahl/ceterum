import { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { getColorHex } from '../lib/player-colors';
import { getSenatorIcon } from '../lib/worker-icons';
import { useDrag, DropTarget } from './DragContext';
import ShineEffect from './ShineEffect';
import DraggableWorker from './DraggableWorker';
import FactionAffinityTab from './FactionAffinityTab';
import FactionAlignmentTab from './FactionAlignmentTab';
import { WorkerType, OratorRole } from '../lib/game-engine/workers';
import { AxisPreferences } from '../lib/game-engine/axes';
import Svg, { Polygon, Circle as SvgCircle } from 'react-native-svg';

// Stable array references to prevent useCallback/useEffect churn
const ACCEPTS_ORATOR: WorkerType[] = ['orator'];
const ACCEPTS_PROMOTER: WorkerType[] = ['promoter'];
const ACCEPTS_SABOTEUR: WorkerType[] = ['saboteur'];

export type FactionPlacement = {
  playerId: string;
  playerName: string;
  playerColor: string;
  workerType: string;
  oratorRole?: string;
  subRound: number;
  isPreliminary?: boolean;
};

type PlayerAffinityInfo = {
  playerId: string;
  playerName: string;
  playerColor: string;
  affinity: number;
};

type Props = {
  factionKey: string;
  displayName: string;
  powerLevel: number;
  placements: FactionPlacement[];
  expanded: boolean;
  onToggle: () => void;
  currentPlayerId: string;
  playerColor: string;
  allPlayerAffinities?: PlayerAffinityInfo[];
  factionPreferences?: AxisPreferences | null;
  onDragStart?: (workerType: WorkerType, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
  onWorkerTap?: (placement: FactionPlacement, position: { x: number; y: number }) => void;
};

export default function FactionCard({
  factionKey,
  displayName,
  powerLevel,
  placements,
  expanded,
  onToggle,
  currentPlayerId,
  playerColor,
  allPlayerAffinities,
  factionPreferences,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWorkerTap,
}: Props) {
  const { highlightedTargets, hoveredTarget, isDragging, dragPosition, dragWorkerType, registerTarget, unregisterTarget } = useDrag();
  const [activeTab, setActiveTab] = useState<'none' | 'affinity' | 'alignment'>('none');

  const demagogs = placements.filter((p) => p.oratorRole === 'demagog');
  const allies = placements.filter((p) => p.oratorRole === 'ally');
  const agitators = placements.filter((p) => p.oratorRole === 'agitator');
  const promoters = placements.filter((p) => p.workerType === 'promoter');
  const saboteurs = placements.filter((p) => p.workerType === 'saboteur');
  const totalWorkers = placements.length;
  const hasPreliminaryPlacement = placements.some((p) => p.isPreliminary);

  const powerPips = Array.from({ length: 5 }, (_, i) => i < powerLevel);

  // Auto-expand when dragging over collapsed faction header
  const headerRef = useRef<View>(null);
  const headerBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store header bounds on layout
  const handleHeaderLayout = useCallback(() => {
    if (!headerRef.current) return;
    headerRef.current.measureInWindow((x, y, w, h) => {
      if (w === 0 && h === 0) return;
      headerBoundsRef.current = { x, y, w, h };
    });
  }, []);

  // Re-measure header bounds when drag starts (scroll may have changed positions)
  useEffect(() => {
    if (isDragging) {
      handleHeaderLayout();
    }
  }, [isDragging, handleHeaderLayout]);

  useEffect(() => {
    if (!isDragging || expanded) {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      return;
    }

    // Synchronous bounds check using stored bounds
    const hb = headerBoundsRef.current;
    if (!hb) return;

    const over =
      dragPosition.x >= hb.x && dragPosition.x <= hb.x + hb.w &&
      dragPosition.y >= hb.y && dragPosition.y <= hb.y + hb.h;

    if (over && !hoverTimer.current) {
      hoverTimer.current = setTimeout(() => {
        onToggle();
        hoverTimer.current = null;
      }, 600);
    } else if (!over && hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, [isDragging, dragPosition, expanded, onToggle]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  return (
    <View style={styles.card}>
      <View ref={headerRef} collapsable={false} onLayout={handleHeaderLayout}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={styles.headerLeft}>
          <Text style={styles.factionName}>{displayName}</Text>
          <View style={styles.powerRow}>
            <Text style={styles.powerLabel}>Power:</Text>
            {powerPips.map((filled, i) => (
              <View key={i} style={[styles.powerPip, filled && styles.powerPipFilled]} />
            ))}
          </View>
        </View>
        <View style={styles.headerRight}>
          {totalWorkers > 0 && (
            <View style={styles.workerCountBadgeOuter}>
              {hasPreliminaryPlacement && (
                <ShineEffect color="#DAA520" size={26} />
              )}
              <View style={styles.workerCountBadge}>
                <Text style={styles.workerCountText}>{totalWorkers}</Text>
              </View>
            </View>
          )}
          <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>
      </View>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.grid}>
            <SlotRow
              label="Demagogs"
              placements={demagogs}
              factionKey={factionKey}
              targetRole="demagog"
              accepts={ACCEPTS_ORATOR}
              registerTarget={registerTarget}
              unregisterTarget={unregisterTarget}
              highlighted={highlightedTargets.has(`faction:${factionKey}:demagog`)}
              hovered={hoveredTarget === `faction:${factionKey}:demagog`}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onWorkerTap={onWorkerTap}
            />
            <View style={styles.splitRow}>
              <SlotRow
                label="Allies"
                placements={allies}
                factionKey={factionKey}
                targetRole="ally"
                accepts={ACCEPTS_ORATOR}
                half
                registerTarget={registerTarget}
                unregisterTarget={unregisterTarget}
                highlighted={highlightedTargets.has(`faction:${factionKey}:ally`)}
                hovered={hoveredTarget === `faction:${factionKey}:ally`}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onWorkerTap={onWorkerTap}
              />
              <SlotRow
                label="Agitators"
                placements={agitators}
                factionKey={factionKey}
                targetRole="agitator"
                accepts={ACCEPTS_ORATOR}
                half
                registerTarget={registerTarget}
                unregisterTarget={unregisterTarget}
                highlighted={highlightedTargets.has(`faction:${factionKey}:agitator`)}
                hovered={hoveredTarget === `faction:${factionKey}:agitator`}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onWorkerTap={onWorkerTap}
              />
            </View>
            <View style={styles.splitRow}>
              <SlotRow
                label="Promoters"
                placements={promoters}
                factionKey={factionKey}
                targetRole="promoter"
                accepts={ACCEPTS_PROMOTER}
                half
                registerTarget={registerTarget}
                unregisterTarget={unregisterTarget}
                highlighted={highlightedTargets.has(`faction:${factionKey}:promoter`)}
                hovered={hoveredTarget === `faction:${factionKey}:promoter`}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onWorkerTap={onWorkerTap}
              />
              <SlotRow
                label="Saboteurs"
                placements={saboteurs}
                factionKey={factionKey}
                targetRole="saboteur"
                accepts={ACCEPTS_SABOTEUR}
                half
                registerTarget={registerTarget}
                unregisterTarget={unregisterTarget}
                highlighted={highlightedTargets.has(`faction:${factionKey}:saboteur`)}
                hovered={hoveredTarget === `faction:${factionKey}:saboteur`}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onWorkerTap={onWorkerTap}
              />
            </View>
          </View>

          {/* Expandable tabs */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabButton, activeTab === 'affinity' && styles.tabButtonActive]}
              onPress={() => setActiveTab(activeTab === 'affinity' ? 'none' : 'affinity')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'affinity' && styles.tabButtonTextActive]}>
                Affinity
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, activeTab === 'alignment' && styles.tabButtonActive]}
              onPress={() => setActiveTab(activeTab === 'alignment' ? 'none' : 'alignment')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'alignment' && styles.tabButtonTextActive]}>
                Alignment
              </Text>
            </Pressable>
          </View>

          {activeTab === 'affinity' && (
            <View style={styles.tabContent}>
              <FactionAffinityTab playerAffinities={allPlayerAffinities ?? []} />
            </View>
          )}
          {activeTab === 'alignment' && (
            <View style={styles.tabContent}>
              <FactionAlignmentTab factionPreferences={factionPreferences ?? null} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

type SlotRowProps = {
  label: string;
  placements: FactionPlacement[];
  factionKey: string;
  targetRole: string;
  accepts: WorkerType[];
  half?: boolean;
  registerTarget: (target: DropTarget) => void;
  unregisterTarget: (id: string) => void;
  highlighted: boolean;
  hovered: boolean;
  onDragStart?: (workerType: WorkerType, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
  onWorkerTap?: (placement: FactionPlacement, position: { x: number; y: number }) => void;
};

function SlotRow({
  label,
  placements,
  factionKey,
  targetRole,
  accepts,
  half,
  registerTarget,
  unregisterTarget,
  highlighted,
  hovered,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWorkerTap,
}: SlotRowProps) {
  const { isDragging } = useDrag();
  const viewRef = useRef<View>(null);
  const wasDraggingRef = useRef(false);
  const targetId = `faction:${factionKey}:${targetRole}`;
  const oratorRole = (['demagog', 'ally', 'agitator'].includes(targetRole)
    ? targetRole as OratorRole
    : undefined);

  const handleLayout = useCallback(() => {
    if (!viewRef.current) return;
    viewRef.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) return;
      registerTarget({
        id: targetId,
        bounds: { x, y, width, height },
        accepts,
        oratorRole,
      });
    });
  }, [targetId, registerTarget, accepts, oratorRole]);

  // Re-measure bounds once when drag starts (scroll may have shifted positions)
  useEffect(() => {
    if (isDragging && !wasDraggingRef.current) {
      handleLayout();
    }
    wasDraggingRef.current = isDragging;
  }, [isDragging, handleLayout]);

  useEffect(() => {
    return () => unregisterTarget(targetId);
  }, [targetId, unregisterTarget]);

  const ICON_SIZE = 44;

  return (
    <View
      ref={viewRef}
      onLayout={handleLayout}
      style={[
        styles.slotRow,
        half && styles.slotRowHalf,
        highlighted && styles.slotRowHighlighted,
        hovered && styles.slotRowHovered,
      ]}
    >
      <Text style={styles.slotLabel}>{label}</Text>
      <View style={styles.iconsRow}>
        {placements.length === 0 && <Text style={styles.emptySlot}>-</Text>}
        {placements.map((p, i) => (
          <TappableWorkerIcon
            key={i}
            placement={p}
            iconSize={ICON_SIZE}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onWorkerTap={onWorkerTap}
          />
        ))}
      </View>
    </View>
  );
}

function TappableWorkerIcon({
  placement,
  iconSize,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWorkerTap,
}: {
  placement: FactionPlacement;
  iconSize: number;
  onDragStart?: (workerType: WorkerType, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
  onWorkerTap?: (placement: FactionPlacement, position: { x: number; y: number }) => void;
}) {
  const iconRef = useRef<View>(null);

  const handleTap = useCallback(() => {
    if (!onWorkerTap || !iconRef.current) return;
    iconRef.current.measureInWindow((x, y, w, h) => {
      onWorkerTap(placement, { x: x + w / 2, y });
    });
  }, [onWorkerTap, placement]);

  return (
    <Pressable onPress={handleTap}>
      <View ref={iconRef} collapsable={false} style={styles.iconWrapper}>
        {placement.isPreliminary ? (
          <>
            <ShineEffect color={getColorHex(placement.playerColor)} size={iconSize + 4} />
            <DraggableWorker
              workerType={placement.workerType as WorkerType}
              playerColor={placement.playerColor}
              size={iconSize}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          </>
        ) : (
          <>
            <View style={[styles.stableRing, { width: iconSize + 4, height: iconSize + 4, borderRadius: (iconSize + 4) / 2, borderColor: getColorHex(placement.playerColor) }]} />
            <WorkerIcon workerType={placement.workerType} playerColor={placement.playerColor} size={iconSize} />
          </>
        )}
      </View>
    </Pressable>
  );
}

function WorkerIcon({ workerType, playerColor, size }: { workerType: string; playerColor: string; size: number }) {
  const colorHex = getColorHex(playerColor);

  if (workerType === 'orator') {
    return (
      <Image
        source={getSenatorIcon(playerColor)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (workerType === 'promoter') {
    return (
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          backgroundColor: colorHex,
          borderRadius: size * 0.1,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.2)',
        }}
      />
    );
  }
  if (workerType === 'saboteur') {
    return (
      <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 40 40">
        <Polygon points="20,4 36,36 4,36" fill={colorHex} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      </Svg>
    );
  }
  return <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: colorHex }} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(26, 26, 46, 0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factionName: {
    color: '#e0c097',
    fontSize: 16,
    fontWeight: '600',
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  powerLabel: {
    color: '#e0c097',
    fontSize: 10,
    opacity: 0.5,
    marginRight: 2,
  },
  powerPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.4)',
  },
  powerPipFilled: {
    backgroundColor: '#e0c097',
    borderColor: '#e0c097',
  },
  workerCountBadgeOuter: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerCountBadge: {
    backgroundColor: 'rgba(224, 192, 151, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  workerCountText: {
    color: '#e0c097',
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#e0c097',
    fontSize: 14,
    opacity: 0.5,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 192, 151, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  grid: {
    gap: 6,
  },
  slotRow: {
    backgroundColor: 'rgba(224, 192, 151, 0.04)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 72,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slotRowHalf: {
    flex: 1,
  },
  slotRowHighlighted: {
    borderColor: '#DAA520',
    shadowColor: '#DAA520',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  slotRowHovered: {
    borderColor: '#DAA520',
    borderWidth: 2.5,
    backgroundColor: 'rgba(218, 165, 32, 0.12)',
    shadowColor: '#DAA520',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotLabel: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  iconsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stableRing: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.5,
  },
  emptySlot: {
    color: '#e0c097',
    opacity: 0.2,
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 192, 151, 0.08)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(224, 192, 151, 0.04)',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(224, 192, 151, 0.12)',
  },
  tabButtonText: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabButtonTextActive: {
    opacity: 0.8,
  },
  tabContent: {
    paddingTop: 8,
  },
});

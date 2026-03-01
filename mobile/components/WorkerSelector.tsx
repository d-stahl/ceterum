import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerType, OratorRole } from '../lib/game-engine/workers';
import DraggableWorker from './DraggableWorker';
import { useHelp } from './HelpContext';
import { C, navyBg, parchmentBg } from '../lib/theme';

export type WorkerSelection = {
  workerType: WorkerType;
  oratorRole?: OratorRole;
};

type WorkerSlot = {
  key: string;
  workerType: WorkerType;
  label: string;
};

// 3 senators (orators), 1 promoter, 1 saboteur — each a distinct piece
const WORKER_SLOTS: WorkerSlot[] = [
  { key: 'orator-1', workerType: 'orator', label: 'Senator' },
  { key: 'orator-2', workerType: 'orator', label: 'Senator' },
  { key: 'orator-3', workerType: 'orator', label: 'Senator' },
  { key: 'promoter', workerType: 'promoter', label: 'Promoter' },
  { key: 'saboteur', workerType: 'saboteur', label: 'Saboteur' },
];

const ICON_SIZE = 48;

type Props = {
  usedWorkers: { workerType: WorkerType; oratorRole?: OratorRole }[];
  preliminaryWorkerType?: WorkerType | null;
  playerColor: string;
  disabled?: boolean;
  onDragStart?: (workerType: WorkerType, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
};

export default function WorkerSelector({
  usedWorkers,
  preliminaryWorkerType,
  playerColor,
  disabled,
  onDragStart,
  onDragMove,
  onDragEnd,
}: Props) {
  const insets = useSafeAreaInsets();

  // Derive committed slots directly from usedWorkers — eliminates race conditions
  // where the component mounts before loadPlacements() resolves.
  const committedSlots = useMemo(() => assignCommittedSlots(usedWorkers), [usedWorkers]);

  const [prelimSlotKey, setPrelimSlotKey] = useState<string | null>(null);
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const lastDragSlotRef = useRef<string | null>(null);

  // Track which slot has the preliminary placement
  useEffect(() => {
    if (preliminaryWorkerType && lastDragSlotRef.current) {
      setPrelimSlotKey(lastDragSlotRef.current);
    } else if (!preliminaryWorkerType) {
      setPrelimSlotKey(null);
    }
  }, [preliminaryWorkerType]);

  const hasPreliminary = !!preliminaryWorkerType;
  const help = useHelp();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Text style={styles.title}>Available Workers</Text>
      <View style={styles.row}>
        {WORKER_SLOTS.map((slot) => {
          const isCommitted = committedSlots.has(slot.key);
          const isPrelim = slot.key === prelimSlotKey;
          const isActive = slot.key === activeSlotKey;
          const showEmpty = isCommitted || isPrelim || isActive;
          // Disable if: committed, or there's an existing preliminary and this isn't the active drag
          const isDisabled = disabled || isCommitted || (hasPreliminary && !isActive);

          return (
            <WorkerSlotView
              key={slot.key}
              slotKey={slot.key}
              helpId={`worker-${slot.workerType}`}
              help={help}
            >
              <DraggableWorker
                workerType={slot.workerType}
                playerColor={playerColor}
                size={ICON_SIZE}
                showEmpty={showEmpty}
                disabled={isDisabled}
                onDragStart={(wt, x, y) => {
                  setActiveSlotKey(slot.key);
                  lastDragSlotRef.current = slot.key;
                  onDragStart?.(wt, x, y);
                }}
                onDragMove={onDragMove}
                onDragEnd={(x, y) => {
                  setActiveSlotKey(null);
                  onDragEnd?.(x, y);
                }}
              />
              <Text style={[styles.slotLabel, showEmpty && styles.slotLabelUsed]}>
                {slot.label}
              </Text>
            </WorkerSlotView>
          );
        })}
      </View>
    </View>
  );
}

/** Wrapper that registers a help target for a worker slot */
function WorkerSlotView({
  slotKey,
  helpId,
  help,
  children,
}: {
  slotKey: string;
  helpId: string;
  help: ReturnType<typeof useHelp>;
  children: React.ReactNode;
}) {
  const viewRef = useRef<View>(null);

  const uniqueKey = `worker-slot-${slotKey}`;

  const measure = useCallback(() => {
    if (!viewRef.current || !help) return;
    viewRef.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) return;
      help.registerHelpTarget({ uniqueKey, helpId, bounds: { x, y, width, height } });
    });
  }, [uniqueKey, helpId, help]);

  useEffect(() => {
    if (help?.isHelpDragging) measure();
  }, [help?.isHelpDragging, measure]);

  useEffect(() => {
    return () => { help?.unregisterHelpTarget(uniqueKey); };
  }, [uniqueKey, help]);

  const isHelpHighlighted = !!help?.isHelpDragging;
  const isHelpHovered = help?.hoveredUniqueKey === uniqueKey;

  return (
    <View
      ref={viewRef}
      collapsable={false}
      onLayout={measure}
      style={[
        styles.slotWrapper,
        isHelpHighlighted && styles.slotHelpHighlighted,
        isHelpHovered && styles.slotHelpHovered,
      ]}
    >
      {children}
    </View>
  );
}

/** Assign committed placements to specific slot keys (in order) */
function assignCommittedSlots(
  usedWorkers: { workerType: WorkerType; oratorRole?: OratorRole }[]
): Set<string> {
  const slots = new Set<string>();
  let oratorIdx = 0;
  for (const w of usedWorkers) {
    if (w.workerType === 'orator') {
      if (oratorIdx < 3) {
        slots.add(WORKER_SLOTS[oratorIdx].key);
        oratorIdx++;
      }
    } else if (w.workerType === 'promoter') {
      slots.add('promoter');
    } else if (w.workerType === 'saboteur') {
      slots.add('saboteur');
    }
  }
  return slots;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: navyBg(0.92),
    borderTopWidth: 1,
    borderTopColor: parchmentBg(0.2),
  },
  title: {
    color: C.parchment,
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  slotWrapper: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    padding: 4,
  },
  slotHelpHighlighted: {
    borderColor: parchmentBg(0.25),
  },
  slotHelpHovered: {
    borderColor: C.parchment,
    backgroundColor: parchmentBg(0.1),
    shadowColor: C.parchment,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  slotLabel: {
    color: C.parchment,
    fontSize: 9,
    opacity: 0.6,
  },
  slotLabelUsed: {
    opacity: 0.3,
  },
});

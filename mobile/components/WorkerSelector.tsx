import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WorkerType, OratorRole } from '../lib/game-engine/workers';

export type WorkerSelection = {
  workerType: WorkerType;
  oratorRole?: OratorRole;
};

// All possible choices a player can make
const WORKER_CHOICES: { label: string; shortLabel: string; selection: WorkerSelection }[] = [
  { label: 'Demagog', shortLabel: 'DEM', selection: { workerType: 'orator', oratorRole: 'demagog' } },
  { label: 'Ally', shortLabel: 'ALY', selection: { workerType: 'orator', oratorRole: 'ally' } },
  { label: 'Agitator', shortLabel: 'AGT', selection: { workerType: 'orator', oratorRole: 'agitator' } },
  { label: 'Promoter', shortLabel: 'PRO', selection: { workerType: 'promoter' } },
  { label: 'Saboteur', shortLabel: 'SAB', selection: { workerType: 'saboteur' } },
];

type Props = {
  usedWorkers: { workerType: WorkerType; oratorRole?: OratorRole }[];
  selected: WorkerSelection | null;
  onSelect: (selection: WorkerSelection | null) => void;
  disabled?: boolean;
};

export default function WorkerSelector({ usedWorkers, selected, onSelect, disabled }: Props) {
  const usedOrators = usedWorkers.filter((w) => w.workerType === 'orator').length;
  const usedPromoter = usedWorkers.some((w) => w.workerType === 'promoter');
  const usedSaboteur = usedWorkers.some((w) => w.workerType === 'saboteur');

  function isAvailable(choice: WorkerSelection): boolean {
    if (disabled) return false;
    if (choice.workerType === 'orator') return usedOrators < 3;
    if (choice.workerType === 'promoter') return !usedPromoter;
    if (choice.workerType === 'saboteur') return !usedSaboteur;
    return false;
  }

  function isSelected(choice: WorkerSelection): boolean {
    if (!selected) return false;
    return selected.workerType === choice.workerType && selected.oratorRole === choice.oratorRole;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Worker</Text>
      <View style={styles.row}>
        {WORKER_CHOICES.map((choice) => {
          const available = isAvailable(choice.selection);
          const active = isSelected(choice.selection);
          return (
            <Pressable
              key={choice.label}
              style={[
                styles.chip,
                !available && styles.chipDisabled,
                active && styles.chipActive,
              ]}
              onPress={() => {
                if (!available) return;
                onSelect(active ? null : choice.selection);
              }}
              disabled={!available}
            >
              <Text style={[
                styles.chipText,
                !available && styles.chipTextDisabled,
                active && styles.chipTextActive,
              ]}>
                {choice.shortLabel}
              </Text>
              <Text style={[
                styles.chipLabel,
                !available && styles.chipTextDisabled,
                active && styles.chipTextActive,
              ]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 192, 151, 0.2)',
  },
  title: {
    color: '#e0c097',
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
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 58,
  },
  chipDisabled: {
    opacity: 0.3,
  },
  chipActive: {
    backgroundColor: 'rgba(224, 192, 151, 0.2)',
    borderColor: '#e0c097',
  },
  chipText: {
    color: '#e0c097',
    fontSize: 16,
    fontWeight: '700',
  },
  chipTextDisabled: {
    opacity: 0.4,
  },
  chipTextActive: {
    color: '#e0c097',
  },
  chipLabel: {
    color: '#e0c097',
    fontSize: 9,
    opacity: 0.6,
    marginTop: 2,
  },
});

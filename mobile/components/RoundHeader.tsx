import { View, Text, StyleSheet, Pressable } from 'react-native';
import { C, parchmentBg } from '../lib/theme';
import HomeIcon from './icons/HomeIcon';

type Props = {
  phaseTitle: string;
  roundInfo: string;
  influence: number;
  onHome: () => void;
  /** Optional help button element rendered to the left of the home button. */
  helpNode?: React.ReactNode;
};

export default function RoundHeader({ phaseTitle, roundInfo, influence, onHome, helpNode }: Props) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.phaseTitle}>{phaseTitle}</Text>
        <Text style={styles.roundInfo}>{roundInfo}</Text>
      </View>
      <View style={styles.headerRight}>
        {helpNode}
        <Pressable style={styles.homeButton} onPress={onHome}>
          <HomeIcon size={22} color={C.parchment} />
        </Pressable>
        <View style={styles.influenceBox}>
          <Text style={styles.influenceLabel}>Influence</Text>
          <Text style={styles.influenceValue}>{influence}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  phaseTitle: {
    color: C.parchment,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  roundInfo: {
    color: C.parchment,
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: parchmentBg(0.08),
  },
  influenceBox: {
    alignItems: 'center',
    backgroundColor: parchmentBg(0.1),
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: parchmentBg(0.2),
  },
  influenceLabel: {
    color: C.parchment,
    fontSize: 10,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  influenceValue: {
    color: C.parchment,
    fontSize: 20,
    fontWeight: '700',
  },
});

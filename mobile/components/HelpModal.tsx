import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { C, parchmentBg, darkNavyBg } from '../lib/theme';

export type HelpId =
  | 'general'
  | 'worker-orator'
  | 'worker-promoter'
  | 'worker-saboteur'
  | 'faction-header'
  | 'slot-demagog'
  | 'slot-advocate'
  | 'slot-agitator'
  | 'slot-promoter'
  | 'slot-saboteur'
  | 'faction-affinity'
  | 'faction-alignment'
  | 'leader-election';

type HelpEntry = {
  title: string;
  body: string;
};

const HELP_CONTENT: Record<string, HelpEntry> = {
  general: {
    title: 'Demagogery',
    body: `In the Demagogery phase, each player secretly chooses one worker to place on a faction each step. Workers are revealed simultaneously.

Demagogs earn influence from factions they address. The stronger the faction and the more you're liked there, the more you earn.

Advocates boost a demagog in the same faction and earn a small cut. Agitators disrupt — halving demagog and advocate payouts — while earning their own small fee.

Promoters strengthen factions (higher power = more future payouts). Saboteurs weaken them.

Drag this icon onto any element on screen for specific help.`,
  },
  'worker-orator': {
    title: 'Senator (Orator)',
    body: `Senators can be placed in three roles on any faction:

Demagog – The main speaker. Earns influence based on faction power, your affinity with the faction, and whether advocates or agitators are present.

Advocate – Supports the demagog, giving them +4 influence, and earns a small amount themselves.

Agitator – Disrupts the faction, halving all demagog and advocate payouts. Earns a small amount regardless.`,
  },
  'worker-promoter': {
    title: 'Promoter',
    body: `Raises a faction's power by 1 at round end (max 5).

Higher power factions pay more influence to demagogs:
• Power 4: +1 influence
• Power 5: +2 influence

Note that promoting a faction benefits all players who place there, so consider whether you're helping rivals more than yourself.`,
  },
  'worker-saboteur': {
    title: 'Saboteur',
    body: `Lowers a faction's power by 1 at round end (min 1).

Lower power factions pay less influence:
• Power 2: −1 influence
• Power 1: −2 influence

Use this to weaken factions where rivals are strong, or to deny future payouts in factions you don't plan to use.`,
  },
  'faction-header': {
    title: 'Faction',
    body: `Shows the faction's name and current power level (pips, out of 5).

Power affects demagog payouts (additive):
• Power 1: Very weak (−2)
• Power 2: Weak (−1)
• Power 3: Neutral (no change)
• Power 4: Powerful (+1)
• Power 5: Very powerful (+2)

Power changes from Promoters and Saboteurs take effect at round end.`,
  },
  'slot-demagog': {
    title: 'Demagog Slot',
    body: `The main speaker role. Influence is calculated as:

1. Add all bonuses:
   • Base: +4
   • Faction power: −2 to +2
   • Your affinity: −2 to +2
   • Advocate present: +4

2. Apply multipliers:
   • 2 demagogs: −40%, 3: −64%, 4: −78%…
   • Agitator present: −50%

3. Round up (minimum 0).`,
  },
  'slot-advocate': {
    title: 'Advocate Slot',
    body: `Supports the demagog in this faction.

Gives the demagog +4 influence. Also earns a small payout:
• Base: +2
• Faction power: −2 to +2
• Crowding (demagog count): same as demagog penalty
• Agitator present: −50%

Placed without a demagog in the same faction, an advocate earns nothing.`,
  },
  'slot-agitator': {
    title: 'Agitator Slot',
    body: `Disrupts the faction's speakers.

All demagogs and advocates in the faction earn only 50% of their normal payout.

The agitator earns their own amount:
• Base: +2
• Faction power: −2 to +2
• Multiple agitators crowd each other

Placed without a demagog, the agitator still earns — but there's no one to disrupt.`,
  },
  'slot-promoter': {
    title: 'Promoter Slot',
    body: `A Promoter placed here increases this faction's power by +1 at round end.

Multiple promoters stack, but power is capped at 5.

Higher faction power benefits everyone who places demagogs here in future steps and rounds.`,
  },
  'slot-saboteur': {
    title: 'Saboteur Slot',
    body: `A Saboteur placed here decreases this faction's power by −1 at round end.

Power is floored at 1. Stacking saboteurs accelerates the reduction.

Use this strategically to hurt rivals who rely on high-power factions.`,
  },
  'faction-affinity': {
    title: 'Affinity',
    body: `Your personal relationship with this faction (ranges from −5 to +5).

Affinity affects your demagog's payout:
• Strong antipathy (≤−2): −2 influence
• Antipathy (−1): −1 influence
• Neutral (0): no change
• Sympathy (+1): +1 influence
• Strong sympathy (≥+2): +2 influence

Affinity changes based on your actions each round.`,
  },
  'faction-alignment': {
    title: 'Alignment',
    body: `This faction's ideological preferences across six axes:

• Centralization vs. Autonomy
• Expansion vs. Isolationism
• Commerce vs. Agriculture
• Patrician vs. Plebeian
• Tradition vs. Reform
• Militarism vs. Peace

Your own policy positions affect how much affinity you gain with each faction over time.`,
  },
  'leader-election': {
    title: 'Leader Election',
    body: `At the start of each ruling phase, all players vote for who should become Senate Leader.

Each player selects one candidate (including themselves) and casts their vote. Your vote carries weight equal to your current influence.

The candidate with the highest total backing wins. Ties are broken by personal influence, then randomly.

The Senate Leader is powerful: they choose which controversies are debated, in what order, and which to discard. They also receive an institutional bonus when voting on resolutions.

But power comes at a price — the Senate Leader suffers double affinity penalties with factions upset by the outcomes.

Use the "On the Horizon" tab to preview upcoming controversies and the "Players" tab to see other players' influence and policy positions — this can help you decide who to back.`,
  },
};

type Props = {
  helpId: string | null;
  onDismiss: () => void;
};

export default function HelpModal({ helpId, onDismiss }: Props) {
  if (!helpId) return null;

  const entry = HELP_CONTENT[helpId] ?? {
    title: 'Help',
    body: 'No help available for this element.',
  };

  return (
    <Modal
      visible={!!helpId}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{entry.title}</Text>
          <View style={styles.divider} />
          <ScrollView>
            <Text style={styles.body}>{entry.body}</Text>
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={onDismiss}>
            <Text style={styles.closeButtonText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: darkNavyBg(0.98),
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: parchmentBg(0.2),
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: parchmentBg(0.3),
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: parchmentBg(0.15),
    marginBottom: 14,
  },
  body: {
    color: C.warmGold,
    fontSize: 14,
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: parchmentBg(0.12),
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: parchmentBg(0.25),
  },
  closeButtonText: {
    color: C.parchment,
    fontSize: 15,
    fontWeight: '600',
  },
});

import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { C, parchmentBg, darkNavyBg, blackBg } from '../lib/theme';

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
  | 'leader-election'
  | 'ruling-selection'
  | 'ruling-pool'
  | 'controversy-voting'
  | 'controversy-endeavour'
  | 'controversy-clash'
  | 'controversy-schism';

type HelpEntry = {
  title: string;
  body: string;
};

const HELP_CONTENT: Record<string, HelpEntry> = {
  general: {
    title: 'Demagogery',
    body: `In the Demagogery phase, each player secretly places workers on factions each step. Workers are revealed simultaneously.

You have 3 senators and can send each to a different faction as a Demagog, Advocate, or Agitator. You also have a Promoter and a Saboteur — these are separate and can be placed alongside a senator.

Demagogs earn influence based on faction power and your affinity. Advocates boost demagog payouts and reduce agitator effectiveness. Agitators siphon influence from demagogs.

Promoters strengthen factions (+1 power, +2 self affinity). Saboteurs weaken them (−2 power) and damage affinity of all senators present.

Drag this icon onto any element on screen for specific help.`,
  },
  'worker-orator': {
    title: 'Senator (Orator)',
    body: `You have 3 senators. Each must go to a different faction, in one of three roles:

Demagog – The earner. Influence = 10 × power modifier × affinity modifier. Locks you in at this faction next round.

Advocate – The protector. Earns a modest base (5 × modifiers). Boosts demagog payouts and reduces agitator siphon effectiveness. Great for cooperation — "advocate my faction and I'll advocate yours."

Agitator – The disruptor. Earns base (5 × modifiers) plus siphons a portion of each demagog's payout. Higher affinity = higher siphon rate (10%–70%). Devastating when you read the board right, wasted when you guess wrong.`,
  },
  'worker-promoter': {
    title: 'Promoter',
    body: `Earns a fixed 5 influence (unaffected by modifiers).

Also raises faction power by +1 (max 5) and gives you +2 affinity with the faction.

Higher power means better payouts for everyone — but affinity is yours alone. Building affinity makes your senators more effective and your agitators more dangerous at this faction.`,
  },
  'worker-saboteur': {
    title: 'Saboteur',
    body: `Earns a fixed 5 influence (unaffected by modifiers).

Reduces faction power by −2 (min 1). Multiple saboteurs do not stack — still −2.

Also splashes −1 affinity to every player who has a senator at the faction. When words fall on deaf ears, the daggers come out.`,
  },
  'faction-header': {
    title: 'Faction',
    body: `Shows the faction's name and current power level (pips, out of 5).

Power affects senator payouts as a multiplier:
• Power 1: ×0.6
• Power 2: ×0.8
• Power 3: ×1.0 (baseline)
• Power 4: ×1.2
• Power 5: ×1.4

Power changes from Promoters and Saboteurs take effect immediately this round.`,
  },
  'slot-demagog': {
    title: 'Demagog Slot',
    body: `The main earner role. Influence = 10 × power modifier × affinity modifier.

Power modifier: (power + 2) / 5, from ×0.6 to ×1.4.
Affinity modifier: 1 + 0.05 × affinity, from ×0.75 to ×1.25.

Additional effects:
• Advocate present: boosts your payout (25%–75% depending on advocate's affinity)
• Agitator present: siphons a portion of your payout (reduced by advocates)
• Multiple demagogs: ×0.6 crowding per extra demagog

Demagogs lock in — you must place at this faction next round too.`,
  },
  'slot-advocate': {
    title: 'Advocate Slot',
    body: `Protector and booster. Earns 5 × power × affinity modifiers.

Two passive effects on the faction:
• Boosts all demagog payouts by 25%–75% (based on your affinity)
• Reduces agitator siphon effectiveness by 25%–75% (based on your affinity)

Multiple advocates crowd each other (×0.6 per extra), reducing both personal payout and effects.

Still earns base payout without demagogs present, but the boost and protection are wasted.`,
  },
  'slot-agitator': {
    title: 'Agitator Slot',
    body: `The disruptor. Earns base (5 × power × affinity modifiers) plus siphoned influence.

Siphon rate: 40% + 6% per affinity point (10% at aff −5, 70% at aff +5). You need the faction's ear to redirect the crowd effectively.

Siphoned amount is taken from each demagog's payout (after advocate boost). Advocates reduce the effective siphon rate.

Multiple agitators crowd each other (×0.6 per extra). Without demagogs, you earn only the base — nothing to siphon.`,
  },
  'slot-promoter': {
    title: 'Promoter Slot',
    body: `A Promoter placed here:
• Earns a fixed 5 influence
• Increases faction power by +1 (max 5)
• Grants you +2 affinity with the faction

Multiple promoters stack power (but capped at 5). Building affinity here makes all your future senator plays at this faction more effective.`,
  },
  'slot-saboteur': {
    title: 'Saboteur Slot',
    body: `A Saboteur placed here:
• Earns a fixed 5 influence
• Decreases faction power by −2 (min 1)
• Splashes −1 affinity to every player with a senator here

Multiple saboteurs do NOT stack — power still only drops by 2.

A pure spite play. You don't need affinity with a faction to sabotage it.`,
  },
  'faction-affinity': {
    title: 'Affinity',
    body: `Your personal relationship with this faction (ranges from −5 to +5).

Affinity acts as a multiplier on senator payouts:
• ×0.75 at affinity −5
• ×1.00 at affinity 0
• ×1.25 at affinity +5

Affinity also determines your agitator siphon rate at this faction (higher = more effective).

Affinity changes from promoters (+2 self), saboteur splash (−1), and controversy outcomes. Factions in favor of a winning resolution grant +1 affinity to backers; opposed factions inflict −1 (−2 for Senate Leader).`,
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
  'ruling-selection': {
    title: 'Senate Leader Selection',
    body: `The player who earned the most influence during Demagogery becomes Senate Leader.

If two or more players are tied, a runoff is held: all tied players are listed as contenders, and every player pledges support for one of them. The contender with the least support is eliminated. This repeats until one contender remains.

The Senate Leader holds significant power this round — but also bears extra accountability for the outcomes.`,
  },
  'ruling-pool': {
    title: 'Senate Leader Phase',
    body: `The Senate Leader privately manages the controversy pool before debate begins.

First, discard one controversy — it will not be debated this round and returns to the pool next round.

Then, order the remaining three controversies by priority. The first two in your ordering will be debated this round. The third becomes a leftover and carries forward.

Other players wait while you make these decisions — use the "On the Horizon" tab to review the options.`,
  },
  'controversy-voting': {
    title: 'Controversy Vote',
    body: `Each controversy has three possible resolutions. The Senate Leader publicly declares which they prefer, then all players secretly vote by spending influence.

The Senate Leader's declared resolution receives an institutional bonus of +2 per other player, giving it a significant advantage. Ties are broken in favor of the Senate Leader's declaration.

You can vote for any resolution regardless of the Senate Leader's declaration. Spending 0 influence is valid — it counts as a vote with no affinity consequences.

Each faction reacts to the outcome based on whether it moves policy toward or away from their interests. Factions "In Favor" grant +1 affinity to backers. Factions "Opposed" inflict −1 affinity (−2 for the Senate Leader). Neutral factions have no effect. Spending 0 influence exempts you from all affinity consequences.`,
  },
  'controversy-endeavour': {
    title: 'Endeavour',
    body: `An Endeavour is a collective undertaking — Rome has committed to action, and now every senator must decide how much of their political capital to invest.

If the total investment meets the threshold, the Endeavour succeeds. Those who invested the most reap the greatest rewards — victory points and influence scaled by contribution. Those who invested little get little. If the Endeavour fails, all invested influence is lost and no one is rewarded.

The threshold is displayed, so you can judge whether success is realistic. The temptation is to hold back and let others carry the burden — but if too many senators think the same way, the whole enterprise collapses and everyone loses what they put in.

Investing nothing is permitted, but earns nothing.`,
  },
  'controversy-clash': {
    title: 'Clash',
    body: `A Clash is a trial of Roman resolve — an external threat demands the Senate rally its factions or face the consequences.

Each player bids influence to claim factions. Your bid is amplified by your affinity with each faction — a senator with deep ties can claim a faction cheaply. The highest bidder wins each faction's loyalty. Ties split the faction's support.

After bidding, each player secretly chooses: Commit your factions to the fight, or Withdraw them. Committed factions contribute their power toward the threshold. Withdrawn factions sit idle.

If the Clash succeeds, those who committed earn glory — victory points and stronger bonds with their factions. If it fails, those who committed suffer — lost influence and damaged reputations. Those who withdrew from a successful Clash are resented by their factions for cowardice. Those who withdrew from a failure escape unscathed.

The ruthless play: seize critical factions, then withdraw. The Clash fails because your factions aren't fighting, and you've denied them to those who would have committed. But if Rome prevails despite your betrayal, your factions will remember your cowardice.`,
  },
  'controversy-schism': {
    title: 'Schism',
    body: `A Schism is a test of loyalty — the Senate is divided and a chosen few will determine the outcome through trust or treachery.

Two opposing sides are presented, each with different policy effects. The Senate Leader declares which side they champion, then selects a team from the other players.

Team members secretly choose: Stand with the Senate Leader, or betray them. If every member holds true, the declared side prevails and the whole team is richly rewarded. If anyone betrays, the other side wins instead — the traitors claim a lesser reward for themselves while loyal members are left with nothing, humiliated for misplacing their trust.

If every single member betrays, they all share the worst possible outcome — a pittance split among conspirators who trusted no one, not even each other.

Players not on the team may place wagers on the outcome — will loyalty or treachery prevail? Correct predictions are handsomely rewarded. Wrong predictions cost you your stake. Wagering is optional.

The stakes are clear: unity pays best, but betrayal is the safer path. The worst fate is to stand alone in loyalty while others reach for the knife.`,
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
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{entry.title}</Text>
          <View style={styles.divider} />
          <ScrollView style={{ flexShrink: 1 }}>
            <Text style={styles.body}>{entry.body}</Text>
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={onDismiss}>
            <Text style={styles.closeButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: blackBg(0.5),
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

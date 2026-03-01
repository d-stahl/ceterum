import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { submitPledge } from '../lib/game-actions';
import { C, goldBg } from '../lib/theme';

type Contender = {
  playerId: string;
  influence: number;
};

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type Props = {
  gameId: string;
  roundId: string;
  currentUserId: string;
  senateLeaderId: string | null;
  pledgeContenders: string[];   // UUIDs of current contenders
  players: PlayerInfo[];
  onLeaderSelected: () => void; // called when phase moves to ruling_pool
};

export default function SenateLeaderSelection({
  gameId,
  roundId,
  currentUserId,
  senateLeaderId,
  pledgeContenders,
  players,
  onLeaderSelected,
}: Props) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [pledgeRound, setPledgeRound] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const playerName = (id: string) =>
    players.find((p) => p.player_id === id)?.player_name ?? 'Unknown';

  const playerColor = (id: string) =>
    players.find((p) => p.player_id === id)?.color ?? '#888';

  // If there's already a Senate Leader, this phase is done — notify parent
  useEffect(() => {
    if (senateLeaderId) {
      onLeaderSelected();
    }
  }, [senateLeaderId]);

  // Clear submitted state when pledge round changes (new elimination round)
  useEffect(() => {
    setHasSubmitted(false);
    setSelectedCandidate(null);
  }, [pledgeRound]);

  async function handleSubmitPledge() {
    if (!selectedCandidate || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitPledge(gameId, selectedCandidate, pledgeRound);
      setHasSubmitted(true);

      if (result.status === 'leader_selected') {
        // Runoff resolved — parent will get the realtime update and call onLeaderSelected
      } else if (result.status === 'eliminated') {
        // Another round needed — UI will update when pledgeContenders changes via realtime
        setPledgeRound(result.next_pledge_round);
      }
      // status === 'waiting' → hasSubmitted = true, waiting indicator shown
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit pledge');
    } finally {
      setSubmitting(false);
    }
  }

  if (pledgeContenders.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={C.gold} size="large" />
        <Text style={styles.waitText}>Determining Senate Leader…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Senate Leader Selection</Text>

      {pledgeRound > 1 && (
        <Text style={styles.subtitle}>Runoff Round {pledgeRound}</Text>
      )}

      <Text style={styles.body}>
        Players are tied for the most influence. All must pledge support to one contender.
        The contender with the least support is eliminated.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.contendersSection}>
        {pledgeContenders.map((id) => {
          const isSelected = selectedCandidate === id;
          const isMe = id === currentUserId;
          return (
            <Pressable
              key={id}
              style={[
                styles.contenderCard,
                isSelected && styles.contenderCardSelected,
              ]}
              onPress={() => !hasSubmitted && setSelectedCandidate(id)}
              disabled={hasSubmitted}
            >
              <View style={[styles.colorDot, { backgroundColor: playerColor(id) }]} />
              <Text style={styles.contenderName}>
                {playerName(id)}{isMe ? ' (You)' : ''}
              </Text>
              {isSelected && <Text style={styles.selectedMark}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      {!hasSubmitted ? (
        <Pressable
          style={[
            styles.submitButton,
            (!selectedCandidate || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitPledge}
          disabled={!selectedCandidate || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={C.darkText} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Pledge Support</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.waitingContainer}>
          <ActivityIndicator color={C.gold} size="small" />
          <Text style={styles.waitText}>Waiting for other players…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'serif',
  },
  subtitle: {
    color: C.paleGold,
    fontSize: 15,
    opacity: 0.8,
  },
  body: {
    color: C.paleGold,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
    maxWidth: 340,
  },
  contendersSection: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  contenderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: goldBg(0.08),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  contenderCardSelected: {
    backgroundColor: goldBg(0.22),
    borderColor: C.gold,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  contenderName: {
    color: C.paleGold,
    fontSize: 16,
    flex: 1,
  },
  selectedMark: {
    color: C.gold,
    fontSize: 18,
  },
  submitButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  waitText: {
    color: C.gold,
    fontSize: 14,
    opacity: 0.7,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
});

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { submitLeaderVote } from '../lib/game-actions';
import { supabase } from '../lib/supabase';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg } from '../lib/theme';

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type PlayerState = {
  player_id: string;
  influence: number;
};

type VoteResult = {
  candidateId: string;
  segments: { playerId: string; color: string; weight: number }[];
  total: number;
};

type Props = {
  gameId: string;
  roundId: string;
  currentUserId: string;
  players: PlayerInfo[];
  playerStates: PlayerState[];
  senateLeaderId: string | null;
  onLeaderSelected: () => void;
};

export default function LeaderElection({
  gameId,
  roundId,
  currentUserId,
  players,
  playerStates,
  senateLeaderId,
  onLeaderSelected,
}: Props) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResult[] | null>(null);

  const playerName = (id: string) =>
    players.find((p) => p.player_id === id)?.player_name ?? 'Unknown';
  const playerColorId = (id: string) =>
    players.find((p) => p.player_id === id)?.color ?? 'ivory';
  const playerInfluence = (id: string) =>
    playerStates.find((ps) => ps.player_id === id)?.influence ?? 0;

  const totalPlayers = players.length;
  const waitingCount = hasSubmitted ? totalPlayers - 1 : 0; // approximate

  // When senateLeaderId appears, fetch vote results and show them
  useEffect(() => {
    if (!senateLeaderId) return;

    (async () => {
      const { data: pledges } = await supabase
        .from('game_support_pledges')
        .select('pledger_id, candidate_id')
        .eq('round_id', roundId)
        .eq('pledge_round', 1);

      if (!pledges) return;

      // Build results grouped by candidate
      const candidateMap = new Map<string, { playerId: string; color: string; weight: number }[]>();
      for (const p of pledges) {
        const segments = candidateMap.get(p.candidate_id) ?? [];
        segments.push({
          playerId: p.pledger_id,
          color: playerColorId(p.pledger_id),
          weight: playerInfluence(p.pledger_id),
        });
        candidateMap.set(p.candidate_id, segments);
      }

      const results: VoteResult[] = [];
      for (const [candidateId, segments] of candidateMap) {
        const total = segments.reduce((sum, s) => sum + s.weight, 0);
        results.push({ candidateId, segments, total });
      }
      results.sort((a, b) => b.total - a.total);
      setVoteResults(results);
    })();
  }, [senateLeaderId]);

  async function handleSubmitVote() {
    if (!selectedCandidate || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitLeaderVote(gameId, selectedCandidate);
      setHasSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Results view ---
  if (senateLeaderId && voteResults) {
    const maxTotal = Math.max(...voteResults.map((r) => r.total), 1);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Election Results</Text>
        <Text style={styles.body}>
          {playerName(senateLeaderId)} has been elected Senate Leader!
        </Text>

        <View style={styles.resultsSection}>
          {voteResults.map((result) => {
            const isWinner = result.candidateId === senateLeaderId;
            const barWidth = (result.total / maxTotal) * 100;
            return (
              <View key={result.candidateId} style={styles.resultRow}>
                <View style={styles.resultLabel}>
                  <View style={[styles.colorDot, { backgroundColor: getColorHex(playerColorId(result.candidateId)) }]} />
                  <Text style={[styles.resultName, isWinner && styles.resultNameWinner]}>
                    {playerName(result.candidateId)}
                    {result.candidateId === currentUserId ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.resultTotal}>{result.total}</Text>
                </View>
                <View style={styles.barContainer}>
                  <View style={[styles.barTrack, { width: `${barWidth}%` }]}>
                    {result.segments.map((seg, i) => {
                      const segWidth = result.total > 0 ? (seg.weight / result.total) * 100 : 0;
                      return (
                        <View
                          key={seg.playerId}
                          style={[
                            styles.barSegment,
                            {
                              width: `${segWidth}%`,
                              backgroundColor: getColorHex(seg.color),
                              borderTopLeftRadius: i === 0 ? 4 : 0,
                              borderBottomLeftRadius: i === 0 ? 4 : 0,
                              borderTopRightRadius: i === result.segments.length - 1 ? 4 : 0,
                              borderBottomRightRadius: i === result.segments.length - 1 ? 4 : 0,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                {isWinner && <Text style={styles.winnerBadge}>ELECTED</Text>}
              </View>
            );
          })}
        </View>

        <Pressable style={styles.submitButton} onPress={onLeaderSelected}>
          <Text style={styles.submitButtonText}>Continue</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- Waiting view ---
  if (hasSubmitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leader Election</Text>
        <Text style={styles.body}>
          You voted for {selectedCandidate ? playerName(selectedCandidate) : '...'}.
        </Text>
        <View style={styles.waitingContainer}>
          <ActivityIndicator color={C.gold} size="small" />
          <Text style={styles.waitText}>Waiting for other players…</Text>
        </View>
      </View>
    );
  }

  // --- Voting view ---
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Leader Election</Text>
      <Text style={styles.body}>
        Vote for the player who should lead the Senate this round. Your influence ({playerInfluence(currentUserId)}) is your voting weight.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.candidatesSection}>
        {players.map((p) => {
          const isSelected = selectedCandidate === p.player_id;
          const isMe = p.player_id === currentUserId;
          const inf = playerInfluence(p.player_id);
          return (
            <Pressable
              key={p.player_id}
              style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
              onPress={() => setSelectedCandidate(p.player_id)}
            >
              <View style={[styles.colorDot, { backgroundColor: getColorHex(p.color) }]} />
              <View style={styles.candidateInfo}>
                <Text style={styles.candidateName}>
                  {p.player_name}{isMe ? ' (You)' : ''}
                </Text>
                <Text style={styles.candidateInfluence}>Influence: {inf}</Text>
              </View>
              {isSelected && <Text style={styles.selectedMark}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.submitButton, (!selectedCandidate || submitting) && styles.submitButtonDisabled]}
        onPress={handleSubmitVote}
        disabled={!selectedCandidate || submitting}
      >
        {submitting ? (
          <ActivityIndicator color={C.darkText} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Support</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  body: {
    color: C.paleGold,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
    maxWidth: 340,
  },
  candidatesSection: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: goldBg(0.08),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  candidateCardSelected: {
    backgroundColor: goldBg(0.22),
    borderColor: C.gold,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    color: C.paleGold,
    fontSize: 16,
  },
  candidateInfluence: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
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
  // Results
  resultsSection: {
    width: '100%',
    gap: 14,
    marginTop: 8,
  },
  resultRow: {
    gap: 4,
  },
  resultLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultName: {
    color: C.paleGold,
    fontSize: 14,
    flex: 1,
  },
  resultNameWinner: {
    color: C.gold,
    fontWeight: '700',
  },
  resultTotal: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.6,
  },
  barContainer: {
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barTrack: {
    height: '100%',
    flexDirection: 'row',
  },
  barSegment: {
    height: '100%',
  },
  winnerBadge: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
});

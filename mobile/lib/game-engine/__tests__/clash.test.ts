import { resolveClash, assignFactions, bidStrength, ClashSubmission } from '../clash';
import type { ClashConfig } from '../controversies';

const config: ClashConfig = {
  thresholdPercent: 0.70,
  factionAmplifiers: { nautae: 2, milites: 2 },
  successOutcome: {
    axisEffects: { expansion: 1, militarism: 1 },
    factionPowerEffects: { nautae: 1 },
    victoryPoints: 3,
  },
  failureOutcome: {
    axisEffects: { militarism: -1, commerce: -1 },
    factionPowerEffects: { nautae: -1 },
  },
};

const factionPowers: Record<string, number> = {
  nautae: 3,
  milites: 3,
  mercatores: 4,
};

// Total amplified power: nautae=6, milites=6, mercatores=4 = 16
// Threshold at 70%: 11.2

const affinities: Record<string, Record<string, number>> = {
  alice: { nautae: 3, milites: 0, mercatores: -2 },
  bob: { nautae: -1, milites: 2, mercatores: 3 },
  carol: { nautae: 0, milites: 0, mercatores: 0 },
};

describe('bidStrength', () => {
  it('applies multiplicative affinity bonus', () => {
    expect(bidStrength(10, 5)).toBe(15);    // 10 * 1.5
    expect(bidStrength(10, 0)).toBe(10);    // 10 * 1.0
    expect(bidStrength(10, -5)).toBe(5);    // 10 * 0.5
  });

  it('handles zero influence', () => {
    expect(bidStrength(0, 5)).toBe(0);
  });
});

describe('assignFactions', () => {
  it('assigns faction to highest bidder', () => {
    const assignments = assignFactions(
      [
        { playerId: 'alice', factionBids: { nautae: 5 }, commits: true },
        { playerId: 'bob', factionBids: { nautae: 3 }, commits: true },
      ],
      factionPowers,
      config.factionAmplifiers,
      affinities,
    );

    const nautae = assignments.find((a) => a.factionKey === 'nautae')!;
    expect(nautae.winners.length).toBe(1);
    // alice: 5 * (1 + 3*0.10) = 6.5, bob: 3 * (1 + (-1)*0.10) = 2.7
    expect(nautae.winners[0].playerId).toBe('alice');
  });

  it('splits faction power on tied bids', () => {
    const assignments = assignFactions(
      [
        { playerId: 'alice', factionBids: { mercatores: 10 }, commits: true },
        { playerId: 'carol', factionBids: { mercatores: 10 }, commits: true },
      ],
      factionPowers,
      config.factionAmplifiers,
      // both neutral affinity → same bid strength
      { alice: { mercatores: 0 }, carol: { mercatores: 0 } },
    );

    const merc = assignments.find((a) => a.factionKey === 'mercatores')!;
    expect(merc.winners.length).toBe(2);
    expect(merc.winners[0].share).toBe(0.5);
    expect(merc.winners[1].share).toBe(0.5);
  });

  it('leaves uncontested factions unassigned', () => {
    const assignments = assignFactions(
      [{ playerId: 'alice', factionBids: { nautae: 5 }, commits: true }],
      factionPowers,
      config.factionAmplifiers,
      affinities,
    );

    const milites = assignments.find((a) => a.factionKey === 'milites')!;
    expect(milites.winners.length).toBe(0);
  });
});

describe('resolveClash', () => {
  it('succeeds when committed power meets threshold', () => {
    // alice gets nautae (amplified 6), bob gets milites (amplified 6)
    // both commit → 12 power >= 11.2 threshold
    const result = resolveClash(
      [
        { playerId: 'alice', factionBids: { nautae: 5 }, commits: true },
        { playerId: 'bob', factionBids: { milites: 5 }, commits: true },
        { playerId: 'carol', factionBids: { mercatores: 3 }, commits: true },
      ],
      config,
      factionPowers,
      affinities,
    );

    expect(result.succeeded).toBe(true);
    expect(result.victoryPoints).toBe(3);
    expect(result.axisEffects).toEqual({ expansion: 1, militarism: 1 });
  });

  it('fails when not enough power committed', () => {
    // alice gets nautae (6) but withdraws, bob gets milites (6) commits
    // committed = 6 < 11.2 threshold
    const result = resolveClash(
      [
        { playerId: 'alice', factionBids: { nautae: 5 }, commits: false },
        { playerId: 'bob', factionBids: { milites: 5 }, commits: true },
        { playerId: 'carol', factionBids: {}, commits: false },
      ],
      config,
      factionPowers,
      affinities,
    );

    expect(result.succeeded).toBe(false);
    expect(result.victoryPoints).toBe(0);
    expect(result.axisEffects).toEqual({ militarism: -1, commerce: -1 });
    expect(result.committers).toEqual(['bob']);
    expect(result.withdrawers).toContain('alice');
    expect(result.withdrawers).toContain('carol');
  });

  it('passive betrayal: grabbing critical faction and withdrawing tanks the clash', () => {
    // alice grabs both critical factions, then withdraws
    // bob commits but has no factions
    const result = resolveClash(
      [
        { playerId: 'alice', factionBids: { nautae: 10, milites: 10 }, commits: false },
        { playerId: 'bob', factionBids: { mercatores: 5 }, commits: true },
      ],
      config,
      factionPowers,
      affinities,
    );

    expect(result.succeeded).toBe(false);
    // bob only has mercatores at power 4 (no amplifier), threshold is 11.2
    expect(result.committedPower).toBe(4);
  });

  it('floors threshold and committedPower to integers', () => {
    // Use a threshold percent that produces a fractional value
    // totalAvailablePower in standard test is 16, so 0.33 → 5.28, floored to 5
    const fracConfig: ClashConfig = {
      ...config,
      thresholdPercent: 0.33,
    };
    const submissions: ClashSubmission[] = [
      { playerId: 'alice', factionBids: { nautae: 5 }, commits: true },
      { playerId: 'bob', factionBids: { milites: 5 }, commits: true },
      { playerId: 'carol', factionBids: { mercatores: 3 }, commits: true },
    ];
    const result = resolveClash(submissions, fracConfig, factionPowers, affinities);
    expect(Number.isInteger(result.threshold)).toBe(true);
    expect(Number.isInteger(result.committedPower)).toBe(true);
    expect(result.threshold).toBe(5); // floor(16 * 0.33) = floor(5.28) = 5
  });

  it('split factions contribute proportional power when committed', () => {
    const result = resolveClash(
      [
        { playerId: 'alice', factionBids: { nautae: 10 }, commits: true },
        { playerId: 'carol', factionBids: { nautae: 10 }, commits: true },
      ],
      config,
      factionPowers,
      // both neutral → tie
      { alice: { nautae: 0 }, carol: { nautae: 0 } },
    );

    // nautae amplified = 6, split 50/50, both commit → 3 + 3 = 6
    const nautae = result.factionAssignments.find((a) => a.factionKey === 'nautae')!;
    expect(nautae.winners.length).toBe(2);
    // Both commit, so full 6 power committed from nautae
    expect(result.committedPower).toBe(6);
  });
});

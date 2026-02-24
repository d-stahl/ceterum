import { generateAgendas, PlayerAgenda } from '../agenda';
import { AXIS_KEYS } from '../axes';

describe('generateAgendas', () => {
  const PLAYER_COUNTS = [3, 4, 5, 6, 7, 8];

  for (const n of PLAYER_COUNTS) {
    describe(`with ${n} players`, () => {
      const playerIds = Array.from({ length: n }, (_, i) => `player_${i}`);
      // Run multiple times to exercise randomness
      const RUNS = 20;

      it('generates an agenda for every player', () => {
        const agendas = generateAgendas(playerIds);
        expect(Object.keys(agendas).sort()).toEqual(playerIds.sort());
      });

      it('all values are in range [-2, 2]', () => {
        for (let run = 0; run < RUNS; run++) {
          const agendas = generateAgendas(playerIds);
          for (const pid of playerIds) {
            for (const axis of AXIS_KEYS) {
              expect(agendas[pid][axis]).toBeGreaterThanOrEqual(-2);
              expect(agendas[pid][axis]).toBeLessThanOrEqual(2);
            }
          }
        }
      });

      it('each axis is balanced (sum == 0)', () => {
        for (let run = 0; run < RUNS; run++) {
          const agendas = generateAgendas(playerIds);
          for (const axis of AXIS_KEYS) {
            const sum = playerIds.reduce((s, pid) => s + agendas[pid][axis], 0);
            expect(sum).toBe(0);
          }
        }
      });

      it('no axis position has more than floor(n/2) players', () => {
        const maxPerPos = Math.floor(n / 2);
        for (let run = 0; run < RUNS; run++) {
          const agendas = generateAgendas(playerIds);
          for (const axis of AXIS_KEYS) {
            const counts = new Map<number, number>();
            for (const pid of playerIds) {
              const val = agendas[pid][axis];
              counts.set(val, (counts.get(val) ?? 0) + 1);
            }
            for (const [val, count] of counts) {
              expect(count).toBeLessThanOrEqual(maxPerPos);
            }
          }
        }
      });
    });
  }
});

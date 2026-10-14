// Self-check for rent occupancy-month logic. Run: npx tsx scripts/check-rent-months.ts
import assert from 'node:assert/strict';
import { shiftMonth, computeRentStatus } from '../src/services/rentCollectionsService';

assert.equal(shiftMonth('2026-10', 1), '2026-11');
assert.equal(shiftMonth('2026-12', 1), '2027-01');
assert.equal(shiftMonth('2027-01', -1), '2026-12');

// Oct 2026 occupancy → paid in Nov → overdue only after 30 Nov
assert.equal(computeRentStatus(10000, 0, '2026-10', '2026-11-15'), 'pending');
assert.equal(computeRentStatus(10000, 5000, '2026-10', '2026-11-30'), 'partial');
assert.equal(computeRentStatus(10000, 0, '2026-10', '2026-12-01'), 'overdue');
assert.equal(computeRentStatus(10000, 10000, '2026-10', '2027-01-01'), 'received');

// Lease 2026-10-01 → 2027-08-31: replicate cron eligibility over months it runs in
const leaseStart = '2026-10-01';
const leaseEnd = '2027-08-31';
const cards: string[] = [];
for (let run = '2026-10'; run <= '2027-10'; run = shiftMonth(run, 1)) {
  const target = shiftMonth(run, -1);
  if (leaseStart.slice(0, 7) > target) continue;
  if (leaseEnd < target + '-01') continue;
  cards.push(target);
}
assert.equal(cards.length, 11);
assert.equal(cards[0], '2026-10');
assert.equal(cards[10], '2027-08');

console.log('rent month checks passed');

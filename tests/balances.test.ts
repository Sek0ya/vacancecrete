import { describe, expect, it } from "vitest";
import { buildSettlementPlan, calculateBalances } from "@/lib/balances";
import { splitEqually } from "@/lib/money";
import type { Expense, Participant, Trip } from "@/lib/types";

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];

function participants(count: number): Participant[] {
  return ids.slice(0, count).map((id, position) => ({ id, name: `P${position + 1}`, position }));
}

function expense(amountCents: number, participantIds: string[], payerId = participantIds[0], shares = splitEqually(amountCents, participantIds)): Expense {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Test",
    amountCents,
    payerId,
    participantIds,
    shares,
    splitMode: "equal",
    category: null,
    date: null,
    bookingReference: null,
    note: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function tripWith(count: number, testExpense: Expense): Pick<Trip, "participants" | "expenses" | "settlements"> {
  return { participants: participants(count), expenses: [testExpense], settlements: [] };
}

describe("répartition exacte des centimes", () => {
  it.each([
    [2, 1001, [501, 500]],
    [3, 1000, [334, 333, 333]],
    [4, 1002, [251, 251, 250, 250]],
  ])("répartit %i participants sans perdre de centime", (count, total, expected) => {
    const shares = splitEqually(total, ids.slice(0, count));
    expect(shares.map((share) => share.amountCents)).toEqual(expected);
    expect(shares.reduce((sum, share) => sum + share.amountCents, 0)).toBe(total);
  });
});

describe("soldes et remboursements", () => {
  it("conserve toujours une somme des soldes égale à zéro", () => {
    for (const count of [2, 3, 4]) {
      const trip = tripWith(count, expense(1001, ids.slice(0, count)));
      expect(calculateBalances(trip).reduce((sum, balance) => sum + balance.netCents, 0)).toBe(0);
    }
  });

  it("respecte une répartition personnalisée", () => {
    const custom = [
      { participantId: ids[0], amountCents: 1500 },
      { participantId: ids[1], amountCents: 2500 },
      { participantId: ids[2], amountCents: 6000 },
    ];
    const testExpense = { ...expense(10000, ids.slice(0, 3), ids[1], custom), splitMode: "custom" as const };
    const balances = calculateBalances(tripWith(3, testExpense));
    expect(balances.map((balance) => balance.netCents)).toEqual([-1500, 7500, -6000]);
    expect(buildSettlementPlan(balances)).toEqual([
      { fromParticipantId: ids[2], toParticipantId: ids[1], amountCents: 6000 },
      { fromParticipantId: ids[0], toParticipantId: ids[1], amountCents: 1500 },
    ]);
  });

  it("compense les dettes intermédiaires et prend en compte un remboursement", () => {
    const base = tripWith(3, expense(9000, ids.slice(0, 3), ids[0]));
    const before = buildSettlementPlan(calculateBalances(base));
    expect(before).toHaveLength(2);
    const afterTrip = {
      ...base,
      settlements: [{
        id: "30000000-0000-4000-8000-000000000001",
        fromParticipantId: ids[1],
        toParticipantId: ids[0],
        amountCents: 3000,
        date: "2026-01-02",
        note: null,
        createdAt: "2026-01-02T00:00:00Z",
      }],
    };
    expect(buildSettlementPlan(calculateBalances(afterTrip))).toEqual([
      { fromParticipantId: ids[2], toParticipantId: ids[0], amountCents: 3000 },
    ]);
  });
});


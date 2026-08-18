import type { Balance, Transfer, Trip } from "./types";

export function calculateBalances(trip: Pick<Trip, "participants" | "expenses" | "settlements">): Balance[] {
  const balances = new Map<string, Balance>(
    trip.participants.map((participant) => [
      participant.id,
      { participantId: participant.id, paidCents: 0, shareCents: 0, netCents: 0 },
    ]),
  );

  for (const expense of trip.expenses) {
    const payer = balances.get(expense.payerId);
    if (!payer) throw new Error("Payeur inconnu");
    payer.paidCents += expense.amountCents;
    for (const share of expense.shares) {
      const balance = balances.get(share.participantId);
      if (!balance) throw new Error("Participant inconnu dans une répartition");
      balance.shareCents += share.amountCents;
    }
  }

  for (const balance of balances.values()) {
    balance.netCents = balance.paidCents - balance.shareCents;
  }

  for (const settlement of trip.settlements) {
    const from = balances.get(settlement.fromParticipantId);
    const to = balances.get(settlement.toParticipantId);
    if (!from || !to) throw new Error("Participant inconnu dans un remboursement");
    from.netCents += settlement.amountCents;
    to.netCents -= settlement.amountCents;
  }

  return [...balances.values()];
}

export function buildSettlementPlan(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((balance) => balance.netCents < 0)
    .map((balance) => ({ id: balance.participantId, amount: -balance.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = balances
    .filter((balance) => balance.netCents > 0)
    .map((balance) => ({ id: balance.participantId, amount: balance.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const total = balances.reduce((sum, balance) => sum + balance.netCents, 0);
  if (total !== 0) throw new Error(`Les soldes ne sont pas équilibrés (${total} centime(s))`);

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.amount, creditor.amount);
    if (amountCents > 0) {
      transfers.push({
        fromParticipantId: debtor.id,
        toParticipantId: creditor.id,
        amountCents,
      });
    }
    debtor.amount -= amountCents;
    creditor.amount -= amountCents;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }
  return transfers;
}


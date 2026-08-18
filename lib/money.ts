export function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [euros, decimals = ""] = normalized.split(".");
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function splitEqually(totalCents: number, participantIds: string[]): { participantId: string; amountCents: number }[] {
  if (!Number.isInteger(totalCents) || totalCents < 0 || participantIds.length === 0) {
    throw new Error("Répartition égale invalide");
  }
  const base = Math.floor(totalCents / participantIds.length);
  const remainder = totalCents % participantIds.length;
  return participantIds.map((participantId, index) => ({
    participantId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}


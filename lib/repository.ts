import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { splitEqually } from "./money";
import type { Expense, Participant, Settlement, Trip } from "./types";
import type { ExpenseInput, TripAction } from "./validation";

type CreatedTrip = { token: string; trip: Trip };

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function optional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase n’est pas configuré sur ce serveur");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

declare global {
  var tripSplitDemoStore: Map<string, Trip> | undefined;
}

const DEMO_TOKEN = "demo-voyage-ete-2026";

function demoStore() {
  if (!globalThis.tripSplitDemoStore) {
    const lucas = randomUUID();
    const paul = randomUUID();
    const ines = randomUUID();
    const expenseId = randomUUID();
    globalThis.tripSplitDemoStore = new Map([
      [DEMO_TOKEN, {
        id: randomUUID(),
        name: "Week-end à Lisbonne",
        currency: "EUR",
        createdAt: new Date().toISOString(),
        participants: [
          { id: lucas, name: "Lucas", position: 0 },
          { id: paul, name: "Paul", position: 1 },
          { id: ines, name: "Inès", position: 2 },
        ],
        expenses: [{
          id: expenseId,
          name: "Appartement",
          amountCents: 36000,
          payerId: paul,
          participantIds: [lucas, paul, ines],
          shares: splitEqually(36000, [lucas, paul, ines]),
          splitMode: "equal",
          category: "logement",
          date: new Date().toISOString().slice(0, 10),
          bookingReference: null,
          note: "Trois nuits dans le centre",
          createdAt: new Date().toISOString(),
        }],
        settlements: [],
      }],
    ]);
  }
  return globalThis.tripSplitDemoStore;
}

function isDemo() {
  return process.env.TRIPSPLIT_DEMO_MODE === "true";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function resolveTripId(client: SupabaseClient, token: string) {
  const { data, error } = await client.from("trips").select("id").eq("access_token_hash", tokenHash(token)).maybeSingle();
  if (error) throw new Error("Impossible de lire le voyage");
  if (!data) throw new Error("Voyage introuvable ou lien invalide");
  return data.id as string;
}

export async function createTrip(input: { name: string; currency: string; participantNames: string[] }): Promise<CreatedTrip> {
  const token = randomBytes(24).toString("base64url");
  if (isDemo()) {
    const trip: Trip = {
      id: randomUUID(),
      name: input.name,
      currency: input.currency,
      participants: input.participantNames.map((participantName, position) => ({ id: randomUUID(), name: participantName, position })),
      expenses: [],
      settlements: [],
      createdAt: new Date().toISOString(),
    };
    demoStore().set(token, trip);
    return { token, trip: clone(trip) };
  }

  const client = supabase();
  const { data: tripRow, error } = await client
    .from("trips")
    .insert({ name: input.name, currency: input.currency, access_token_hash: tokenHash(token) })
    .select("id, name, currency, created_at")
    .single();
  if (error) throw new Error("Impossible de créer le voyage");
  const { error: participantError } = await client.from("participants").insert(
    input.participantNames.map((participantName, position) => ({ trip_id: tripRow.id, name: participantName, position })),
  );
  if (participantError) {
    await client.from("trips").delete().eq("id", tripRow.id);
    throw new Error("Impossible d’ajouter les participants");
  }
  const trip = await getTrip(token);
  return { token, trip };
}

export async function getTrip(token: string): Promise<Trip> {
  if (isDemo()) {
    const trip = demoStore().get(token);
    if (!trip) throw new Error("Voyage introuvable ou lien invalide");
    return clone(trip);
  }

  const client = supabase();
  const { data: tripRow, error } = await client
    .from("trips")
    .select("id, name, currency, created_at")
    .eq("access_token_hash", tokenHash(token))
    .maybeSingle();
  if (error || !tripRow) throw new Error("Voyage introuvable ou lien invalide");
  const [participantsResult, expensesResult, sharesResult, settlementsResult] = await Promise.all([
    client.from("participants").select("id, name, position").eq("trip_id", tripRow.id).order("position"),
    client.from("expenses").select("id, name, amount_cents, payer_id, split_mode, category, expense_date, booking_reference, note, created_at").eq("trip_id", tripRow.id).order("created_at", { ascending: false }),
    client.from("expense_shares").select("expense_id, participant_id, amount_cents").eq("trip_id", tripRow.id),
    client.from("settlements").select("id, from_participant_id, to_participant_id, amount_cents, settlement_date, note, created_at").eq("trip_id", tripRow.id).order("created_at", { ascending: false }),
  ]);
  const firstError = participantsResult.error || expensesResult.error || sharesResult.error || settlementsResult.error;
  if (firstError) throw new Error("Impossible de charger les données du voyage");
  const participants: Participant[] = (participantsResult.data ?? []).map((row) => ({ id: row.id, name: row.name, position: row.position }));
  const expenses: Expense[] = (expensesResult.data ?? []).map((row) => {
    const shares = (sharesResult.data ?? [])
      .filter((share) => share.expense_id === row.id)
      .map((share) => ({ participantId: share.participant_id, amountCents: Number(share.amount_cents) }));
    return {
      id: row.id,
      name: row.name,
      amountCents: Number(row.amount_cents),
      payerId: row.payer_id,
      participantIds: shares.map((share) => share.participantId),
      shares,
      splitMode: row.split_mode,
      category: row.category,
      date: row.expense_date,
      bookingReference: row.booking_reference,
      note: row.note,
      createdAt: row.created_at,
    };
  });
  const settlements: Settlement[] = (settlementsResult.data ?? []).map((row) => ({
    id: row.id,
    fromParticipantId: row.from_participant_id,
    toParticipantId: row.to_participant_id,
    amountCents: Number(row.amount_cents),
    date: row.settlement_date,
    note: row.note,
    createdAt: row.created_at,
  }));
  return { id: tripRow.id, name: tripRow.name, currency: tripRow.currency, createdAt: tripRow.created_at, participants, expenses, settlements };
}

function sharesFor(input: ExpenseInput) {
  const uniqueIds = [...new Set(input.participantIds)];
  if (uniqueIds.length !== input.participantIds.length) throw new Error("Un participant apparaît plusieurs fois");
  if (input.splitMode === "equal") return splitEqually(input.amountCents, uniqueIds);
  const shares = input.shares ?? [];
  if (shares.length !== uniqueIds.length || shares.some((share) => !uniqueIds.includes(share.participantId))) {
    throw new Error("La répartition personnalisée est incomplète");
  }
  if (shares.reduce((sum, share) => sum + share.amountCents, 0) !== input.amountCents) {
    throw new Error("La somme des parts doit être égale au montant total");
  }
  return shares;
}

export async function mutateTrip(token: string, action: TripAction): Promise<Trip> {
  if (isDemo()) {
    const trip = demoStore().get(token);
    if (!trip) throw new Error("Voyage introuvable ou lien invalide");
    mutateDemoTrip(trip, action);
    return clone(trip);
  }

  const client = supabase();
  const tripId = await resolveTripId(client, token);
  await mutateSupabaseTrip(client, tripId, action);
  return getTrip(token);
}

function mutateDemoTrip(trip: Trip, action: TripAction) {
  if (action.action === "updateTrip") {
    trip.name = action.name;
    trip.currency = action.currency;
  } else if (action.action === "addParticipant") {
    trip.participants.push({ id: randomUUID(), name: action.name, position: trip.participants.length });
  } else if (action.action === "updateParticipant") {
    const participant = trip.participants.find((item) => item.id === action.id);
    if (!participant) throw new Error("Participant introuvable");
    participant.name = action.name;
  } else if (action.action === "deleteParticipant") {
    const referenced = trip.expenses.some((expense) => expense.payerId === action.id || expense.participantIds.includes(action.id)) ||
      trip.settlements.some((settlement) => settlement.fromParticipantId === action.id || settlement.toParticipantId === action.id);
    if (referenced) throw new Error("Supprimez d’abord les dépenses et remboursements liés à cette personne");
    trip.participants = trip.participants.filter((participant) => participant.id !== action.id).map((participant, position) => ({ ...participant, position }));
  } else if (action.action === "saveExpense") {
    const input = action.expense;
    validateParticipantIds(trip, [input.payerId, ...input.participantIds]);
    const expense: Expense = {
      id: input.id ?? randomUUID(),
      name: input.name,
      amountCents: input.amountCents,
      payerId: input.payerId,
      participantIds: [...input.participantIds],
      shares: sharesFor(input),
      splitMode: input.splitMode,
      category: input.category ?? null,
      date: input.date ?? null,
      bookingReference: optional(input.bookingReference),
      note: optional(input.note),
      createdAt: trip.expenses.find((item) => item.id === input.id)?.createdAt ?? new Date().toISOString(),
    };
    const index = trip.expenses.findIndex((item) => item.id === input.id);
    if (index >= 0) trip.expenses[index] = expense;
    else trip.expenses.unshift(expense);
  } else if (action.action === "deleteExpense") {
    trip.expenses = trip.expenses.filter((expense) => expense.id !== action.id);
  } else if (action.action === "addSettlement") {
    if (action.fromParticipantId === action.toParticipantId) throw new Error("Choisissez deux personnes différentes");
    validateParticipantIds(trip, [action.fromParticipantId, action.toParticipantId]);
    trip.settlements.unshift({ id: randomUUID(), fromParticipantId: action.fromParticipantId, toParticipantId: action.toParticipantId, amountCents: action.amountCents, date: action.date, note: optional(action.note), createdAt: new Date().toISOString() });
  } else if (action.action === "deleteSettlement") {
    trip.settlements = trip.settlements.filter((settlement) => settlement.id !== action.id);
  }
}

function validateParticipantIds(trip: Trip, ids: string[]) {
  const valid = new Set(trip.participants.map((participant) => participant.id));
  if (ids.some((id) => !valid.has(id))) throw new Error("Un participant sélectionné n’existe plus");
}

async function mutateSupabaseTrip(client: SupabaseClient, tripId: string, action: TripAction) {
  if (action.action === "updateTrip") {
    const { error } = await client.from("trips").update({ name: action.name, currency: action.currency }).eq("id", tripId);
    if (error) throw new Error("Impossible de modifier le voyage");
  } else if (action.action === "addParticipant") {
    const { count } = await client.from("participants").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
    const { error } = await client.from("participants").insert({ trip_id: tripId, name: action.name, position: count ?? 0 });
    if (error) throw new Error("Impossible d’ajouter ce participant");
  } else if (action.action === "updateParticipant") {
    const { error } = await client.from("participants").update({ name: action.name }).eq("trip_id", tripId).eq("id", action.id);
    if (error) throw new Error("Impossible de modifier ce participant");
  } else if (action.action === "deleteParticipant") {
    const { error } = await client.from("participants").delete().eq("trip_id", tripId).eq("id", action.id);
    if (error) throw new Error("Supprimez d’abord les dépenses et remboursements liés à cette personne");
  } else if (action.action === "saveExpense") {
    await saveSupabaseExpense(client, tripId, action.expense);
  } else if (action.action === "deleteExpense") {
    const { error } = await client.from("expenses").delete().eq("trip_id", tripId).eq("id", action.id);
    if (error) throw new Error("Impossible de supprimer cette dépense");
  } else if (action.action === "addSettlement") {
    if (action.fromParticipantId === action.toParticipantId) throw new Error("Choisissez deux personnes différentes");
    const { error } = await client.from("settlements").insert({ trip_id: tripId, from_participant_id: action.fromParticipantId, to_participant_id: action.toParticipantId, amount_cents: action.amountCents, settlement_date: action.date, note: optional(action.note) });
    if (error) throw new Error("Impossible d’enregistrer ce remboursement");
  } else if (action.action === "deleteSettlement") {
    const { error } = await client.from("settlements").delete().eq("trip_id", tripId).eq("id", action.id);
    if (error) throw new Error("Impossible d’annuler ce remboursement");
  }
}

async function saveSupabaseExpense(client: SupabaseClient, tripId: string, input: ExpenseInput) {
  const shares = sharesFor(input);
  const expenseData = {
    trip_id: tripId,
    name: input.name,
    amount_cents: input.amountCents,
    payer_id: input.payerId,
    split_mode: input.splitMode,
    category: input.category ?? null,
    expense_date: input.date ?? null,
    booking_reference: optional(input.bookingReference),
    note: optional(input.note),
  };
  let expenseId = input.id;
  if (expenseId) {
    const { error } = await client.from("expenses").update(expenseData).eq("trip_id", tripId).eq("id", expenseId);
    if (error) throw new Error("Impossible de modifier cette dépense");
    const { error: deleteError } = await client.from("expense_shares").delete().eq("trip_id", tripId).eq("expense_id", expenseId);
    if (deleteError) throw new Error("Impossible de modifier la répartition");
  } else {
    const { data, error } = await client.from("expenses").insert(expenseData).select("id").single();
    if (error) throw new Error("Impossible d’ajouter cette dépense");
    expenseId = data.id;
  }
  const { error: shareError } = await client.from("expense_shares").insert(
    shares.map((share) => ({ trip_id: tripId, expense_id: expenseId, participant_id: share.participantId, amount_cents: share.amountCents })),
  );
  if (shareError) throw new Error("Impossible d’enregistrer la répartition");
}

export { DEMO_TOKEN };


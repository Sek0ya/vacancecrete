import { z } from "zod";
import { CATEGORIES } from "./types";

const name = z.string().trim().min(1, "Ce nom est obligatoire").max(100, "Ce nom est trop long");
const cents = z.number().int().positive().max(100_000_000_00, "Le montant est trop élevé");

export const createTripSchema = z.object({
  name,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Devise invalide").default("EUR"),
  participantNames: z.array(name).min(1, "Ajoutez au moins un participant").max(30),
});

export const expenseInputSchema = z.object({
  id: z.string().uuid().optional(),
  name,
  amountCents: cents,
  payerId: z.string().uuid(),
  participantIds: z.array(z.string().uuid()).min(1, "Sélectionnez au moins un participant"),
  splitMode: z.enum(["equal", "custom"]),
  shares: z.array(z.object({ participantId: z.string().uuid(), amountCents: z.number().int().nonnegative() })).optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  date: z.iso.date().nullable().optional(),
  bookingReference: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const tripActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("updateTrip"), name, currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/) }),
  z.object({ action: z.literal("addParticipant"), name }),
  z.object({ action: z.literal("updateParticipant"), id: z.string().uuid(), name }),
  z.object({ action: z.literal("deleteParticipant"), id: z.string().uuid() }),
  z.object({ action: z.literal("saveExpense"), expense: expenseInputSchema }),
  z.object({ action: z.literal("deleteExpense"), id: z.string().uuid() }),
  z.object({
    action: z.literal("addSettlement"),
    fromParticipantId: z.string().uuid(),
    toParticipantId: z.string().uuid(),
    amountCents: cents,
    date: z.iso.date(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal("deleteSettlement"), id: z.string().uuid() }),
]);

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type TripAction = z.infer<typeof tripActionSchema>;


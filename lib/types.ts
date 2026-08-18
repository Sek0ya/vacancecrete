export const CATEGORIES = [
  "activité",
  "transport",
  "nourriture",
  "logement",
  "billets",
  "autre",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Participant = {
  id: string;
  name: string;
  position: number;
};

export type ExpenseShare = {
  participantId: string;
  amountCents: number;
};

export type Expense = {
  id: string;
  name: string;
  amountCents: number;
  payerId: string;
  participantIds: string[];
  shares: ExpenseShare[];
  splitMode: "equal" | "custom";
  category: Category | null;
  date: string | null;
  bookingReference: string | null;
  note: string | null;
  createdAt: string;
};

export type Settlement = {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
  date: string;
  note: string | null;
  createdAt: string;
};

export type Trip = {
  id: string;
  name: string;
  currency: string;
  participants: Participant[];
  expenses: Expense[];
  settlements: Settlement[];
  createdAt: string;
};

export type Balance = {
  participantId: string;
  paidCents: number;
  shareCents: number;
  netCents: number;
};

export type Transfer = {
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
};


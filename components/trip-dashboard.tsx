"use client";

import { useMemo, useState } from "react";
import { buildSettlementPlan, calculateBalances } from "@/lib/balances";
import { centsToInput, formatMoney, parseMoneyToCents, splitEqually } from "@/lib/money";
import { CATEGORIES, type Expense, type Participant, type Transfer, type Trip } from "@/lib/types";

type Modal = "expense" | "settlement" | "settings" | null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function personName(trip: Trip, id: string) {
  return trip.participants.find((participant) => participant.id === id)?.name ?? "Participant supprimé";
}

function categoryLabel(category: Expense["category"]) {
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : "Dépense";
}

export function TripDashboard({ initialTrip, token }: { initialTrip: Trip; token: string }) {
  const [trip, setTrip] = useState(initialTrip);
  const [modal, setModal] = useState<Modal>(null);
  const [editedExpense, setEditedExpense] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const balances = useMemo(() => calculateBalances(trip), [trip]);
  const plan = useMemo(() => buildSettlementPlan(balances), [balances]);
  const totalCents = trip.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  async function sendAction(body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Modification impossible");
      setTrip(result);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification impossible");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Lien privé copié");
    } catch {
      setError("Impossible de copier le lien. Copiez l’adresse dans votre navigateur.");
    }
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`Supprimer « ${expense.name} » ?`)) return;
    await sendAction({ action: "deleteExpense", id: expense.id });
  }

  async function removeSettlement(id: string) {
    if (!window.confirm("Annuler ce remboursement ? Les soldes seront recalculés.")) return;
    await sendAction({ action: "deleteSettlement", id });
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-28">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:var(--background)/.94] px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[var(--accent)]"><span className="grid size-6 place-items-center rounded-lg bg-[var(--accent)] text-white">T</span> TripSplit</div>
            <h1 className="mt-1 truncate text-xl font-black tracking-tight">{trip.name}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="secondary text-sm" onClick={share}>Partager</button>
            <button className="secondary px-3" aria-label="Gérer le voyage" onClick={() => setModal("settings")}>⚙</button>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5">
        {(error || notice) && (
          <div role={error ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
            {error || notice}
          </div>
        )}

        <section className="card overflow-hidden bg-[var(--ink)] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-white/60">Total du voyage</p>
          <p className="mt-2 text-4xl font-black tracking-[-.04em]">{formatMoney(totalCents, trip.currency)}</p>
          <p className="mt-2 text-sm text-white/60">{trip.expenses.length} dépense{trip.expenses.length !== 1 ? "s" : ""} · {trip.participants.length} participant{trip.participants.length !== 1 ? "s" : ""}</p>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Situation actuelle</p><h2 className="mt-1 text-xl font-black">Soldes</h2></div>
            <button className="text-sm font-bold text-[var(--accent)]" onClick={() => setModal("settlement")} disabled={trip.participants.length < 2}>+ Remboursement</button>
          </div>
          <div className="card divide-y divide-[var(--line)]">
            {balances.map((balance) => (
              <div key={balance.participantId} className="flex items-center gap-3 p-4">
                <Avatar participant={trip.participants.find((item) => item.id === balance.participantId)!} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{personName(trip, balance.participantId)}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Payé {formatMoney(balance.paidCents, trip.currency)} · Part {formatMoney(balance.shareCents, trip.currency)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${balance.netCents > 0 ? "text-[var(--accent)]" : balance.netCents < 0 ? "text-[var(--danger)]" : ""}`}>{balance.netCents > 0 ? "+" : ""}{formatMoney(balance.netCents, trip.currency)}</p>
                  <p className="text-[11px] text-[var(--muted)]">{balance.netCents > 0 ? "à recevoir" : balance.netCents < 0 ? "à payer" : "équilibré"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Plan consolidé</p>
          <h2 className="mb-3 mt-1 text-xl font-black">Qui rembourse qui ?</h2>
          {plan.length ? (
            <div className="space-y-2">
              {plan.map((transfer) => (
                <div className="card flex items-center gap-3 p-4" key={`${transfer.fromParticipantId}-${transfer.toParticipantId}`}>
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-black text-[var(--accent)]">→</div>
                  <p className="min-w-0 flex-1 text-sm leading-5"><strong>{personName(trip, transfer.fromParticipantId)}</strong> doit envoyer <strong className="whitespace-nowrap">{formatMoney(transfer.amountCents, trip.currency)}</strong> à <strong>{personName(trip, transfer.toParticipantId)}</strong></p>
                </div>
              ))}
            </div>
          ) : <EmptyCard text={trip.expenses.length ? "Tout est réglé, les comptes sont équilibrés." : "Ajoutez une dépense pour calculer les remboursements."} />}
        </section>

        {trip.settlements.length > 0 && (
          <section>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Déjà enregistrés</p>
            <h2 className="mb-3 mt-1 text-xl font-black">Remboursements</h2>
            <div className="card divide-y divide-[var(--line)]">
              {trip.settlements.map((settlement) => (
                <div className="flex items-center gap-3 p-4" key={settlement.id}>
                  <div className="min-w-0 flex-1 text-sm"><p><strong>{personName(trip, settlement.fromParticipantId)}</strong> → <strong>{personName(trip, settlement.toParticipantId)}</strong></p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("fr-FR").format(new Date(`${settlement.date}T12:00:00`))}{settlement.note ? ` · ${settlement.note}` : ""}</p></div>
                  <p className="font-black">{formatMoney(settlement.amountCents, trip.currency)}</p>
                  <button className="px-1 text-xl text-[var(--muted)]" aria-label="Annuler ce remboursement" onClick={() => removeSettlement(settlement.id)}>×</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Historique</p>
          <h2 className="mb-3 mt-1 text-xl font-black">Dépenses et réservations</h2>
          {trip.expenses.length ? (
            <div className="space-y-3">
              {trip.expenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} trip={trip} onEdit={() => { setEditedExpense(expense); setModal("expense"); }} onDelete={() => removeExpense(expense)} />
              ))}
            </div>
          ) : <EmptyCard text="Aucune dépense pour le moment. Ajoutez la première réservation du voyage." />}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 p-3 backdrop-blur">
        <button className="primary mx-auto block w-full max-w-2xl py-4 text-base" onClick={() => { setEditedExpense(null); setModal("expense"); }} disabled={!trip.participants.length}>+ Ajouter une dépense</button>
      </div>

      {modal === "expense" && <ExpenseModal trip={trip} expense={editedExpense} busy={busy} onClose={() => setModal(null)} onSave={async (expense) => { if (await sendAction({ action: "saveExpense", expense })) setModal(null); }} />}
      {modal === "settlement" && <SettlementModal trip={trip} plan={plan} busy={busy} onClose={() => setModal(null)} onSave={async (settlement) => { if (await sendAction({ action: "addSettlement", ...settlement })) setModal(null); }} />}
      {modal === "settings" && <SettingsModal trip={trip} busy={busy} onClose={() => setModal(null)} onAction={sendAction} />}
    </main>
  );
}

function Avatar({ participant }: { participant: Participant }) {
  const colors = ["#d8eee6", "#f7e6bf", "#dfe7f5", "#f2dce3", "#e5e0f5"];
  const color = colors[participant.position % colors.length];
  return <div className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-black" style={{ background: color }}>{participant.name.slice(0, 1).toUpperCase()}</div>;
}

function EmptyCard({ text }: { text: string }) {
  return <div className="card px-5 py-8 text-center text-sm leading-6 text-[var(--muted)]">{text}</div>;
}

function ExpenseCard({ expense, trip, onEdit, onDelete }: { expense: Expense; trip: Trip; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card overflow-hidden">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-lg">{expense.category === "transport" ? "↗" : expense.category === "nourriture" ? "✦" : expense.category === "logement" ? "⌂" : expense.category === "billets" ? "▣" : "•"}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{expense.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{categoryLabel(expense.category)} · payé par {personName(trip, expense.payerId)}{expense.date ? ` · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${expense.date}T12:00:00`))}` : ""}</p></div>
        <div className="text-right"><p className="font-black">{formatMoney(expense.amountCents, trip.currency)}</p><p className="mt-1 text-xs text-[var(--muted)]">{open ? "Masquer" : "Détail"}</p></div>
      </button>
      {open && (
        <div className="border-t border-[var(--line)] bg-[#fafbf9] p-4">
          <p className="mb-2 text-xs font-black uppercase tracking-[.1em] text-[var(--muted)]">Répartition</p>
          <div className="space-y-1.5">
            {expense.shares.map((share) => <div className="flex justify-between text-sm" key={share.participantId}><span>{personName(trip, share.participantId)}</span><strong>{formatMoney(share.amountCents, trip.currency)}</strong></div>)}
          </div>
          {(expense.bookingReference || expense.note) && <div className="mt-4 border-t border-[var(--line)] pt-3 text-sm leading-6 text-[var(--muted)]">{expense.bookingReference && <p><strong>Référence :</strong> {expense.bookingReference}</p>}{expense.note && <p>{expense.note}</p>}</div>}
          <div className="mt-4 flex gap-2"><button className="secondary flex-1 text-sm" onClick={onEdit}>Modifier</button><button className="secondary danger flex-1 text-sm" onClick={onDelete}>Supprimer</button></div>
        </div>
      )}
    </article>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black tracking-tight">{title}</h2><button className="grid size-10 place-items-center rounded-full bg-[#f1f3f1] text-2xl" onClick={onClose} aria-label="Fermer">×</button></div>{children}</section></div>;
}

function ExpenseModal({ trip, expense, busy, onClose, onSave }: { trip: Trip; expense: Expense | null; busy: boolean; onClose: () => void; onSave: (expense: object) => Promise<void> }) {
  const initialIds = expense?.participantIds ?? trip.participants.map((participant) => participant.id);
  const [name, setName] = useState(expense?.name ?? "");
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : "");
  const [payerId, setPayerId] = useState(expense?.payerId ?? trip.participants[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">(expense?.splitMode ?? "equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>(Object.fromEntries((expense?.shares ?? []).map((share) => [share.participantId, centsToInput(share.amountCents)])));
  const [category, setCategory] = useState(expense?.category ?? "");
  const [date, setDate] = useState(expense?.date ?? "");
  const [bookingReference, setBookingReference] = useState(expense?.bookingReference ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [formError, setFormError] = useState("");

  const amountCents = parseMoneyToCents(amount);
  const equalPreview = amountCents && selectedIds.length ? splitEqually(amountCents, selectedIds) : [];

  function toggleParticipant(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function parseCustom(value: string) {
    if (value.trim() === "0" || value.trim() === "0,00" || value.trim() === "0.00") return 0;
    return parseMoneyToCents(value);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!amountCents) return setFormError("Saisissez un montant valide avec deux décimales maximum.");
    if (!selectedIds.length) return setFormError("Sélectionnez au moins un participant.");
    let shares: { participantId: string; amountCents: number }[] | undefined;
    if (splitMode === "custom") {
      const parsed = selectedIds.map((participantId) => ({ participantId, amountCents: parseCustom(customShares[participantId] ?? "") }));
      if (parsed.some((share) => share.amountCents === null)) return setFormError("Complétez toutes les parts personnalisées.");
      shares = parsed as { participantId: string; amountCents: number }[];
      const sum = shares.reduce((total, share) => total + share.amountCents, 0);
      if (sum !== amountCents) return setFormError(`Les parts totalisent ${formatMoney(sum, trip.currency)} au lieu de ${formatMoney(amountCents, trip.currency)}.`);
    }
    await onSave({ id: expense?.id, name, amountCents, payerId, participantIds: selectedIds, splitMode, shares, category: category || null, date: date || null, bookingReference: bookingReference || null, note: note || null });
  }

  return <ModalShell title={expense ? "Modifier la dépense" : "Nouvelle dépense"} onClose={onClose}>
    <form className="space-y-5" onSubmit={submit}>
      <div><label className="label" htmlFor="expense-name">Nom</label><input id="expense-name" className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Billets du match" maxLength={100} required autoFocus /></div>
      <div className="grid grid-cols-[1fr_112px] gap-3"><div><label className="label" htmlFor="amount">Montant total</label><div className="relative"><input id="amount" inputMode="decimal" className="field pr-12" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /><span className="absolute right-3 top-3 text-sm font-bold text-[var(--muted)]">{trip.currency}</span></div></div><div><label className="label" htmlFor="expense-date">Date</label><input id="expense-date" type="date" className="field px-2" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
      <div><label className="label" htmlFor="payer">Qui a payé ?</label><select id="payer" className="field" value={payerId} onChange={(event) => setPayerId(event.target.value)}>{trip.participants.map((participant) => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></div>
      <fieldset><legend className="label">Pour qui ?</legend><div className="grid grid-cols-2 gap-2">{trip.participants.map((participant) => <label key={participant.id} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${selectedIds.includes(participant.id) ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]"}`}><input type="checkbox" checked={selectedIds.includes(participant.id)} onChange={() => toggleParticipant(participant.id)} />{participant.name}</label>)}</div></fieldset>
      <fieldset><legend className="label">Répartition</legend><div className="grid grid-cols-2 rounded-xl bg-[#f0f2ef] p-1"><button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${splitMode === "equal" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setSplitMode("equal")}>Égale</button><button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${splitMode === "custom" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setSplitMode("custom")}>Personnalisée</button></div>
        {selectedIds.length > 0 && <div className="mt-3 space-y-2 rounded-xl border border-[var(--line)] p-3">{selectedIds.map((id) => { const equalShare = equalPreview.find((share) => share.participantId === id); return <div className="flex items-center gap-3" key={id}><span className="min-w-0 flex-1 truncate text-sm font-bold">{personName(trip, id)}</span>{splitMode === "equal" ? <strong className="text-sm">{equalShare ? formatMoney(equalShare.amountCents, trip.currency) : "—"}</strong> : <div className="relative w-32"><input className="field py-2 pr-10 text-right" inputMode="decimal" aria-label={`Part de ${personName(trip, id)}`} value={customShares[id] ?? ""} onChange={(event) => setCustomShares((current) => ({ ...current, [id]: event.target.value }))} placeholder="0,00" /><span className="absolute right-2 top-2.5 text-xs text-[var(--muted)]">{trip.currency}</span></div>}</div>; })}</div>}
      </fieldset>
      <div><label className="label" htmlFor="category">Catégorie <span className="font-normal text-[var(--muted)]">(facultatif)</span></label><select id="category" className="field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Sans catégorie</option>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></div>
      <div><label className="label" htmlFor="reference">Lien ou référence <span className="font-normal text-[var(--muted)]">(facultatif)</span></label><input id="reference" className="field" value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} maxLength={500} placeholder="N° de réservation ou URL" /></div>
      <div><label className="label" htmlFor="note">Note <span className="font-normal text-[var(--muted)]">(facultatif)</span></label><textarea id="note" className="field min-h-20 resize-y" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Informations utiles au groupe" /></div>
      {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{formError}</p>}
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-[var(--line)] bg-white px-5 pb-1 pt-4"><button type="button" className="secondary flex-1" onClick={onClose}>Annuler</button><button className="primary flex-[2]" disabled={busy}>{busy ? "Enregistrement…" : expense ? "Enregistrer" : "Ajouter la dépense"}</button></div>
    </form>
  </ModalShell>;
}

function SettlementModal({ trip, plan, busy, onClose, onSave }: { trip: Trip; plan: Transfer[]; busy: boolean; onClose: () => void; onSave: (value: { fromParticipantId: string; toParticipantId: string; amountCents: number; date: string; note: string | null }) => Promise<void> }) {
  const suggestion = plan[0];
  const [fromParticipantId, setFrom] = useState(suggestion?.fromParticipantId ?? trip.participants[0]?.id ?? "");
  const [toParticipantId, setTo] = useState(suggestion?.toParticipantId ?? trip.participants[1]?.id ?? "");
  const [amount, setAmount] = useState(suggestion ? centsToInput(suggestion.amountCents) : "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = parseMoneyToCents(amount);
    if (!amountCents) return setFormError("Saisissez un montant valide.");
    if (fromParticipantId === toParticipantId) return setFormError("Choisissez deux personnes différentes.");
    await onSave({ fromParticipantId, toParticipantId, amountCents, date, note: note || null });
  }
  return <ModalShell title="Enregistrer un remboursement" onClose={onClose}><form className="space-y-5" onSubmit={submit}>
    {suggestion && <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm leading-5 text-[var(--accent)]">Suggestion actuelle : <strong>{personName(trip, suggestion.fromParticipantId)}</strong> envoie <strong>{formatMoney(suggestion.amountCents, trip.currency)}</strong> à <strong>{personName(trip, suggestion.toParticipantId)}</strong>.</p>}
    <div><label className="label" htmlFor="settlement-from">Envoyé par</label><select id="settlement-from" className="field" value={fromParticipantId} onChange={(event) => setFrom(event.target.value)}>{trip.participants.map((participant) => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></div>
    <div><label className="label" htmlFor="settlement-to">Reçu par</label><select id="settlement-to" className="field" value={toParticipantId} onChange={(event) => setTo(event.target.value)}>{trip.participants.map((participant) => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="settlement-amount">Montant</label><input id="settlement-amount" className="field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></div><div><label className="label" htmlFor="settlement-date">Date</label><input id="settlement-date" className="field px-2" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div></div>
    <div><label className="label" htmlFor="settlement-note">Note <span className="font-normal text-[var(--muted)]">(facultatif)</span></label><input id="settlement-note" className="field" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></div>
    {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{formError}</p>}
    <div className="flex gap-2"><button type="button" className="secondary flex-1" onClick={onClose}>Annuler</button><button className="primary flex-[2]" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></div>
  </form></ModalShell>;
}

function SettingsModal({ trip, busy, onClose, onAction }: { trip: Trip; busy: boolean; onClose: () => void; onAction: (action: object) => Promise<boolean> }) {
  const [tripName, setTripName] = useState(trip.name);
  const [currency, setCurrency] = useState(trip.currency);
  const [newName, setNewName] = useState("");
  async function saveTrip(event: React.FormEvent) { event.preventDefault(); await onAction({ action: "updateTrip", name: tripName, currency }); }
  async function addParticipant(event: React.FormEvent) { event.preventDefault(); if (newName.trim() && await onAction({ action: "addParticipant", name: newName })) setNewName(""); }
  async function updateParticipant(participant: Participant, name: string) { if (name.trim() && name !== participant.name) await onAction({ action: "updateParticipant", id: participant.id, name }); }
  async function removeParticipant(participant: Participant) { if (window.confirm(`Supprimer ${participant.name} du voyage ?`)) await onAction({ action: "deleteParticipant", id: participant.id }); }
  return <ModalShell title="Gérer le voyage" onClose={onClose}>
    <form className="space-y-4 border-b border-[var(--line)] pb-5" onSubmit={saveTrip}>
      <div><label className="label" htmlFor="settings-name">Nom du voyage</label><input id="settings-name" className="field" value={tripName} onChange={(event) => setTripName(event.target.value)} maxLength={100} required /></div>
      <div><label className="label" htmlFor="settings-currency">Devise</label><select id="settings-currency" className="field" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option></select></div>
      <button className="secondary w-full" disabled={busy}>Enregistrer les informations</button>
    </form>
    <div className="py-5"><h3 className="mb-3 text-lg font-black">Participants</h3><div className="space-y-2">{trip.participants.map((participant) => <ParticipantRow key={`${participant.id}-${participant.name}`} participant={participant} busy={busy} onSave={updateParticipant} onDelete={removeParticipant} />)}</div>
      <form className="mt-4 flex gap-2" onSubmit={addParticipant}><input className="field" aria-label="Nom du nouveau participant" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nouveau prénom" maxLength={100} /><button className="primary shrink-0" disabled={busy || !newName.trim()}>Ajouter</button></form>
    </div>
    <button className="secondary w-full" onClick={onClose}>Fermer</button>
  </ModalShell>;
}

function ParticipantRow({ participant, busy, onSave, onDelete }: { participant: Participant; busy: boolean; onSave: (participant: Participant, name: string) => Promise<void>; onDelete: (participant: Participant) => Promise<void> }) {
  const [name, setName] = useState(participant.name);
  return <div className="flex gap-2"><input className="field" aria-label={`Nom de ${participant.name}`} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => onSave(participant, name)} maxLength={100} /><button className="secondary danger px-3" disabled={busy} aria-label={`Supprimer ${participant.name}`} onClick={() => onDelete(participant)}>×</button></div>;
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTripForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [participants, setParticipants] = useState(["", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const participantNames = participants.map((item) => item.trim()).filter(Boolean);
    if (!name.trim() || participantNames.length === 0) {
      setError("Donnez un nom au voyage et ajoutez au moins une personne.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, currency, participantNames }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Création impossible");
      router.push(`/v/${result.token}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5" aria-label="Créer un voyage">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Nouveau voyage</h2>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]">Gratuit</span>
      </div>
      <div>
        <label className="label" htmlFor="trip-name">Nom du voyage</label>
        <input id="trip-name" className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Week-end à Lisbonne" maxLength={100} required />
      </div>
      <div>
        <label className="label" htmlFor="currency">Devise</label>
        <select id="currency" className="field" value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="EUR">EUR — Euro</option>
          <option value="USD">USD — Dollar américain</option>
          <option value="GBP">GBP — Livre sterling</option>
          <option value="CHF">CHF — Franc suisse</option>
        </select>
      </div>
      <fieldset>
        <legend className="label">Participants</legend>
        <div className="space-y-2">
          {participants.map((participant, index) => (
            <div className="flex gap-2" key={index}>
              <input className="field" aria-label={`Participant ${index + 1}`} value={participant} onChange={(event) => setParticipants((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={index === 0 ? "Votre prénom" : "Prénom"} maxLength={100} />
              {participants.length > 1 && <button type="button" className="secondary px-3 danger" aria-label={`Supprimer le participant ${index + 1}`} onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
            </div>
          ))}
        </div>
        {participants.length < 30 && <button type="button" className="mt-3 text-sm font-bold text-[var(--accent)]" onClick={() => setParticipants((current) => [...current, ""])}>+ Ajouter une personne</button>}
      </fieldset>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <button className="primary w-full py-3.5" disabled={loading}>{loading ? "Création…" : "Créer le voyage"}</button>
    </form>
  );
}


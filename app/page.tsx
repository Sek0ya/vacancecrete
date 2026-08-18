import { CreateTripForm } from "@/components/create-trip-form";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-8 sm:py-14">
      <div className="mb-9 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-black text-white">T</div>
        <div>
          <p className="text-xl font-black tracking-tight">TripSplit</p>
          <p className="text-sm text-[var(--muted)]">Les comptes du voyage, sans prise de tête.</p>
        </div>
      </div>

      <section className="mb-8">
        <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-[var(--accent)]">Simple et partagé</p>
        <h1 className="max-w-md text-4xl font-black leading-[1.06] tracking-[-.04em]">Profitez du voyage.<br />On s’occupe des comptes.</h1>
        <p className="mt-4 max-w-md text-base leading-7 text-[var(--muted)]">Créez un voyage, partagez son lien privé et ajoutez les dépenses depuis n’importe quel téléphone.</p>
      </section>

      <CreateTripForm />

      <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">Aucun compte à créer. Le lien privé donne accès au voyage&nbsp;: partagez-le uniquement avec votre groupe.</p>
    </main>
  );
}


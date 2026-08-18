import type { Metadata } from "next";
import Link from "next/link";
import { TripDashboard } from "@/components/trip-dashboard";
import { getTrip } from "@/lib/repository";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Voyage",
  robots: { index: false, follow: false },
};

export default async function TripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let trip: Trip | null = null;
  let loadError = "Ce voyage est introuvable.";
  try {
    trip = await getTrip(token);
  } catch (error) {
    loadError = error instanceof Error ? error.message : loadError;
  }
  if (trip) return <TripDashboard initialTrip={trip} token={token} />;
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5 text-center">
      <div className="card p-7">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-red-50 text-2xl">!</div>
        <h1 className="text-2xl font-black">Lien de voyage invalide</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{loadError}</p>
        <Link href="/" className="primary mt-6 inline-block">Créer un nouveau voyage</Link>
      </div>
    </main>
  );
}


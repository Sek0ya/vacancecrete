# TripSplit

Suivi mobile de dépenses partagées, sans compte utilisateur.

## Configuration

1. Créez un projet Supabase et exécutez `supabase/001_initial.sql` dans l’éditeur SQL. `supabase/seed.sql` est facultatif.
2. Copiez `.env.example` vers `.env.local`, puis renseignez `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (clé strictement serveur).
3. Lancez :

```bash
npm install
npm run dev
```

Vérifications : `npm test && npm run lint && npm run typecheck && npm run build`.

Pour tester sans Supabase, utilisez uniquement en local `TRIPSPLIT_DEMO_MODE=true`, puis ouvrez `/v/demo-voyage-ete-2026`.


-- Données facultatives. Supprimez ce fichier ou n’exécutez pas cette section.
-- Lien de démonstration : /v/demo-lisbonne-2026
insert into public.trips (id, name, currency, access_token_hash)
values ('10000000-0000-4000-8000-000000000001', 'Week-end à Lisbonne', 'EUR', encode(digest('demo-lisbonne-2026', 'sha256'), 'hex'));

insert into public.participants (id, trip_id, name, position) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Lucas', 0),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Paul', 1),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Inès', 2);

insert into public.expenses (id, trip_id, name, amount_cents, payer_id, split_mode, category, expense_date, note)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Appartement', 36000, '20000000-0000-4000-8000-000000000002', 'equal', 'logement', current_date, 'Trois nuits dans le centre');

insert into public.expense_shares (expense_id, participant_id, trip_id, amount_cents) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 12000),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 12000),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 12000);


create extension if not exists pgcrypto;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  currency varchar(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  access_token_hash text not null unique check (char_length(access_token_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (id, trip_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  amount_cents bigint not null check (amount_cents > 0),
  payer_id uuid not null,
  split_mode text not null check (split_mode in ('equal', 'custom')),
  category text check (category is null or category in ('activité', 'transport', 'nourriture', 'logement', 'billets', 'autre')),
  expense_date date,
  booking_reference text check (booking_reference is null or char_length(booking_reference) <= 500),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id),
  foreign key (payer_id, trip_id) references public.participants(id, trip_id) on delete restrict
);

create table public.expense_shares (
  expense_id uuid not null,
  participant_id uuid not null,
  trip_id uuid not null,
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (expense_id, participant_id),
  foreign key (expense_id, trip_id) references public.expenses(id, trip_id) on delete cascade,
  foreign key (participant_id, trip_id) references public.participants(id, trip_id) on delete restrict
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_participant_id uuid not null,
  to_participant_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  settlement_date date not null default current_date,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (from_participant_id <> to_participant_id),
  foreign key (from_participant_id, trip_id) references public.participants(id, trip_id) on delete restrict,
  foreign key (to_participant_id, trip_id) references public.participants(id, trip_id) on delete restrict
);

create index participants_trip_id_idx on public.participants(trip_id);
create index expenses_trip_id_idx on public.expenses(trip_id);
create index expense_shares_trip_id_idx on public.expense_shares(trip_id);
create index settlements_trip_id_idx on public.settlements(trip_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_updated_at before update on public.trips
for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
alter table public.participants enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

-- Aucun accès direct navigateur : l’API Next.js valide le jeton privé et utilise
-- exclusivement la clé service_role côté serveur.
revoke all on public.trips from anon, authenticated;
revoke all on public.participants from anon, authenticated;
revoke all on public.expenses from anon, authenticated;
revoke all on public.expense_shares from anon, authenticated;
revoke all on public.settlements from anon, authenticated;


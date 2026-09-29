-- Kioku 記憶 — à exécuter UNE fois dans Supabase : SQL Editor → New query → coller → Run
-- Une ligne par utilisateur, contenant toute sa progression au format JSON.

create table if not exists public.kioku_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque utilisateur ne voit et ne modifie QUE sa propre ligne.
alter table public.kioku_state enable row level security;

drop policy if exists "kioku_select_own" on public.kioku_state;
drop policy if exists "kioku_insert_own" on public.kioku_state;
drop policy if exists "kioku_update_own" on public.kioku_state;

create policy "kioku_select_own" on public.kioku_state
  for select using (auth.uid() = user_id);

create policy "kioku_insert_own" on public.kioku_state
  for insert with check (auth.uid() = user_id);

create policy "kioku_update_own" on public.kioku_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

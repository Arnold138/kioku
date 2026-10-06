-- Kioku 記憶 — OPTIONNEL (v1.3) : historique des sauvegardes dans ton compte cloud.
-- À exécuter UNE fois dans Supabase : SQL Editor → New query → coller → Run.
-- Sans ça, l'app garde quand même des points de restauration sur chaque appareil.
-- Ça ne touche pas à la table kioku_state (ta progression actuelle).

create table if not exists public.kioku_snapshots (
  user_id  uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  data     jsonb not null,
  primary key (user_id, taken_on)
);

alter table public.kioku_snapshots enable row level security;

drop policy if exists "kioku_snap_select_own" on public.kioku_snapshots;
drop policy if exists "kioku_snap_insert_own" on public.kioku_snapshots;
drop policy if exists "kioku_snap_update_own" on public.kioku_snapshots;
drop policy if exists "kioku_snap_delete_own" on public.kioku_snapshots;

create policy "kioku_snap_select_own" on public.kioku_snapshots for select using (auth.uid() = user_id);
create policy "kioku_snap_insert_own" on public.kioku_snapshots for insert with check (auth.uid() = user_id);
create policy "kioku_snap_update_own" on public.kioku_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kioku_snap_delete_own" on public.kioku_snapshots for delete using (auth.uid() = user_id);

-- ============================================================
-- CLA021POKER - Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- ── Salas ──────────────────────────────────────────────────
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text,
  revealed    boolean not null default false,
  current_story text default '',
  facilitator_id uuid,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Participantes ───────────────────────────────────────────
create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references rooms(id) on delete cascade,
  user_key      text not null,          -- client-generated anonymous ID
  name          text not null,
  avatar        text not null,
  is_facilitator boolean default false,
  is_online     boolean default true,
  joined_at     timestamptz default now(),
  unique(room_id, user_key)
);

-- ── Votos ───────────────────────────────────────────────────
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  user_key    text not null,
  value       text not null,
  created_at  timestamptz default now(),
  unique(room_id, user_key)
);

-- ── Historial de rondas ─────────────────────────────────────
create table if not exists rounds (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  story       text not null,
  votes_snapshot  jsonb not null default '{}',
  participants_snapshot jsonb not null default '{}',
  average     text,
  created_at  timestamptz default now()
);

-- ── Índices ─────────────────────────────────────────────────
create index if not exists idx_rooms_code on rooms(code);
create index if not exists idx_participants_room on participants(room_id);
create index if not exists idx_votes_room on votes(room_id);
create index if not exists idx_rounds_room on rounds(room_id);

-- ── RLS (Row Level Security) ────────────────────────────────
-- Habilitamos RLS pero permitimos todo con anon key (app pública)
alter table rooms        enable row level security;
alter table participants enable row level security;
alter table votes        enable row level security;
alter table rounds       enable row level security;

-- Políticas permisivas para usuarios anónimos
create policy "rooms_all"        on rooms        for all using (true) with check (true);
create policy "participants_all" on participants for all using (true) with check (true);
create policy "votes_all"        on votes        for all using (true) with check (true);
create policy "rounds_all"       on rounds       for all using (true) with check (true);

-- ── Realtime ────────────────────────────────────────────────
-- Habilitar realtime para las tablas necesarias
-- En Supabase Dashboard: Database > Replication > habilitar estas tablas
-- O ejecutar:
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table rounds;

-- ── Función para limpiar salas viejas (opcional) ────────────
create or replace function cleanup_old_rooms()
returns void language plpgsql as $$
begin
  delete from rooms where updated_at < now() - interval '24 hours';
end;
$$;

-- Survive the Syllabus — Supabase kurulumu
-- Supabase > SQL Editor > New query içine yapıştırıp RUN'a bas.

-- 1) Oyun kayıtları ve sıralama tek tabloda tutulur
create table if not exists public.kv (
  path text primary key,
  owner uuid not null default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.kv enable row level security;

-- Herkes kendi kaydını, giriş yapmış herkes sıralamayı okuyabilir
drop policy if exists "kv_select" on public.kv;
create policy "kv_select" on public.kv for select to authenticated
  using (owner = auth.uid() or path like 'board/%');

-- Herkes sadece kendi kaydına ve kendi sıralama satırına yazabilir
drop policy if exists "kv_insert" on public.kv;
create policy "kv_insert" on public.kv for insert to authenticated
  with check (owner = auth.uid() and (path = 'board/' || auth.uid()::text or path like 'data/users/' || auth.uid()::text || '/%'));

drop policy if exists "kv_update" on public.kv;
create policy "kv_update" on public.kv for update to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and (path = 'board/' || auth.uid()::text or path like 'data/users/' || auth.uid()::text || '/%'));

-- Not: Eski sürümden kalan ai_usage tablosu varsa silebilirsin:
-- drop function if exists public.bump_ai_usage(uuid,int); drop table if exists public.ai_usage;

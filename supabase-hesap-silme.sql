-- Survive the Syllabus — hesap silme özelliği (bir kez çalıştır)
-- Supabase > SQL Editor > New query içine yapıştırıp RUN'a bas.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.kv where owner = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

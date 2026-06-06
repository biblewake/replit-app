-- ──────────────────────────────────────────────────────────
-- delete_user() RPC
--     Deletes all rows belonging to the calling user across
--     every table, then removes the auth.users entry.
--     Called client-side as: supabase.rpc('delete_user')
-- ──────────────────────────────────────────────────────────
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.wake_history       where user_id = _uid;
  delete from public.verse_stats        where user_id = _uid;
  delete from public.alarms             where user_id = _uid;
  delete from public.streaks            where user_id = _uid;
  delete from public.onboarding_answers where user_id = _uid;
  delete from public.users              where id = _uid;

  -- Remove the auth.users row — cascades handle any remaining FK references
  delete from auth.users where id = _uid;
end;
$$;

-- Only authenticated users may call this RPC (they can only delete themselves)
revoke all on function public.delete_user() from public;
grant execute on function public.delete_user() to authenticated;

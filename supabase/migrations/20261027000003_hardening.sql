-- Supabase advisor fixes: pin search_path on the trigger function; is_member() is for signed-in users only.
-- is_email_allowed() stays callable by anon on purpose (the login page refuses non-allowlisted emails),
-- which means anyone can test whether an email is on the allowlist.
alter function public.touch_updated_at() set search_path = public;
revoke execute on function public.is_member() from anon, public;
grant execute on function public.is_member() to authenticated;
revoke execute on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

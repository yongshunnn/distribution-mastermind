-- Private bucket for label artwork, contracts, evidence photos (spec §3).
-- Guarded so the migration also runs on a plain Postgres used for local RLS tests.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('files', 'files', false)
      on conflict (id) do nothing;
    execute $p$create policy "members read files" on storage.objects for select to authenticated
              using (bucket_id = 'files' and public.is_member())$p$;
    execute $p$create policy "members write files" on storage.objects for insert to authenticated
              with check (bucket_id = 'files' and public.is_member())$p$;
    execute $p$create policy "members update files" on storage.objects for update to authenticated
              using (bucket_id = 'files' and public.is_member())$p$;
    execute $p$create policy "members delete files" on storage.objects for delete to authenticated
              using (bucket_id = 'files' and public.is_member())$p$;
  end if;
end $$;

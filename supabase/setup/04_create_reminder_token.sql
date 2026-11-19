-- Administrator only. The final result is SECRET: copy to Supabase, not chat/GitHub.
begin;
do $$ begin
 if not exists(select 1 from vault.secrets where name='orbit_reminder_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'orbit_reminder_token','Scoped Sugar Orbits reminder scheduler token');
 end if;
end $$;
commit;
select decrypted_secret as copy_to_ORBIT_REMINDER_TOKEN
from vault.decrypted_secrets where name='orbit_reminder_token';

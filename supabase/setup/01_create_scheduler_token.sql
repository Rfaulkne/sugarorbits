-- SQL Editor, administrator only. This returns a SECRET. Do not share its output.
-- Re-running reuses the existing token rather than breaking the deployed function.
begin;
do $$
begin
  if not exists(select 1 from vault.secrets where name='orbit_dexcom_sync_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
      'orbit_dexcom_sync_token','Scoped token for Sugar Orbits scheduled Dexcom sync');
  end if;
end $$;
commit;
-- Copy ONLY into Edge Functions → Secrets as DEXCOM_SYNC_TOKEN. Never into chat.
select decrypted_secret as copy_to_DEXCOM_SYNC_TOKEN
from vault.decrypted_secrets where name='orbit_dexcom_sync_token';

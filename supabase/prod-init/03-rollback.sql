-- 失败处理 F3：只在“初始化已提交、但需要撤回”且 progress 表里还没有任何进度时使用（需要另行授权）。
-- 有进度行就拒绝执行，避免删掉用户数据；那种情况改为前进修复，不回滚。
begin;
do $$ begin
  if to_regclass('public.progress') is not null and (select count(*) from public.progress) > 0 then
    raise exception '拒绝回滚：progress 已有 % 行用户进度', (select count(*) from public.progress);
  end if;
end $$;
drop function if exists public.create_progress(jsonb);
drop function if exists public.save_progress(integer, jsonb);
drop function if exists public.delete_my_account();
drop table if exists public.progress;
commit;

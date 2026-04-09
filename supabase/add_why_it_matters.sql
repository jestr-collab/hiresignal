-- Run in Supabase SQL editor if `signals` already exists without this column.
alter table signals add column if not exists why_it_matters text;

create extension if not exists "pgcrypto";

create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,        -- e.g. 'slt', 'company-a'
  name          text not null,
  status        text not null default 'active',  -- active | trial | suspended
  deploy_mode   text not null default 'pool',     -- pool | silo
  created_at    timestamptz not null default now()
);

create table tenant_config (
  tenant_id         uuid primary key references tenants(id) on delete cascade,
  persona_name      text not null default 'Nila',
  system_prompt     text,
  avatar_model_url  text default '/avatar.glb',
  brand_color       text default '1E2761',
  default_language  text default 'en',
  tools_enabled     jsonb not null default '["search_knowledge_base"]'
);

create table knowledge_sources (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  seed_url        text not null,
  domain_label    text not null default 'general',
  last_indexed_at timestamptz
);

create table tenant_users (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade,  -- NULL for super_admin
  email       text unique not null,
  role        text not null,   -- super_admin | tenant_admin | agent_user
  created_at  timestamptz not null default now()
);

create table api_keys (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  provider        text not null,   -- openai | groq | google | pinecone
  encrypted_key   text not null
);

create table sessions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  external_session_id  text not null,
  created_at           timestamptz not null default now()
);

create table turns (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  role        text not null,   -- user | assistant
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Row Level Security: every tenant-scoped table only shows rows for the
-- tenant set on the current connection (app.tenant_id), except super_admin.
alter table tenant_config      enable row level security;
alter table knowledge_sources  enable row level security;
alter table tenant_users       enable row level security;
alter table api_keys           enable row level security;
alter table sessions           enable row level security;
alter table turns              enable row level security;

create policy tenant_isolation on tenant_config
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy tenant_isolation on knowledge_sources
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy tenant_isolation on sessions
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy tenant_isolation on turns
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- super_admin role bypasses RLS entirely (SLT's connection uses this role)
create role workmate_super_admin bypassrls;
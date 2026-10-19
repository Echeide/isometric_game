CREATE TABLE IF NOT EXISTS platform_tenants(id text PRIMARY KEY,name text NOT NULL,enabled boolean NOT NULL DEFAULT true,limits jsonb NOT NULL,permissions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_users(id text PRIMARY KEY,username text NOT NULL UNIQUE,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('admin','superadmin')),tenant_id text REFERENCES platform_tenants(id),enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),CHECK((role='admin' AND tenant_id IS NOT NULL) OR (role='superadmin' AND tenant_id IS NULL)));
CREATE TABLE IF NOT EXISTS platform_sessions(id text PRIMARY KEY,token_hash text NOT NULL UNIQUE,actor_id text NOT NULL REFERENCES platform_users(id),effective_id text REFERENCES platform_users(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_login_attempts(key text PRIMARY KEY,attempts integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS platform_audit(id bigserial PRIMARY KEY,actor_id text,effective_id text,tenant_id text,action text NOT NULL,target text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_adventures(tenant_id text NOT NULL REFERENCES platform_tenants(id),id text NOT NULL,definition jsonb NOT NULL,graphics jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS platform_assets(tenant_id text NOT NULL REFERENCES platform_tenants(id),id text NOT NULL,hash text NOT NULL,bytes bigint NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS platform_resources(id text PRIMARY KEY,tenant_id text REFERENCES platform_tenants(id),scope text NOT NULL CHECK(scope IN ('tenant','global')),summary jsonb NOT NULL,hash text NOT NULL,bytes bigint NOT NULL,source_id text,visible boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),CHECK((scope='tenant' AND tenant_id IS NOT NULL) OR (scope='global' AND tenant_id IS NULL)));
CREATE TABLE IF NOT EXISTS platform_publications(slug text PRIMARY KEY,tenant_id text NOT NULL REFERENCES platform_tenants(id),adventure_id text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',definition jsonb NOT NULL,graphics jsonb NOT NULL,asset_ids jsonb NOT NULL,active boolean NOT NULL DEFAULT true,published_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,adventure_id));
CREATE TABLE IF NOT EXISTS platform_usage(tenant_id text NOT NULL REFERENCES platform_tenants(id),month text NOT NULL,kind text NOT NULL,used integer NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,month,kind));
ALTER TABLE platform_adventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_adventures FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_usage FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='platform_adventures' AND policyname='tenant_boundary') THEN
  CREATE POLICY tenant_boundary ON platform_adventures USING(tenant_id=current_setting('platform.tenant',true) OR current_setting('platform.system',true)='yes');
  CREATE POLICY tenant_boundary ON platform_assets USING(tenant_id=current_setting('platform.tenant',true) OR current_setting('platform.system',true)='yes');
  CREATE POLICY tenant_boundary ON platform_usage USING(tenant_id=current_setting('platform.tenant',true) OR current_setting('platform.system',true)='yes');
  CREATE POLICY resource_read ON platform_resources FOR SELECT USING(tenant_id=current_setting('platform.tenant',true) OR scope='global' OR current_setting('platform.system',true)='yes');
  CREATE POLICY resource_insert ON platform_resources FOR INSERT WITH CHECK((scope='tenant' AND tenant_id=current_setting('platform.tenant',true)) OR current_setting('platform.system',true)='yes');
  CREATE POLICY resource_update ON platform_resources FOR UPDATE USING(tenant_id=current_setting('platform.tenant',true) OR current_setting('platform.system',true)='yes') WITH CHECK(tenant_id=current_setting('platform.tenant',true) OR current_setting('platform.system',true)='yes');
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS platform_releases(id text PRIMARY KEY,slug text NOT NULL,tenant_id text NOT NULL REFERENCES platform_tenants(id),definition jsonb NOT NULL,graphics jsonb NOT NULL,asset_ids jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE platform_publications ADD COLUMN IF NOT EXISTS release_id text REFERENCES platform_releases(id);

-- Legacy rows without a key continue reading local blobs/{hash}.
ALTER TABLE platform_assets ADD COLUMN IF NOT EXISTS storage_backend text;
ALTER TABLE platform_assets ADD COLUMN IF NOT EXISTS storage_key text;
ALTER TABLE platform_resources ADD COLUMN IF NOT EXISTS storage_backend text;
ALTER TABLE platform_resources ADD COLUMN IF NOT EXISTS storage_key text;
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS cartridge_backend text;
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS cartridge_prefix text;
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS cartridge_manifest jsonb;
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS cartridge_bytes bigint NOT NULL DEFAULT 0;

-- Playing identities never grant access to the authoring platform.
CREATE TABLE IF NOT EXISTS platform_players(id text PRIMARY KEY,username text NOT NULL UNIQUE,password_hash text NOT NULL,enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_player_sessions(id text PRIMARY KEY,token_hash text NOT NULL UNIQUE,player_id text NOT NULL REFERENCES platform_players(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS player_session_expiry ON platform_player_sessions(expires_at);
CREATE TABLE IF NOT EXISTS platform_game_saves(
 owner_key text NOT NULL,scope_key text NOT NULL,
 player_id text REFERENCES platform_players(id) ON DELETE CASCADE,user_id text REFERENCES platform_users(id) ON DELETE CASCADE,
 tenant_id text NOT NULL REFERENCES platform_tenants(id),adventure_id text NOT NULL,
 publication_slug text REFERENCES platform_publications(slug) ON DELETE CASCADE,release_id text REFERENCES platform_releases(id) ON DELETE SET NULL,
 state jsonb NOT NULL,revision integer NOT NULL CHECK(revision>0),write_id text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_key,scope_key),FOREIGN KEY(tenant_id,adventure_id) REFERENCES platform_adventures(tenant_id,id) ON DELETE CASCADE,
 CHECK((player_id IS NULL)<>(user_id IS NULL)),
 CHECK(owner_key=CASE WHEN player_id IS NOT NULL THEN 'player:'||player_id ELSE 'admin:'||user_id END)
);
ALTER TABLE platform_game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_game_saves FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='platform_game_saves' AND policyname='player_save_boundary') THEN
  CREATE POLICY player_save_boundary ON platform_game_saves
   USING(owner_key=current_setting('platform.save_owner',true) AND scope_key=current_setting('platform.save_scope',true))
   WITH CHECK(owner_key=current_setting('platform.save_owner',true) AND scope_key=current_setting('platform.save_scope',true));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS company_module_overrides (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS branch_module_overrides (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  options_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some test data for tenant isolation testing
INSERT INTO companies (id, name, is_active) VALUES ('company_a', 'Test Company A', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO companies (id, name, is_active) VALUES ('company_b', 'Test Company B', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, uid, email, name, role, company_id) VALUES ('usr_test_a', 'test_uid_user_a', 'usera@test.com', 'Admin A', 'ADMIN', 'company_a') ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', company_id = 'company_a';
INSERT INTO users (id, uid, email, name, role, company_id) VALUES ('usr_test_b', 'test_uid_user_b', 'userb@test.com', 'Admin B', 'ADMIN', 'company_b') ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', company_id = 'company_b';
INSERT INTO users (id, uid, email, name, role, company_id) VALUES ('usr_test_c', 'test_uid_cashier', 'cashier@test.com', 'Cashier A', 'CASHIER', 'company_a') ON CONFLICT (id) DO UPDATE SET role = 'CASHIER', company_id = 'company_a';

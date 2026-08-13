import fs from 'fs';

let repo = fs.readFileSync('src/db/repository.ts', 'utf8');

// 1. Add migration statements
const oldMig = `    const migrationStatements = [
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code text\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_card_id text\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS card_status text DEFAULT 'ACTIVE'\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE'\`,
      \`CREATE UNIQUE INDEX IF NOT EXISTS users_employee_card_id_idx ON users(employee_card_id) WHERE employee_card_id IS NOT NULL\`,
      \`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id text\`
    ];`;

const newMig = `    const migrationStatements = [
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code text\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_card_id text\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS card_status text DEFAULT 'ACTIVE'\`,
      \`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE'\`,
      \`CREATE UNIQUE INDEX IF NOT EXISTS users_employee_card_id_idx ON users(employee_card_id) WHERE employee_card_id IS NOT NULL\`,
      \`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id text\`,
      \`ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_attributes jsonb DEFAULT '{}'\`,
      \`ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_attributes jsonb DEFAULT '{}'\`,
      \`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS custom_attributes jsonb DEFAULT '{}'\`,
      \`ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_attributes jsonb DEFAULT '{}'\`,
      \`ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS default_value text\`,
      \`ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0\`,
      \`ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true\`,
      \`ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS industry text\`,
      \`ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS module text\`,
      \`CREATE INDEX IF NOT EXISTS products_custom_attr_gin ON products USING gin (custom_attributes)\`,
      \`CREATE INDEX IF NOT EXISTS customers_custom_attr_gin ON customers USING gin (custom_attributes)\`,
      \`CREATE INDEX IF NOT EXISTS suppliers_custom_attr_gin ON suppliers USING gin (custom_attributes)\`,
      \`CREATE INDEX IF NOT EXISTS employees_custom_attr_gin ON employees USING gin (custom_attributes)\`
    ];`;

if (repo.includes("ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_attributes")) {
  console.log("Migrations already present.");
} else {
  repo = repo.replace(oldMig, newMig);
}

// 2. Add validation helper and update custom field repo functions at the bottom
const validationHelper = `
export async function validateAndSanitizeCustomAttributes(companyId: string, entityType: string, customAttrs: any) {
  const definitions = await getCustomFieldDefinitions(companyId, entityType);
  const sanitized: Record<string, any> = {};
  const attrs = customAttrs || {};

  for (const def of definitions) {
    const val = attrs[def.fieldKey] !== undefined ? attrs[def.fieldKey] : def.defaultValue;
    
    if (def.isRequired && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
      throw new Error(\`الحقل الإلزامي "\${def.label}" (\${def.fieldKey}) مفقود.\`);
    }

    if (val !== undefined && val !== null && val !== '') {
      if (def.dataType === 'NUMBER') {
        const num = Number(val);
        if (isNaN(num)) throw new Error(\`الحقل "\${def.label}" يجب أن يكون رقماً.\`);
        sanitized[def.fieldKey] = num;
      } else if (def.dataType === 'BOOLEAN') {
        sanitized[def.fieldKey] = Boolean(val);
      } else if (def.dataType === 'SELECT') {
        const opts = (def.optionsJson as string[]) || [];
        if (opts.length > 0 && !opts.includes(String(val))) {
          throw new Error(\`القيمة "\${val}" غير صالحة للحقل "\${def.label}".\`);
        }
        sanitized[def.fieldKey] = val;
      } else if (def.dataType === 'MULTI_SELECT') {
        const opts = (def.optionsJson as string[]) || [];
        const arr = Array.isArray(val) ? val : [val];
        for (const v of arr) {
          if (opts.length > 0 && !opts.includes(String(v))) {
            throw new Error(\`القيمة "\${v}" غير صالحة للحقل "\${def.label}".\`);
          }
        }
        sanitized[def.fieldKey] = arr;
      } else {
        sanitized[def.fieldKey] = String(val);
      }
    }
  }

  // Historical Safety: preserve unlisted attributes
  for (const key of Object.keys(attrs)) {
    if (sanitized[key] === undefined) {
      sanitized[key] = attrs[key];
    }
  }

  return sanitized;
}

export async function deleteCustomFieldDefinition(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(customFieldDefinitions).where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.companyId, cId)));
  return true;
}
`;

if (!repo.includes("validateAndSanitizeCustomAttributes")) {
  repo = repo.replace(/\/\/\s*END_OF_REPOSITORY_FUNCTIONS/, validationHelper + "\n// END_OF_REPOSITORY_FUNCTIONS");
  if (!repo.includes("deleteCustomFieldDefinition")) {
    repo = repo.replace("export async function createCustomFieldDefinition", validationHelper + "\nexport async function createCustomFieldDefinition");
  }
}

fs.writeFileSync('src/db/repository.ts', repo);
console.log('Successfully updated src/db/repository.ts');

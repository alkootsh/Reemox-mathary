import fs from 'fs';

let schema = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!schema.includes("customAttributes")) {
  schema = schema.replace(
    /export const products = pgTable\('products', \{([\s\S]*?)\}\);/,
    `export const products = pgTable('products', {$1\n  customAttributes: jsonb('custom_attributes').default({}),\n});`
  );
  schema = schema.replace(
    /export const customers = pgTable\('customers', \{([\s\S]*?)\}\);/,
    `export const customers = pgTable('customers', {$1\n  customAttributes: jsonb('custom_attributes').default({}),\n});`
  );
  schema = schema.replace(
    /export const suppliers = pgTable\('suppliers', \{([\s\S]*?)\}\);/,
    `export const suppliers = pgTable('suppliers', {$1\n  customAttributes: jsonb('custom_attributes').default({}),\n});`
  );
  schema = schema.replace(
    /export const employees = pgTable\('employees', \{([\s\S]*?)\}\);/,
    `export const employees = pgTable('employees', {$1\n  customAttributes: jsonb('custom_attributes').default({}),\n});`
  );
}

const newCfd = `export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  entityType: text('entity_type').notNull(), // PRODUCT, CUSTOMER, SUPPLIER, EMPLOYEE
  fieldKey: text('field_key').notNull(),
  label: text('label').notNull(),
  dataType: text('data_type').notNull(), // TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT
  isRequired: boolean('is_required').default(false),
  defaultValue: text('default_value'),
  displayOrder: integer('display_order').default(0),
  isVisible: boolean('is_visible').default(true),
  industry: text('industry'),
  module: text('module'),
  optionsJson: jsonb('options_json').default([]), // For SELECT / MULTI_SELECT fields
  createdAt: timestamp('created_at').defaultNow()
});`;

if (schema.includes("export const customFieldDefinitions")) {
  // Remove old customFieldDefinitions block and append new one
  const idx = schema.indexOf("export const customFieldDefinitions");
  // Find matching closing brace
  let braceCount = 0;
  let endIdx = idx;
  let started = false;
  for (let i = idx; i < schema.length; i++) {
    if (schema[i] === '{') {
      braceCount++;
      started = true;
    } else if (schema[i] === '}') {
      braceCount--;
    }
    if (started && braceCount === 0) {
      endIdx = i + 2; // include );
      break;
    }
  }
  schema = schema.slice(0, idx) + newCfd + schema.slice(endIdx);
} else {
  schema += `\n\n${newCfd}\n`;
}

fs.writeFileSync('src/db/schema.ts', schema);
console.log('Successfully updated src/db/schema.ts');

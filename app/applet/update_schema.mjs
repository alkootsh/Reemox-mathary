import fs from 'fs';

let schema = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!schema.includes("customAttributes: jsonb('custom_attributes')")) {
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
  schema = schema.replace(/export const customFieldDefinitions = pgTable\([\s\S]*?\n\});/, newCfd);
} else {
  schema += `\n\n${newCfd}\n`;
}

fs.writeFileSync('src/db/schema.ts', schema);
console.log('Successfully updated src/db/schema.ts');

import { createPool } from './src/db/index.ts';
const pool = createPool();
async function testInsert() {
  try {
    const res = await pool.query(
      `INSERT INTO products (id, company_id, sku, barcode, name, price, wholesale_price, half_wholesale_price, min_price, cost_price, stock, min_stock, category_id, brand_id, unit_id, is_weighted, custom_attributes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT (id) DO UPDATE SET name = $5 RETURNING id, custom_attributes`,
      ['prod_test_123', 'company_default', 'SKU-123', '', 'Test Product', '100', '0', '0', '0', '0', '10', '0', null, null, null, false, JSON.stringify({ warranty_months: 24 })]
    );
    console.log('Insert success:', res.rows);
  } catch (err) {
    console.error('Insert error:', err);
  } finally {
    await pool.end();
  }
}
testInsert();

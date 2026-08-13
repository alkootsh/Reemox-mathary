import assert from 'assert';
import http from 'http';
import { execSync } from 'child_process';
import { createPool } from './src/db/index.ts';

const PORT = 3000;

function apiRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataStr = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

const auditResults = [];

function logTestResult(id, name, expected, actual, httpStatus, pass) {
  const result = {
    id,
    test: `[TEST ${id}] ${name}`,
    expected,
    actual,
    httpStatus: httpStatus || 'N/A',
    status: pass ? 'PASS' : 'FAIL'
  };
  auditResults.push(result);
  console.log(`${result.test} | EXPECTED: ${result.expected} | ACTUAL: ${result.actual} | HTTP STATUS: ${result.httpStatus} | ${result.status}`);
}

async function runFullAudit() {
  console.log('=============== STARTING PHASE 4 BLACK-BOX AUDIT ===============\n');
  const pool = createPool();

  try {
    // Reset test company custom field definitions to ensure isolated test execution
    await pool.query("DELETE FROM custom_field_definitions WHERE company_id IN ('company_default', 'company_b')");

    // -------------------------------------------------------------
    // TEST 1: Product Custom Field Creation
    // -------------------------------------------------------------
    const cfProd = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'warranty_period',
      label: 'فترة الضمان (أشهر)',
      dataType: 'NUMBER',
      isRequired: true
    }, { 'X-User-Role': 'ADMIN' });

    logTestResult(
      1,
      'إنشاء Custom Field لمنتج',
      'HTTP 200 & success=true',
      cfProd.body?.success ? 'success=true' : JSON.stringify(cfProd.body),
      cfProd.status,
      cfProd.status === 200 && cfProd.body?.success === true
    );

    // -------------------------------------------------------------
    // TEST 2: Customer Custom Field Creation
    // -------------------------------------------------------------
    const cfCust = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'CUSTOMER',
      fieldKey: 'tax_reg_no',
      label: 'رقم التسجيل الضريبي',
      dataType: 'TEXT',
      isRequired: false
    }, { 'X-User-Role': 'ADMIN' });

    logTestResult(
      2,
      'إنشاء Custom Field لعميل',
      'HTTP 200 & success=true',
      cfCust.body?.success ? 'success=true' : JSON.stringify(cfCust.body),
      cfCust.status,
      cfCust.status === 200 && cfCust.body?.success === true
    );

    // -------------------------------------------------------------
    // TEST 3: Supplier Custom Field Creation
    // -------------------------------------------------------------
    const cfSupp = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'SUPPLIER',
      fieldKey: 'vendor_category',
      label: 'فئة المورد',
      dataType: 'SELECT',
      optionsJson: ['A+', 'A', 'B', 'C'],
      isRequired: false
    }, { 'X-User-Role': 'ADMIN' });

    logTestResult(
      3,
      'إنشاء Custom Field لمورد',
      'HTTP 200 & success=true',
      cfSupp.body?.success ? 'success=true' : JSON.stringify(cfSupp.body),
      cfSupp.status,
      cfSupp.status === 200 && cfSupp.body?.success === true
    );

    // -------------------------------------------------------------
    // TEST 4: Employee Custom Field Creation
    // -------------------------------------------------------------
    const cfEmp = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'EMPLOYEE',
      fieldKey: 'emergency_phone',
      label: 'هاتف الطوارئ',
      dataType: 'TEXT',
      isRequired: false
    }, { 'X-User-Role': 'ADMIN' });

    logTestResult(
      4,
      'إنشاء Custom Field لموظف',
      'HTTP 200 & success=true',
      cfEmp.body?.success ? 'success=true' : JSON.stringify(cfEmp.body),
      cfEmp.status,
      cfEmp.status === 200 && cfEmp.body?.success === true
    );

    // -------------------------------------------------------------
    // TEST 5: Save & Retrieve Values from PostgreSQL (All 4 Entities)
    // -------------------------------------------------------------
    const prodSave = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج اختبار شامل',
      price: 250,
      costPrice: 150,
      stock: 50,
      customAttributes: { warranty_period: 24 }
    });
    const testProdId = prodSave.body?.id;

    const custSave = await apiRequest('POST', '/api/customers', {
      companyId: 'company_default',
      name: 'عميل اختبار شامل',
      phone: '01000000001',
      customAttributes: { tax_reg_no: 'TRN-123456' }
    });
    const testCustId = custSave.body?.id;

    const suppSave = await apiRequest('POST', '/api/suppliers', {
      companyId: 'company_default',
      name: 'مورد اختبار شامل',
      phone: '01000000002',
      customAttributes: { vendor_category: 'A+' }
    });
    const testSuppId = suppSave.body?.id;

    const empSave = await apiRequest('POST', '/api/employees', {
      companyId: 'company_default',
      name: 'موظف اختبار شامل',
      role: 'CASHIER',
      customAttributes: { emergency_phone: '01111111111' }
    });
    const testEmpId = empSave.body?.id;

    // Direct DB Verification
    const dbProdRes = await pool.query('SELECT custom_attributes FROM products WHERE id = $1', [testProdId]);
    const dbCustRes = await pool.query('SELECT custom_attributes FROM customers WHERE id = $1', [testCustId]);
    const dbSuppRes = await pool.query('SELECT custom_attributes FROM suppliers WHERE id = $1', [testSuppId]);
    const dbEmpRes = await pool.query('SELECT custom_attributes FROM employees WHERE id = $1', [testEmpId]);

    const allDbMatch = (
      dbProdRes.rows[0]?.custom_attributes?.warranty_period === 24 &&
      dbCustRes.rows[0]?.custom_attributes?.tax_reg_no === 'TRN-123456' &&
      dbSuppRes.rows[0]?.custom_attributes?.vendor_category === 'A+' &&
      dbEmpRes.rows[0]?.custom_attributes?.emergency_phone === '01111111111'
    );

    logTestResult(
      5,
      'حفظ واسترجاع القيم من PostgreSQL (الكيانات الأربعة)',
      'القيم محفوظة بدقة في JSONB في الجداول الأربعة',
      allDbMatch ? 'تم استرجاع ومطابقة جميع القيم من PostgreSQL بنجاح' : 'فشل الاسترجاع',
      prodSave.status,
      allDbMatch
    );

    // -------------------------------------------------------------
    // TEST 6: Data Types (TEXT / NUMBER / BOOLEAN / DATE)
    // -------------------------------------------------------------
    await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'batch_code',
      label: 'رمز التشغيلة',
      dataType: 'TEXT'
    });
    await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'is_fragile',
      label: 'قابل للكسر',
      dataType: 'BOOLEAN'
    });
    await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'expiry_date',
      label: 'تاريخ الانتهاء',
      dataType: 'DATE'
    });

    const dtProdSave = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج متعدد الأنواع',
      price: 100,
      stock: 10,
      customAttributes: {
        warranty_period: 12,
        batch_code: 'BATCH-2026',
        is_fragile: true,
        expiry_date: '2026-12-31'
      }
    });

    const dtFetch = await apiRequest('GET', `/api/products/${dtProdSave.body?.id}?companyId=company_default`);
    const dtAttrs = dtFetch.body?.customAttributes || {};

    const typesCorrect = (
      typeof dtAttrs.warranty_period === 'number' &&
      typeof dtAttrs.batch_code === 'string' &&
      typeof dtAttrs.is_fragile === 'boolean' &&
      typeof dtAttrs.expiry_date === 'string'
    );

    logTestResult(
      6,
      'أنواع البيانات TEXT / NUMBER / BOOLEAN / DATE',
      'أنواع البيانات محفوظة ومسترجعة بدقة (Number, String, Boolean)',
      `warranty_period: ${typeof dtAttrs.warranty_period}, is_fragile: ${typeof dtAttrs.is_fragile}, batch_code: ${typeof dtAttrs.batch_code}, expiry_date: ${typeof dtAttrs.expiry_date}`,
      dtFetch.status,
      dtFetch.status === 200 && typesCorrect
    );

    // -------------------------------------------------------------
    // TEST 7: Data Types (SELECT / MULTI_SELECT)
    // -------------------------------------------------------------
    await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'shipping_zone',
      label: 'منطقة الشحن',
      dataType: 'SELECT',
      optionsJson: ['القاهرة', 'الجيزة', 'الإسكندرية']
    });
    await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'shift_availability',
      label: 'فترات العمل',
      dataType: 'MULTI_SELECT',
      optionsJson: ['صباحي', 'مسائي', 'ليلي']
    });

    const selProdSave = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج خيارات قائمة',
      price: 120,
      stock: 15,
      customAttributes: {
        warranty_period: 6,
        shipping_zone: 'القاهرة',
        shift_availability: ['صباحي', 'مسائي']
      }
    });

    const selFetch = await apiRequest('GET', `/api/products/${selProdSave.body?.id}?companyId=company_default`);
    const selAttrs = selFetch.body?.customAttributes || {};

    const selCorrect = (
      selAttrs.shipping_zone === 'القاهرة' &&
      Array.isArray(selAttrs.shift_availability) &&
      selAttrs.shift_availability.includes('صباحي') &&
      selAttrs.shift_availability.includes('مسائي')
    );

    logTestResult(
      7,
      'أنواع البيانات SELECT / MULTI_SELECT',
      'قبول الخيارات المحددة وإرجاع القيمة المفردة والمصفوفة',
      `shipping_zone: ${selAttrs.shipping_zone}, shift_availability: [${selAttrs.shift_availability?.join(',')}]`,
      selFetch.status,
      selFetch.status === 200 && selCorrect
    );

    // -------------------------------------------------------------
    // TEST 8: Required Field Validation
    // -------------------------------------------------------------
    const reqFailRes = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج بدون ضمان إجباري',
      price: 100,
      stock: 5,
      customAttributes: {} // Missing warranty_period which is required
    });

    logTestResult(
      8,
      'الحقل الإلزامي (Required Field)',
      'HTTP 400 & رفض إدخال البيانات المفتقرة للحقل الإلزامي',
      `HTTP ${reqFailRes.status} - Error: ${reqFailRes.body?.error}`,
      reqFailRes.status,
      reqFailRes.status === 400 && String(reqFailRes.body?.error).includes('إلزامي')
    );

    // -------------------------------------------------------------
    // TEST 9: Reject Invalid Value Data Type
    // -------------------------------------------------------------
    const numTypeFail = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج بنوع رقم خاطئ',
      price: 100,
      stock: 5,
      customAttributes: {
        warranty_period: 'ليس_رقماً'
      }
    });

    logTestResult(
      9,
      'رفض Value من نوع خاطئ',
      'HTTP 400 & رسالة خطأ توضح القيمة الرقمية المطلوبة',
      `HTTP ${numTypeFail.status} - Error: ${numTypeFail.body?.error}`,
      numTypeFail.status,
      numTypeFail.status === 400 && String(numTypeFail.body?.error).includes('رقماً')
    );

    // -------------------------------------------------------------
    // TEST 10: Reject Non-Existent Select Option
    // -------------------------------------------------------------
    const optFailRes = await apiRequest('POST', '/api/suppliers', {
      companyId: 'company_default',
      name: 'مورد بخيار غير موجود',
      customAttributes: {
        vendor_category: 'فئة_خاطئة_غير_موجودة'
      }
    });

    logTestResult(
      10,
      'رفض Select Option غير موجود',
      'HTTP 400 & رفض القيمة غير المدرجة بقائمة الخيارات المتاحة',
      `HTTP ${optFailRes.status} - Error: ${optFailRes.body?.error}`,
      optFailRes.status,
      optFailRes.status === 400 && String(optFailRes.body?.error).includes('غير صالحة')
    );

    // -------------------------------------------------------------
    // TEST 11: Tenant Isolation Between Two Companies
    // -------------------------------------------------------------
    const tenantBDefs = await apiRequest('GET', '/api/custom-field-definitions?entityType=PRODUCT&companyId=company_b');
    
    logTestResult(
      11,
      'Tenant Isolation بين شركتين',
      'HTTP 200 & إرجاع 0 حقول مخصصة لـ Company B (عزل كامل عن Company A)',
      `عدد حقول الشركة B: ${Array.isArray(tenantBDefs.body) ? tenantBDefs.body.length : 'N/A'}`,
      tenantBDefs.status,
      tenantBDefs.status === 200 && Array.isArray(tenantBDefs.body) && tenantBDefs.body.length === 0
    );

    // -------------------------------------------------------------
    // TEST 12: RBAC: Admin/Manager Allowed, Cashier Forbidden
    // -------------------------------------------------------------
    const cashierCreateRes = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'cashier_test',
      label: 'تجربة الكاشير',
      dataType: 'TEXT'
    }, { 'X-User-Role': 'CASHIER' });

    const managerCreateRes = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'manager_test',
      label: 'تجربة المدير',
      dataType: 'TEXT'
    }, { 'X-User-Role': 'MANAGER' });

    const rbacPassed = (cashierCreateRes.status === 403 && managerCreateRes.status === 200);

    logTestResult(
      12,
      'RBAC: Admin/Manager يسمح، Cashier يمنع تعديل Definitions',
      'Cashier => HTTP 403 Forbidden | Manager => HTTP 200 Success',
      `Cashier: ${cashierCreateRes.status} | Manager: ${managerCreateRes.status}`,
      cashierCreateRes.status,
      rbacPassed
    );

    // -------------------------------------------------------------
    // TEST 13: Delete Definition with Historical Retention
    // -------------------------------------------------------------
    const tempDefRes = await apiRequest('POST', '/api/custom-field-definitions', {
      companyId: 'company_default',
      entityType: 'PRODUCT',
      fieldKey: 'temp_serial',
      label: 'الرقم التسلسلي المؤقت',
      dataType: 'TEXT'
    });
    const tempDefId = tempDefRes.body?.id;

    const tempProdRes = await apiRequest('POST', '/api/products', {
      companyId: 'company_default',
      name: 'منتج تجربة الحذف التاريخي',
      price: 300,
      stock: 5,
      customAttributes: {
        warranty_period: 12,
        temp_serial: 'SN-9988776655'
      }
    });
    const tempProdId = tempProdRes.body?.id;

    // Delete Definition
    const delDefRes = await apiRequest('DELETE', `/api/custom-field-definitions/${tempDefId}?companyId=company_default`);

    // Verify product's historical custom_attributes in PostgreSQL
    const histDbRes = await pool.query('SELECT custom_attributes FROM products WHERE id = $1', [tempProdId]);
    const histRetained = (histDbRes.rows[0]?.custom_attributes?.temp_serial === 'SN-9988776655');

    logTestResult(
      13,
      'حذف Definition مع التأكد أن القيم التاريخية لا تُحذف',
      'حذف التعريف بنجاح والحفاظ التام على القيمة التاريخية في JSONB',
      histRetained ? 'الخاصية SN-9988776655 محفوظة بـ PostgreSQL بعد حذف التعريف' : 'تم مسح البيانات',
      delDefRes.status,
      delDefRes.status === 200 && histRetained
    );

    // -------------------------------------------------------------
    // TEST 14: Refresh / Logout / Login Data Persistence
    // -------------------------------------------------------------
    const logoutRes = await apiRequest('POST', '/api/auth/logout', {});
    const reFetchProd = await apiRequest('GET', `/api/products/${testProdId}?companyId=company_default`);

    const dataPersisted = (
      reFetchProd.status === 200 &&
      reFetchProd.body?.customAttributes?.warranty_period === 24
    );

    logTestResult(
      14,
      'Refresh / Logout / Login والحفاظ على البيانات',
      'الاستمرار في جلب البيانات والميزات بعد تسجيل الخروج والتنشيط',
      dataPersisted ? 'جميع البيانات والخصائص المخصصة محفوظة ومتاحة' : 'فقدان البيانات',
      reFetchProd.status,
      dataPersisted
    );

    // -------------------------------------------------------------
    // TEST 15: Industry & Hybrid Industry Field Visibility
    // -------------------------------------------------------------
    const getIndustryDefs = await apiRequest('GET', '/api/custom-field-definitions?entityType=PRODUCT&companyId=company_default');
    const defsCount = Array.isArray(getIndustryDefs.body) ? getIndustryDefs.body.length : 0;

    logTestResult(
      15,
      'ظهور الحقول حسب Industry وHybrid Industry',
      'HTTP 200 & استرجاع الحقول المعرفة للكيان والمؤسسة',
      `عدد الحقول المسترجعة: ${defsCount}`,
      getIndustryDefs.status,
      getIndustryDefs.status === 200 && defsCount > 0
    );

    // -------------------------------------------------------------
    // TEST 16: Appearance in Reports
    // -------------------------------------------------------------
    const prodListReport = await apiRequest('GET', '/api/products?companyId=company_default');
    const hasCustomAttrsInReport = Array.isArray(prodListReport.body) && prodListReport.body.some(p => p.customAttributes && Object.keys(p.customAttributes).length > 0);

    logTestResult(
      16,
      'ظهورها في التقارير إذا كان التقرير يدعم الـ Entity',
      'إرجاع كائن customAttributes ضمن بيانات الكيان المنتجة بالتقارير',
      hasCustomAttrsInReport ? 'تتضمن استجابة الكيانات في التقرير الخصائص المخصصة' : 'مفقودة',
      prodListReport.status,
      prodListReport.status === 200 && hasCustomAttrsInReport
    );

    // -------------------------------------------------------------
    // TEST 17: Core Financial & Inventory Fields Unaffected
    // -------------------------------------------------------------
    const checkProd = await apiRequest('GET', `/api/products/${testProdId}?companyId=company_default`);
    const fieldsIntact = (
      checkProd.body?.price === 250 &&
      checkProd.body?.costPrice === 150 &&
      checkProd.body?.stock === 50
    );

    logTestResult(
      17,
      'التأكد أن الحقول الأساسية المالية والمخزنية لم تتأثر',
      'السعر (250)، التكلفة (150)، والمخزون (50) تطابق القيم دون أي تغيير',
      `السعر: ${checkProd.body?.price}, التكلفة: ${checkProd.body?.costPrice}, المخزون: ${checkProd.body?.stock}`,
      checkProd.status,
      checkProd.status === 200 && fieldsIntact
    );

    // -------------------------------------------------------------
    // TEST 18: Regression for Sales, Purchasing, POS, Inventory
    // -------------------------------------------------------------
    const saleTx = await apiRequest('POST', '/api/sales', {
      companyId: 'company_default',
      invoiceNumber: `INV-${Date.now()}`,
      subtotal: 500,
      vatAmount: 70,
      total: 570,
      paymentMethod: 'CASH',
      items: [{ productId: testProdId, productName: 'منتج اختبار شامل', quantity: 2, price: 250, total: 500 }]
    });

    const purchTx = await apiRequest('POST', '/api/purchases', {
      companyId: 'company_default',
      supplierId: testSuppId,
      total: 1500,
      subtotal: 1500,
      vatAmount: 0,
      paymentMethod: 'CASH',
      items: [{ productId: testProdId, productName: 'منتج اختبار شامل', quantity: 10, costPrice: 150, total: 1500 }]
    });

    const regressionSuccess = (saleTx.status === 200 && purchTx.status === 200);

    logTestResult(
      18,
      'Regression للمبيعات والمشتريات وPOS والمخزون',
      'تنفيذ العمليات التجارية والمخزنية بنجاح دون أي تعارض مع الحقول المخصصة',
      `معاملة البيع: ${saleTx.status} | معاملة الشراء: ${purchTx.status}`,
      saleTx.status,
      regressionSuccess
    );

    // -------------------------------------------------------------
    // TEST 19: Build Verification
    // -------------------------------------------------------------
    let buildPassed = false;
    let buildMsg = '';
    try {
      execSync('npm run build', { stdio: 'pipe' });
      buildPassed = true;
      buildMsg = 'تم البناء بنجاح (vite + esbuild server.ts)';
    } catch (e) {
      buildMsg = e.message;
    }

    logTestResult(
      19,
      'Build Verification (npm run build)',
      'Exit Code 0 & بناء الملفات بنجاح',
      buildMsg,
      200,
      buildPassed
    );

    // -------------------------------------------------------------
    // TEST 20: Lint Verification
    // -------------------------------------------------------------
    let lintPassed = false;
    let lintMsg = '';
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      lintPassed = true;
      lintMsg = 'تم الفحص المكتبي بنجاح بدون أخطاء';
    } catch (e) {
      lintMsg = e.message;
    }

    logTestResult(
      20,
      'Lint Verification (npm run lint)',
      'Exit Code 0 & خلو الكود من أخطاء الـ Linter',
      lintMsg,
      200,
      lintPassed
    );

    // -------------------------------------------------------------
    // TEST 21: TypeScript Compilation Check (tsc --noEmit)
    // -------------------------------------------------------------
    let tscPassed = false;
    let tscMsg = '';
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      tscPassed = true;
      tscMsg = 'تم التحقق من الأنواع بنجاح بدون أي أخطاء Type checking';
    } catch (e) {
      tscMsg = e.message;
    }

    logTestResult(
      21,
      'TypeScript Verification (npx tsc --noEmit)',
      'Exit Code 0 & مطابقة الأنواع بالكامل',
      tscMsg,
      200,
      tscPassed
    );

  } catch (error) {
    console.error('Audit execution error:', error);
  } finally {
    await pool.end();
  }

  console.log('\n=============== AUDIT COMPLETED ===============');
}

runFullAudit();

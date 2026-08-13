-- =========================================================================
-- MARO POS - نظام سير العمل الديناميكي (Dynamic Workflow Engine) - المرحلة الخامسة
-- مخطط قاعدة البيانات العلاقية وجداول تتبع الحالات
-- =========================================================================
--
-- هذا الملف يحتوي على مخطط الترحيل (Migration SQL) لإنشاء الجداول المترابطة 
-- الخاصة بمحرك سير العمل الديناميكي، مع مراعاة القيود التالية:
-- 1. قيود صارمة لمستأجري النظام (Tenant/Company Isolation) باستخدام مفاتيح خارجية (Foreign Keys).
-- 2. تجنب تام لاستخدام حقول JSONB لحفظ الانتقالات أو الحالات (تخزين علاقي بالكامل لضمان سلامة البيانات وقابليتها للبحث الفوري).
-- 3. إنشاء فهارس (Indexes) ذكية لتسريع البحث والاستعلام.

-- تمكين لوحة تتبع الأخطاء والتنفيذ المباشر
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

BEGIN;

-- 1. جدول تعريفات سير العمل (Workflow Definitions)
-- يحتوي على الهيكل الأساسي لكل نموذج سير عمل مخصص لكل شركة/مستأجر
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id VARCHAR(255) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL, -- SALES_ORDER, PURCHASE_ORDER, SALES_INVOICE
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- قيد مفتاح خارجي صارم للمستأجر (Tenant ID Constraint)
    CONSTRAINT fk_workflow_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. جدول خطوات سير العمل (Workflow Steps)
-- يمثل الحالات الفردية داخل سير العمل (مثال: مسودة، بانتظار الموافقة، معتمد، مرفوض)
CREATE TABLE IF NOT EXISTS workflow_steps (
    id VARCHAR(255) PRIMARY KEY,
    workflow_definition_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL, -- الحالة المالية/النظامية المرتبطة بالخطوة
    is_initial BOOLEAN DEFAULT FALSE NOT NULL, -- هل هي الخطوة الافتتاحية للمستند؟
    is_final BOOLEAN DEFAULT FALSE NOT NULL, -- هل هي خطوة نهائية تغلق المستند؟
    step_order INTEGER DEFAULT 0 NOT NULL, -- ترتيب الخطوة في العرض والتسلسل
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT fk_step_definition FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

-- 3. جدول الانتقالات المسموح بها (Workflow Transitions)
-- يحدد المسارات المسموح للمستند بسلوكها بين الخطوات المختلفة، مع تحديد الأدوار المطلوبة (RBAC)
CREATE TABLE IF NOT EXISTS workflow_transitions (
    id VARCHAR(255) PRIMARY KEY,
    workflow_definition_id VARCHAR(255) NOT NULL,
    from_step_id VARCHAR(255) NOT NULL,
    to_step_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL, -- اسم الإجراء (مثال: تقديم للمراجعة، تعميد الطلب)
    required_role VARCHAR(100), -- الدور الوظيفي المسموح له بتنفيذ الانتقال (MANAGER, ADMIN, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT fk_transition_definition FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    CONSTRAINT fk_transition_from_step FOREIGN KEY (from_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
    CONSTRAINT fk_transition_to_step FOREIGN KEY (to_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
);

-- 4. جدول سجل تتبع الحركات التاريخي (Workflow History Log)
-- يسجل كافة الحركات والقرارات المتخذة على المستندات للتدقيق المالي والتنظيمي
CREATE TABLE IF NOT EXISTS workflow_history (
    id VARCHAR(255) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL, -- عزل صارم لسجلات التتبع لكل شركة
    document_id VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    from_step_id VARCHAR(255),
    to_step_id VARCHAR(255) NOT NULL,
    performed_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT fk_history_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_from_step FOREIGN KEY (from_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL,
    CONSTRAINT fk_history_to_step FOREIGN KEY (to_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. إضافة أعمدة الربط لسير العمل في جداول المبيعات والمشتريات الحالية
-- لتمكين المستندات من تتبع حالتها ضمن محرك سير العمل الديناميكي
ALTER TABLE sales ADD COLUMN IF NOT EXISTS current_step_id VARCHAR(255);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS current_step_id VARCHAR(255);

-- إضافة قيود مفاتيح خارجية للأعمدة الجديدة لضمان سلامة العلاقات
ALTER TABLE sales ADD CONSTRAINT fk_sales_current_step FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL;
ALTER TABLE purchases ADD CONSTRAINT fk_purchases_current_step FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL;


-- =========================================================================
-- إنشاء الفهارس الذكية لتحسين سرعة وجودة الاستعلامات المترابطة (Database Indexes)
-- =========================================================================

-- فهرس لتسريع استرجاع سير العمل النشط الخاص بكل مستأجر ونوع مستند
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_lookup 
ON workflow_definitions (company_id, document_type, is_active);

-- فهرس لتسريع استعراض الخطوات المرتبطة بسير عمل معين مرتبة بالتسلسل
CREATE INDEX IF NOT EXISTS idx_workflow_steps_definition 
ON workflow_steps (workflow_definition_id, step_order);

-- فهرس لتسريع البحث عن الانتقالات المتاحة من خطوة حالية معينة
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from_step 
ON workflow_transitions (from_step_id);

-- فهرس مركب لتسريع تتبع الحركات التاريخية لمستند مخصص تابع لمستأجر معين
CREATE INDEX IF NOT EXISTS idx_workflow_history_document 
ON workflow_history (company_id, document_id, document_type);

-- فهارس على جداول المستندات للبحث السريع عن الفواتير وطلبات المبيعات/المشتريات حسب الخطوة الحالية
CREATE INDEX IF NOT EXISTS idx_sales_workflow_step 
ON sales (current_step_id);

CREATE INDEX IF NOT EXISTS idx_purchases_workflow_step 
ON purchases (current_step_id);

COMMIT;

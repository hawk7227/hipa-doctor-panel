-- ═══════════════════════════════════════════════════════════════
-- FIX: Add missing columns to drchrono tables
-- Run in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS equivalent via DO blocks)
-- ═══════════════════════════════════════════════════════════════

-- Helper: Add column if it doesn't exist
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
  _table TEXT, _column TEXT, _type TEXT, _default TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = _table AND column_name = _column
  ) THEN
    IF _default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s DEFAULT %s', _table, _column, _type, _default);
    ELSE
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', _table, _column, _type);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- drchrono_appointments — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_appointments', 'drchrono_appointment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'office', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'scheduled_time', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'duration', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'exam_room', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'reason', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'appt_is_break', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_appointments', 'recurring_appointment', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_appointments', 'profile', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'base_recurring_appointment', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_appointments', 'is_walk_in', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_appointments', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_appointments', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_documents — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_documents', 'drchrono_document_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_documents', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_documents', 'description', 'TEXT');
SELECT add_column_if_not_exists('drchrono_documents', 'document_type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_documents', 'document_url', 'TEXT');
SELECT add_column_if_not_exists('drchrono_documents', 'date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_documents', 'metatags', 'JSONB');
SELECT add_column_if_not_exists('drchrono_documents', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_documents', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_documents', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_clinical_notes — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'drchrono_note_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'drchrono_appointment_id', 'TEXT');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'clinical_note_sections', 'JSONB');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'clinical_note_pdf', 'TEXT');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'locked', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_clinical_notes', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_lab_orders — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_lab_orders', 'drchrono_lab_order_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'requisition_id', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'priority', 'TEXT', '''normal''');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'lab_type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_orders', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_lab_results — add ALL expected columns  
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_lab_results', 'drchrono_lab_result_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_results', 'drchrono_lab_order_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_results', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_results', 'test_code', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'test_name', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'value', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'unit', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'abnormal_flag', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'normal_range', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'normal_range_high', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'normal_range_low', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'specimen_source', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'specimen_condition', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'collection_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'result_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'report_notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'stack', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_results', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_lab_tests — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_lab_tests', 'drchrono_lab_test_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'drchrono_lab_order_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'code', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'name', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'abn_document', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_lab_tests', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- drchrono_vaccines — add ALL expected columns
-- ══════════════════════════════════════════════════════════════
SELECT add_column_if_not_exists('drchrono_vaccines', 'drchrono_vaccine_record_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_vaccines', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_vaccines', 'vaccine_name', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'cvx_code', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'administered_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'administered_by', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'route', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'site', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'dose_quantity', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'dose_unit', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'lot_number', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'manufacturer', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'expiration_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_vaccines', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- All other tables (billing, practice, communication)
-- ══════════════════════════════════════════════════════════════

-- drchrono_line_items
SELECT add_column_if_not_exists('drchrono_line_items', 'drchrono_line_item_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_line_items', 'drchrono_appointment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_line_items', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_line_items', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_line_items', 'code', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'procedure_type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'description', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'quantity', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'units', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'price', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'allowed', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'balance_ins', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'balance_pt', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'balance_total', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'paid_total', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'adjustment', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'ins1_paid', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'ins2_paid', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'ins3_paid', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'pt_paid', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_line_items', 'billing_status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'icd10_codes', 'JSONB');
SELECT add_column_if_not_exists('drchrono_line_items', 'posted_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'service_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_line_items', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_transactions
SELECT add_column_if_not_exists('drchrono_transactions', 'drchrono_transaction_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_transactions', 'drchrono_line_item_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_transactions', 'drchrono_appointment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_transactions', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_transactions', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_transactions', 'posted_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'adjustment', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_transactions', 'adjustment_reason', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'ins_paid', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_transactions', 'ins_name', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'check_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'check_number', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'claim_status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'trace_number', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_transactions', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_patient_payments
SELECT add_column_if_not_exists('drchrono_patient_payments', 'drchrono_payment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'drchrono_appointment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'amount', 'NUMERIC');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'payment_method', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'payment_transaction_type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'posted_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'trace_number', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_patient_payments', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_tasks
SELECT add_column_if_not_exists('drchrono_tasks', 'drchrono_task_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_tasks', 'title', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'category', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_tasks', 'assignee_user', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_tasks', 'due_date', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'associated_items', 'JSONB');
SELECT add_column_if_not_exists('drchrono_tasks', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_tasks', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_messages
SELECT add_column_if_not_exists('drchrono_messages', 'drchrono_message_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_messages', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_messages', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_messages', 'owner', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_messages', 'type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_messages', 'title', 'TEXT');
SELECT add_column_if_not_exists('drchrono_messages', 'body', 'TEXT');
SELECT add_column_if_not_exists('drchrono_messages', 'read', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_messages', 'starred', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_messages', 'archived', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('drchrono_messages', 'responsible_user', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_messages', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_messages', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_messages', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_amendments
SELECT add_column_if_not_exists('drchrono_amendments', 'drchrono_amendment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_amendments', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_amendments', 'drchrono_appointment_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_amendments', 'notes', 'TEXT');
SELECT add_column_if_not_exists('drchrono_amendments', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_amendments', 'requested_by', 'TEXT');
SELECT add_column_if_not_exists('drchrono_amendments', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_amendments', 'drchrono_updated_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_amendments', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- drchrono_communications
SELECT add_column_if_not_exists('drchrono_communications', 'drchrono_communication_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_communications', 'drchrono_patient_id', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_communications', 'doctor', 'INTEGER');
SELECT add_column_if_not_exists('drchrono_communications', 'type', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'message', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'subject', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'direction', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'status', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'drchrono_created_at', 'TEXT');
SELECT add_column_if_not_exists('drchrono_communications', 'last_synced_at', 'TIMESTAMPTZ', 'NOW()');

-- ══════════════════════════════════════════════════════════════
-- Create UNIQUE constraints if missing (needed for upsert)
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_appointments_drchrono_appointment_id_key') THEN
    ALTER TABLE drchrono_appointments ADD CONSTRAINT drchrono_appointments_drchrono_appointment_id_key UNIQUE (drchrono_appointment_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_documents_drchrono_document_id_key') THEN
    ALTER TABLE drchrono_documents ADD CONSTRAINT drchrono_documents_drchrono_document_id_key UNIQUE (drchrono_document_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_clinical_notes_drchrono_note_id_key') THEN
    ALTER TABLE drchrono_clinical_notes ADD CONSTRAINT drchrono_clinical_notes_drchrono_note_id_key UNIQUE (drchrono_note_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_lab_orders_drchrono_lab_order_id_key') THEN
    ALTER TABLE drchrono_lab_orders ADD CONSTRAINT drchrono_lab_orders_drchrono_lab_order_id_key UNIQUE (drchrono_lab_order_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_lab_results_drchrono_lab_result_id_key') THEN
    ALTER TABLE drchrono_lab_results ADD CONSTRAINT drchrono_lab_results_drchrono_lab_result_id_key UNIQUE (drchrono_lab_result_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_lab_tests_drchrono_lab_test_id_key') THEN
    ALTER TABLE drchrono_lab_tests ADD CONSTRAINT drchrono_lab_tests_drchrono_lab_test_id_key UNIQUE (drchrono_lab_test_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drchrono_vaccines_drchrono_vaccine_record_id_key') THEN
    ALTER TABLE drchrono_vaccines ADD CONSTRAINT drchrono_vaccines_drchrono_vaccine_record_id_key UNIQUE (drchrono_vaccine_record_id);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- Create indexes if missing
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_drchrono_appointments_patient ON drchrono_appointments(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_appointments_time ON drchrono_appointments(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_drchrono_documents_patient ON drchrono_documents(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_clinical_notes_patient ON drchrono_clinical_notes(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_orders_patient ON drchrono_lab_orders(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_results_patient ON drchrono_lab_results(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_tests_order ON drchrono_lab_tests(drchrono_lab_order_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_vaccines_patient ON drchrono_vaccines(drchrono_patient_id);

-- Clean up helper function
DROP FUNCTION IF EXISTS add_column_if_not_exists;

-- ══════════════════════════════════════════════════════════════
-- DONE — All columns, constraints, and indexes verified
-- ══════════════════════════════════════════════════════════════

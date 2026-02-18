-- ═══════════════════════════════════════════════════════════════
-- Chart Management System — Enterprise Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Chart Settings (doctor customization) ──────────────────
CREATE TABLE IF NOT EXISTS chart_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  -- Status color customization
  status_colors JSONB DEFAULT '{
    "draft": "#6b7280",
    "preliminary": "#f59e0b", 
    "signed": "#22c55e",
    "closed": "#3b82f6",
    "amended": "#a855f7",
    "needs_review": "#f97316"
  }'::jsonb,
  -- PDF letterhead settings
  pdf_logo_url TEXT,
  practice_name TEXT DEFAULT 'Medazon Health',
  practice_address TEXT,
  practice_city TEXT,
  practice_state TEXT DEFAULT 'FL',
  practice_zip TEXT,
  practice_phone TEXT,
  practice_fax TEXT,
  practice_email TEXT,
  practice_npi TEXT,
  practice_license TEXT,
  practice_website TEXT,
  -- Behavior settings
  auto_lock_after_sign BOOLEAN DEFAULT false,
  auto_generate_pdf_on_sign BOOLEAN DEFAULT true,
  require_cosign BOOLEAN DEFAULT false,
  overdue_threshold_hours INT DEFAULT 48,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one settings row per doctor
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_settings_doctor ON chart_settings(doctor_id);

-- ─── 2. Medical Letters ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_letters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  doctor_id UUID NOT NULL,
  -- Letter details
  letter_type TEXT NOT NULL, -- 'work_excuse','referral','fmla','return_clearance','prior_auth','disability_ada','esa','medical_necessity','travel','jury_duty','school_form','care_transfer','prescription_necessity','verification_treatment','housing_accommodation','fitness_duty','other'
  template_id UUID,
  subject TEXT,
  recipient_name TEXT,
  recipient_organization TEXT,
  recipient_address TEXT,
  recipient_fax TEXT,
  recipient_email TEXT,
  -- Content
  body_text TEXT NOT NULL,
  body_html TEXT,
  -- AI
  ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT,
  ai_prompt_summary TEXT,
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft','signed','sent','voided'
  signed_at TIMESTAMPTZ,
  signed_by UUID,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  voided_reason TEXT,
  -- PDF
  pdf_url TEXT,
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  -- Delivery
  sent_via TEXT, -- 'email','fax','download','portal'
  sent_to TEXT,
  sent_at TIMESTAMPTZ,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- template variables, custom fields
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_letters_patient ON medical_letters(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_letters_doctor ON medical_letters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_letters_type ON medical_letters(letter_type);
CREATE INDEX IF NOT EXISTS idx_medical_letters_status ON medical_letters(status);

-- ─── 3. Letter Templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS letter_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID, -- NULL = system template
  letter_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  body_template TEXT NOT NULL, -- content with {{placeholders}}
  variables JSONB DEFAULT '[]'::jsonb, -- list of expected variables
  is_system BOOLEAN DEFAULT false, -- true = preloaded, can't delete
  is_active BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'general', -- 'employment','referral','insurance','legal','school','travel'
  sort_order INT DEFAULT 0,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_letter_templates_type ON letter_templates(letter_type);
CREATE INDEX IF NOT EXISTS idx_letter_templates_doctor ON letter_templates(doctor_id);

-- ─── 4. Chart Drafts (assistant pending changes) ──────────────
CREATE TABLE IF NOT EXISTS chart_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID,
  patient_id UUID NOT NULL,
  -- Author
  author_id UUID,
  author_email TEXT,
  author_name TEXT,
  author_role TEXT DEFAULT 'assistant', -- 'assistant','nurse','billing'
  -- What changed
  panel TEXT NOT NULL, -- 'medications','problems','allergies','vitals', etc.
  action TEXT NOT NULL, -- 'add','edit','delete','note'
  target_table TEXT,
  target_record_id UUID,
  -- Draft data
  draft_data JSONB NOT NULL, -- the proposed changes
  original_data JSONB, -- what it was before (for edits)
  description TEXT, -- human-readable description of change
  -- Review
  status TEXT DEFAULT 'pending', -- 'pending','approved','rejected'
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  -- If approved, did it create an addendum?
  addendum_id UUID,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_drafts_patient ON chart_drafts(patient_id);
CREATE INDEX IF NOT EXISTS idx_chart_drafts_status ON chart_drafts(status);
CREATE INDEX IF NOT EXISTS idx_chart_drafts_author ON chart_drafts(author_id);

-- ─── 5. Problem Notes (per-problem timeline) ──────────────────
CREATE TABLE IF NOT EXISTS problem_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  -- Author
  author_id UUID,
  author_name TEXT,
  author_role TEXT DEFAULT 'provider', -- 'provider','assistant','system'
  -- Note
  note_type TEXT DEFAULT 'provider_note', -- 'provider_note','soap_excerpt','status_change','addendum','system'
  content TEXT NOT NULL,
  -- For status changes
  old_status TEXT,
  new_status TEXT,
  -- Review (for assistant notes)
  status TEXT DEFAULT 'approved', -- 'draft','approved','rejected'
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_notes_problem ON problem_notes(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_notes_patient ON problem_notes(patient_id);

-- ─── 6. Enhanced patient_problems columns ─────────────────────
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS linked_appointment_id UUID;
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS date_resolved TIMESTAMPTZ;
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS resolved_reason TEXT;
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS resolved_by UUID;
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE patient_problems ADD COLUMN IF NOT EXISTS date_diagnosed TIMESTAMPTZ;

-- ─── 7. Preload System Letter Templates ──────────────────────
INSERT INTO letter_templates (letter_type, name, description, body_template, is_system, category, sort_order, variables)
VALUES
-- Work/School Excuse
('work_excuse', 'Work/School Excuse', 'Confirms patient was seen and excused from work/school', 
'Date: {{date}}

To Whom It May Concern:

This letter confirms that {{patient_name}}, date of birth {{dob}}, was evaluated via telehealth on {{visit_date}} for a medical condition.

Based on my clinical assessment, {{patient_name}} is excused from {{work_or_school}} from {{start_date}} through {{end_date}}.

{{#if restrictions}}Restrictions: {{restrictions}}{{/if}}

{{#if follow_up}}A follow-up appointment has been scheduled for {{follow_up_date}}.{{/if}}

If you have any questions regarding this matter, please do not hesitate to contact our office.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'employment', 1,
'["patient_name","dob","visit_date","work_or_school","start_date","end_date","restrictions","follow_up_date","doctor_name","credentials","practice_name","npi","phone"]'::jsonb),

-- Specialist Referral
('referral', 'Specialist Referral', 'Refers patient to specialist with clinical summary',
'Date: {{date}}

{{recipient_name}}, {{recipient_credentials}}
{{recipient_practice}}
{{recipient_address}}

RE: Referral for {{patient_name}} (DOB: {{dob}})

Dear {{recipient_salutation}}:

I am referring the above-named patient to your care for evaluation and management of {{referral_reason}}.

RELEVANT CLINICAL HISTORY:
{{clinical_summary}}

CURRENT MEDICATIONS:
{{medications_list}}

KNOWN ALLERGIES:
{{allergies_list}}

CURRENT DIAGNOSIS:
{{diagnosis_with_icd10}}

I would appreciate your evaluation and recommendations regarding this patient''s condition. Please forward your findings and recommendations to our office at your earliest convenience.

Thank you for your assistance in the care of this patient.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}} | Fax: {{fax}}',
true, 'referral', 2,
'["recipient_name","recipient_credentials","recipient_practice","recipient_address","recipient_salutation","patient_name","dob","referral_reason","clinical_summary","medications_list","allergies_list","diagnosis_with_icd10","doctor_name","credentials","practice_name","npi","phone","fax"]'::jsonb),

-- Return to Work/School Clearance
('return_clearance', 'Return to Work/School Clearance', 'Clears patient to return with or without restrictions',
'Date: {{date}}

RE: Return to {{work_or_school}} Clearance
Patient: {{patient_name}} (DOB: {{dob}})

To Whom It May Concern:

{{patient_name}} has been under my medical care for {{condition}}.

Based on my clinical evaluation performed on {{visit_date}}, I am clearing {{patient_name}} to return to {{work_or_school}} effective {{return_date}}.

{{#if full_clearance}}The patient may resume all normal duties and activities without restriction.{{else}}The following restrictions are recommended for {{restriction_duration}}:
{{restrictions}}

A follow-up evaluation has been scheduled for {{follow_up_date}} to reassess these restrictions.{{/if}}

Please do not hesitate to contact our office with any questions.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'employment', 3,
'["patient_name","dob","condition","visit_date","work_or_school","return_date","full_clearance","restriction_duration","restrictions","follow_up_date","doctor_name","credentials","practice_name","npi","phone"]'::jsonb),

-- FMLA Certification
('fmla', 'FMLA Certification Support Letter', 'Supports FMLA leave request with clinical documentation',
'Date: {{date}}

RE: Family and Medical Leave Act (FMLA) Certification
Patient: {{patient_name}} (DOB: {{dob}})
Employer: {{employer_name}}

To Whom It May Concern:

I am the treating physician for {{patient_name}}, whom I evaluated via telehealth on {{visit_date}}. This visit qualifies as an in-person visit per U.S. Department of Labor Field Assistance Bulletin 2020-8.

DIAGNOSIS: {{diagnosis_with_icd10}}

CONDITION DESCRIPTION:
{{condition_description}}

This condition {{#if is_chronic}}is chronic/ongoing and was first diagnosed on {{first_diagnosed}}{{else}}began approximately {{onset_description}}{{/if}}.

{{#if intermittent}}The patient may experience episodic flare-ups requiring absence from work approximately {{frequency}} per {{period}}, with each episode lasting approximately {{episode_duration}}.{{else}}The patient requires continuous leave from {{leave_start}} through {{estimated_return}}.{{/if}}

{{#if work_restrictions}}FUNCTIONAL LIMITATIONS AND WORK RESTRICTIONS:
{{work_restrictions}}{{/if}}

{{#if treatment_plan}}CURRENT TREATMENT PLAN:
{{treatment_plan}}{{/if}}

I certify that the above information is accurate to the best of my medical knowledge. Please do not hesitate to contact our office for additional information.

Sincerely,

{{doctor_name}}, {{credentials}}
License #: {{license_number}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}} | Fax: {{fax}}',
true, 'employment', 4,
'["patient_name","dob","employer_name","visit_date","diagnosis_with_icd10","condition_description","is_chronic","first_diagnosed","onset_description","intermittent","frequency","period","episode_duration","leave_start","estimated_return","work_restrictions","treatment_plan","doctor_name","credentials","license_number","practice_name","npi","phone","fax"]'::jsonb),

-- Prior Authorization
('prior_auth', 'Prior Authorization / Medical Necessity', 'Justifies treatment to insurance',
'Date: {{date}}

{{insurance_company}}
{{insurance_address}}

RE: Prior Authorization Request
Patient: {{patient_name}} (DOB: {{dob}})
Member ID: {{member_id}}
Group #: {{group_number}}

To Whom It May Concern:

I am writing to request prior authorization for {{requested_treatment}} for my patient, {{patient_name}}.

DIAGNOSIS: {{diagnosis_with_icd10}}

CLINICAL JUSTIFICATION:
{{clinical_summary}}

PREVIOUS TREATMENTS ATTEMPTED:
{{previous_treatments}}

MEDICAL NECESSITY:
{{requested_treatment}} is medically necessary because {{medical_reasoning}}.

Without this treatment, the patient is at risk of {{risk_without_treatment}}.

Please approve this request at your earliest convenience. Do not hesitate to contact our office if additional clinical information is needed.

Sincerely,

{{doctor_name}}, {{credentials}}
NPI: {{npi}}
Phone: {{phone}} | Fax: {{fax}}',
true, 'insurance', 5,
'["insurance_company","insurance_address","patient_name","dob","member_id","group_number","requested_treatment","diagnosis_with_icd10","clinical_summary","previous_treatments","medical_reasoning","risk_without_treatment","doctor_name","credentials","npi","phone","fax"]'::jsonb),

-- Disability / ADA Accommodation
('disability_ada', 'Disability/ADA Accommodation Letter', 'Documents functional limitations for workplace accommodation',
'Date: {{date}}

RE: Request for Reasonable Accommodation under the Americans with Disabilities Act
Patient: {{patient_name}} (DOB: {{dob}})
Employer: {{employer_name}}

To Whom It May Concern:

{{patient_name}} is a patient under my medical care. I am writing to support their request for reasonable workplace accommodations under the Americans with Disabilities Act (ADA).

DIAGNOSIS: {{diagnosis_with_icd10}}

FUNCTIONAL LIMITATIONS:
{{functional_limitations}}

RECOMMENDED ACCOMMODATIONS:
{{recommended_accommodations}}

EXPECTED DURATION:
{{duration_description}}

These accommodations are medically necessary to enable {{patient_name}} to perform the essential functions of their position. The above recommendations are based on my clinical assessment and are consistent with current medical evidence.

I am available to discuss these recommendations further if needed.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'employment', 6,
'["patient_name","dob","employer_name","diagnosis_with_icd10","functional_limitations","recommended_accommodations","duration_description","doctor_name","credentials","practice_name","npi","phone"]'::jsonb),

-- ESA Letter
('esa', 'Emotional Support Animal Letter', 'Certifies need for ESA under Fair Housing Act',
'Date: {{date}}

RE: Emotional Support Animal Recommendation
Patient: {{patient_name}} (DOB: {{dob}})

To Whom It May Concern:

I am a licensed healthcare provider currently treating {{patient_name}}. This letter serves to confirm that {{patient_name}} is under my professional care for a diagnosed mental health condition as defined by the Diagnostic and Statistical Manual of Mental Disorders (DSM-5).

Based on my clinical assessment, {{patient_name}} has a disability-related need for an emotional support animal as part of their ongoing treatment. The presence of an emotional support animal provides therapeutic benefit that alleviates one or more identified symptoms or effects of their condition.

This recommendation is made in accordance with the Fair Housing Act (FHA), Section 504 of the Rehabilitation Act, and relevant federal and state regulations.

This letter is valid for one year from the date issued.

Sincerely,

{{doctor_name}}, {{credentials}}
License #: {{license_number}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'legal', 7,
'["patient_name","dob","doctor_name","credentials","license_number","practice_name","npi","phone"]'::jsonb),

-- Care Transfer Summary
('care_transfer', 'Care Transfer / Medical Summary', 'Comprehensive summary for provider-to-provider handoff',
'Date: {{date}}

{{recipient_name}}, {{recipient_credentials}}
{{recipient_practice}}

RE: Transfer of Care — {{patient_name}} (DOB: {{dob}})

Dear {{recipient_salutation}}:

I am writing to facilitate the transfer of care for the above-named patient, who has been under my care since {{care_since}}.

ACTIVE DIAGNOSES:
{{active_problems}}

CURRENT MEDICATIONS:
{{medications_list}}

KNOWN ALLERGIES:
{{allergies_list}}

RELEVANT MEDICAL HISTORY:
{{medical_history}}

RECENT LABS/IMAGING:
{{recent_results}}

CURRENT TREATMENT PLAN:
{{treatment_plan}}

REASON FOR TRANSFER:
{{transfer_reason}}

Please do not hesitate to contact our office for additional records or questions regarding this patient''s care.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}} | Fax: {{fax}}',
true, 'referral', 8,
'["recipient_name","recipient_credentials","recipient_practice","recipient_salutation","patient_name","dob","care_since","active_problems","medications_list","allergies_list","medical_history","recent_results","treatment_plan","transfer_reason","doctor_name","credentials","practice_name","npi","phone","fax"]'::jsonb),

-- Travel Medical Letter
('travel_medical', 'Travel Medical Letter', 'Certifies conditions and medications for international travel',
'Date: {{date}}

RE: Medical Documentation for International Travel
Patient: {{patient_name}} (DOB: {{dob}})
Passport #: {{passport_number}}
Travel Dates: {{travel_dates}}
Destination(s): {{destinations}}

To Whom It May Concern:

This letter certifies that {{patient_name}} is a patient under my medical care and is medically cleared for travel.

MEDICAL CONDITIONS:
{{conditions_list}}

PRESCRIBED MEDICATIONS (must travel with patient):
{{medications_with_dosages}}

{{#if medical_devices}}MEDICAL DEVICES/EQUIPMENT:
{{medical_devices}}{{/if}}

{{#if special_needs}}SPECIAL ACCOMMODATIONS REQUIRED:
{{special_needs}}{{/if}}

All medications listed above are prescribed by a licensed physician and are medically necessary for the patient''s ongoing treatment. These medications should be permitted through customs and security checkpoints.

Sincerely,

{{doctor_name}}, {{credentials}}
License #: {{license_number}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'travel', 9,
'["patient_name","dob","passport_number","travel_dates","destinations","conditions_list","medications_with_dosages","medical_devices","special_needs","doctor_name","credentials","license_number","practice_name","npi","phone"]'::jsonb),

-- Jury Duty Excuse
('jury_duty', 'Jury Duty Medical Excuse', 'Excuses patient from jury duty on medical grounds',
'Date: {{date}}

{{court_name}}
{{court_address}}

RE: Request for Medical Exemption from Jury Service
Patient: {{patient_name}} (DOB: {{dob}})
Juror #: {{juror_number}}
Service Date(s): {{service_dates}}

Dear Jury Commissioner:

I am the treating physician for {{patient_name}}. I am writing to respectfully request that {{patient_name}} be excused from jury duty on medical grounds.

{{patient_name}} is currently under my care for a medical condition that would prevent them from fulfilling the duties required of a juror at this time.

{{#if specific_limitations}}Specifically, the following limitations apply:
{{specific_limitations}}{{/if}}

I respectfully request that {{patient_name}} be excused from jury service {{#if temporary}}until {{expected_recovery}}{{else}}indefinitely{{/if}}.

Thank you for your understanding and consideration.

Sincerely,

{{doctor_name}}, {{credentials}}
License #: {{license_number}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'legal', 10,
'["court_name","court_address","patient_name","dob","juror_number","service_dates","specific_limitations","temporary","expected_recovery","doctor_name","credentials","license_number","practice_name","npi","phone"]'::jsonb),

-- Fitness for Duty / Sports Clearance
('fitness_duty', 'Fitness for Duty / Sports Clearance', 'Clears patient for specific physical activities or duties',
'Date: {{date}}

RE: {{clearance_type}} Clearance
Patient: {{patient_name}} (DOB: {{dob}})

To Whom It May Concern:

This letter certifies that {{patient_name}} was evaluated on {{visit_date}} and is cleared for {{activity_description}}.

{{#if conditions}}The following conditions were noted: {{conditions}}{{/if}}

{{#if restrictions}}The following restrictions apply: {{restrictions}}
These restrictions should be re-evaluated on {{reevaluation_date}}.{{else}}No restrictions apply at this time.{{/if}}

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'employment', 11,
'["clearance_type","patient_name","dob","visit_date","activity_description","conditions","restrictions","reevaluation_date","doctor_name","credentials","practice_name","npi","phone"]'::jsonb),

-- School/Daycare Health Form
('school_form', 'School/Daycare Health Form Letter', 'Health status documentation for educational institutions',
'Date: {{date}}

{{school_name}}
{{school_address}}

RE: Health Documentation for {{patient_name}} (DOB: {{dob}})
Grade/Class: {{grade_class}}

Dear School Administrator:

This letter confirms that {{patient_name}} was evaluated on {{visit_date}} and the following health information is provided for school records:

IMMUNIZATION STATUS: {{immunization_status}}

KNOWN ALLERGIES: {{allergies_list}}

CURRENT MEDICATIONS: {{medications_list}}

{{#if special_needs}}SPECIAL HEALTH NEEDS / ACCOMMODATIONS:
{{special_needs}}{{/if}}

{{#if activity_restrictions}}PHYSICAL ACTIVITY RESTRICTIONS:
{{activity_restrictions}}{{/if}}

Please contact our office if you require additional documentation.

Sincerely,

{{doctor_name}}, {{credentials}}
{{practice_name}}
NPI: {{npi}}
Phone: {{phone}}',
true, 'school', 12,
'["school_name","school_address","patient_name","dob","grade_class","visit_date","immunization_status","allergies_list","medications_list","special_needs","activity_restrictions","doctor_name","credentials","practice_name","npi","phone"]'::jsonb)

ON CONFLICT DO NOTHING;

-- ─── 8. Disable RLS on new tables ─────────────────────────────
ALTER TABLE chart_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_notes ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
CREATE POLICY "service_role_all_chart_settings" ON chart_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_medical_letters" ON medical_letters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_letter_templates" ON letter_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_chart_drafts" ON chart_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_problem_notes" ON problem_notes FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- DONE — Run this in Supabase SQL Editor, then deploy
-- ═══════════════════════════════════════════════════════════════

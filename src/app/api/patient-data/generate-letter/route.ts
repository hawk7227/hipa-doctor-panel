import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LETTER_TYPE_DESCRIPTIONS: Record<string, string> = {
  work_excuse: 'A professional medical excuse letter for work or school absence',
  referral: 'A specialist referral letter with clinical summary',
  return_clearance: 'A return to work/school medical clearance letter',
  fmla: 'An FMLA certification support letter with clinical documentation',
  prior_auth: 'A prior authorization / medical necessity letter to insurance',
  disability_ada: 'A disability/ADA workplace accommodation letter',
  esa: 'An emotional support animal recommendation letter',
  care_transfer: 'A care transfer summary letter to another provider',
  travel_medical: 'A travel medical documentation letter',
  jury_duty: 'A jury duty medical excuse letter',
  fitness_duty: 'A fitness for duty / sports clearance letter',
  school_form: 'A school/daycare health documentation letter',
  medical_necessity: 'A medical necessity justification letter',
  other: 'A professional medical letter',
}

export async function POST(req: NextRequest) {
  try {
    const { patient_id, doctor_id, doctor_name, letter_type, template_id,
      recipient_name, recipient_organization, additional_context } = await req.json()

    if (!patient_id || !letter_type) {
      return NextResponse.json({ error: 'patient_id and letter_type required' }, { status: 400 })
    }

    // 1. Gather patient data
    const [patientRes, medsRes, allergiesRes, problemsRes, appointmentsRes, settingsRes] = await Promise.all([
      db.from('patients').select('*').eq('id', patient_id).single(),
      db.from('patient_medications').select('*').eq('patient_id', patient_id).eq('status', 'active').limit(20),
      db.from('patient_allergies').select('*').eq('patient_id', patient_id).limit(20),
      db.from('patient_problems').select('*').eq('patient_id', patient_id).eq('status', 'active').limit(20),
      db.from('appointments').select('id, visit_type, chief_complaint, symptoms, created_at').eq('patient_id', patient_id).order('created_at', { ascending: false }).limit(5),
      doctor_id ? db.from('chart_settings').select('*').eq('doctor_id', doctor_id).single() : Promise.resolve({ data: null }),
    ])

    const patient = patientRes.data
    const medications = medsRes.data || []
    const allergies = allergiesRes.data || []
    const problems = problemsRes.data || []
    const appointments = appointmentsRes.data || []
    const practiceSettings = settingsRes.data

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // 2. Get template if specified
    let templateBody = ''
    if (template_id) {
      const { data: template } = await db.from('letter_templates').select('body_template').eq('id', template_id).single()
      if (template) templateBody = template.body_template
    }

    // 3. Build AI prompt
    const patientSummary = [
      `Patient: ${patient.first_name} ${patient.last_name}`,
      `DOB: ${patient.date_of_birth || 'Unknown'}`,
      `Gender: ${patient.gender || 'Not specified'}`,
      medications.length > 0 ? `Current Medications: ${medications.map((m: any) => m.name || m.medication_name || m.description).filter(Boolean).join(', ')}` : 'No current medications',
      allergies.length > 0 ? `Allergies: ${allergies.map((a: any) => a.allergen || a.description).filter(Boolean).join(', ')}` : 'No known allergies',
      problems.length > 0 ? `Active Problems: ${problems.map((p: any) => `${p.description}${p.icd10_code ? ` (${p.icd10_code})` : ''}`).join(', ')}` : 'No active problems',
      appointments.length > 0 ? `Recent Visit: ${appointments[0].created_at?.split('T')[0]} — ${appointments[0].chief_complaint || appointments[0].symptoms || 'General visit'}` : '',
    ].filter(Boolean).join('\n')

    const practiceSummary = practiceSettings ? [
      practiceSettings.practice_name || 'Medazon Health',
      practiceSettings.practice_address ? `${practiceSettings.practice_address}, ${practiceSettings.practice_city || ''}, ${practiceSettings.practice_state || 'FL'} ${practiceSettings.practice_zip || ''}` : '',
      practiceSettings.practice_phone ? `Phone: ${practiceSettings.practice_phone}` : '',
      practiceSettings.practice_fax ? `Fax: ${practiceSettings.practice_fax}` : '',
      practiceSettings.practice_npi ? `NPI: ${practiceSettings.practice_npi}` : '',
    ].filter(Boolean).join('\n') : 'Medazon Health\nFlorida'

    const letterDesc = LETTER_TYPE_DESCRIPTIONS[letter_type] || 'A professional medical letter'

    const prompt = `You are a medical documentation AI assistant helping a licensed physician generate a professional medical letter.

Generate ${letterDesc} for the following patient. The letter should be polished, professional, HIPAA-compliant, and ready for the doctor to review and sign.

PRACTICE INFORMATION:
${practiceSummary}
Provider: ${doctor_name || 'Provider'}

PATIENT INFORMATION:
${patientSummary}

${recipient_name ? `RECIPIENT: ${recipient_name}${recipient_organization ? ` at ${recipient_organization}` : ''}` : ''}
${additional_context ? `ADDITIONAL CONTEXT: ${additional_context}` : ''}

${templateBody ? `USE THIS TEMPLATE STRUCTURE AS A GUIDE (fill in the variables appropriately):\n${templateBody}` : ''}

IMPORTANT RULES:
- Use today's date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
- Be specific but protect patient privacy — only include clinically relevant details
- Use professional medical language
- Include appropriate ICD-10 codes where relevant
- End with the doctor's signature block
- Do NOT include any markdown formatting — plain text only
- Do NOT fabricate clinical details — use only what is provided above
- If a field is unknown, use a reasonable placeholder like "[to be determined]"
- For FMLA letters: note that telehealth visits qualify as in-person visits per DOL guidance

Generate the complete letter text now:`

    // 4. Call Claude API
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      // Fallback: use template with basic substitution
      let fallback = templateBody || `Date: ${new Date().toLocaleDateString()}\n\nTo Whom It May Concern:\n\nThis letter is regarding ${patient.first_name} ${patient.last_name}.\n\n[Letter content to be completed by provider]\n\nSincerely,\n${doctor_name || 'Provider'}`
      fallback = fallback
        .replace(/\{\{patient_name\}\}/g, `${patient.first_name} ${patient.last_name}`)
        .replace(/\{\{dob\}\}/g, patient.date_of_birth || '[DOB]')
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{doctor_name\}\}/g, doctor_name || 'Provider')
        .replace(/\{\{practice_name\}\}/g, practiceSettings?.practice_name || 'Medazon Health')
        .replace(/\{\{npi\}\}/g, practiceSettings?.practice_npi || '[NPI]')
        .replace(/\{\{phone\}\}/g, practiceSettings?.practice_phone || '[Phone]')
        .replace(/\{\{fax\}\}/g, practiceSettings?.practice_fax || '[Fax]')
        .replace(/\{\{visit_date\}\}/g, appointments[0]?.created_at?.split('T')[0] || new Date().toLocaleDateString())
        .replace(/\{\{[^}]+\}\}/g, '[To be completed]')
      return NextResponse.json({ letter_text: fallback })
    }

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('[generate-letter] AI error:', errText)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const letterText = aiData.content?.map((c: any) => c.text || '').join('') || ''

    console.log(`[generate-letter] Generated ${letter_type} for patient=${patient_id} (${letterText.length} chars)`)
    return NextResponse.json({ letter_text: letterText })

  } catch (err: any) {
    console.error('[generate-letter] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

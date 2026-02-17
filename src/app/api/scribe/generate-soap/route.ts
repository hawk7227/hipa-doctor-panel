// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

async function getDoctorId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const sb = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user } } = await sb.auth.getUser(token)
  return user?.id || null
}

// SOAP generation prompt — adapts to doctor's editing style
function buildPrompt(transcript: string, patientName: string, doctorName: string, stylePreferences?: string): string {
  let styleInstructions = ''
  if (stylePreferences) {
    try {
      const prefs = JSON.parse(stylePreferences)
      if (prefs.editCount > 2 && prefs.patterns?.length > 0) {
        const recent = prefs.patterns.slice(-3)
        styleInstructions = `\n\nIMPORTANT — This doctor has edited ${prefs.editCount} previous SOAP notes. Learn from their style:\n`
        recent.forEach((p: any, i: number) => {
          if (p.editedAssessment) styleInstructions += `Example Assessment style: "${p.editedAssessment.slice(0, 300)}"\n`
          if (p.editedPlan) styleInstructions += `Example Plan style: "${p.editedPlan.slice(0, 300)}"\n`
        })
        styleInstructions += '\nMatch this doctor\'s writing style, level of detail, and terminology preferences.\n'
      }
    } catch { /* ignore parse errors */ }
  }

  return `You are Medazon Scribe, a medical documentation AI assistant. You generate SOAP notes from doctor-patient conversations.

RULES:
- Only include information that was ACTUALLY discussed in the conversation
- Never fabricate symptoms, findings, or plans not mentioned
- Use standard medical terminology
- Be concise but thorough
- The doctor and patient conversation is the SOLE source of truth
- If something is unclear in the transcript, note it as "per patient report" or "discussed"
- Do NOT include information about the AI scribe itself in the notes
${styleInstructions}

TRANSCRIPT between ${doctorName} and ${patientName}:
---
${transcript}
---

Generate a structured SOAP note from this conversation. Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
{
  "subjective": "Patient's reported symptoms, history, and concerns from the conversation",
  "objective": "Physical exam findings, vitals, test results discussed. Write 'See examination' if no specific findings were discussed",
  "assessment": "Clinical assessment and differential diagnoses based on the conversation",
  "plan": "Treatment plan, medications, follow-up discussed. Number each item",
  "icd10Codes": ["CODE1 - Description", "CODE2 - Description"],
  "patientInstructions": "Plain-language summary for the patient of what was discussed and what they need to do"
}`
}

// Try Anthropic Claude first (cheaper), fallback to OpenAI
async function callLLM(prompt: string): Promise<string> {
  // Try Claude
  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text
        if (text) return text
      }
    } catch { /* fallback */ }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.choices?.[0]?.message?.content || ''
    }
  }

  throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
}

// POST /api/scribe/generate-soap
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const doctorId = await getDoctorId(req)
    if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { transcript, patientName, doctorName, appointmentId, stylePreferences } = await req.json()

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ error: 'Transcript too short to generate notes' }, { status: 400 })
    }

    const prompt = buildPrompt(transcript, patientName || 'Patient', doctorName || 'Doctor', stylePreferences)
    const rawResponse = await callLLM(prompt)

    // Parse JSON from response (strip any markdown if LLM wraps it)
    const cleaned = rawResponse.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: cleaned.slice(0, 200) }, { status: 500 })
      }
    }

    return NextResponse.json({
      subjective: parsed.subjective || '',
      objective: parsed.objective || '',
      assessment: parsed.assessment || '',
      plan: parsed.plan || '',
      icd10Codes: Array.isArray(parsed.icd10Codes) ? parsed.icd10Codes : [],
      patientInstructions: parsed.patientInstructions || '',
    })
  } catch (err: any) {
    console.error('Scribe SOAP generation error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate SOAP notes' }, { status: 500 })
  }
}

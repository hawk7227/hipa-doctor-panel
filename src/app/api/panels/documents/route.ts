// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, resolvePatientIds, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { uuid: resolvedUuid, dcId } = await resolvePatientIds(patient_id)
  try {

    // DrChrono documents
    let drchronoDocs: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_documents').select('*').eq('drchrono_patient_id', dcId).order('date', { ascending: false }).limit(100)
      drchronoDocs = (data || []).map((d: any) => ({ ...d, _source: 'drchrono' }))
    }

    // Local uploaded documents
    let localDocs: any[] = []
    try {
      const { data } = await db.from('patient_documents').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(100)
      localDocs = (data || []).map((d: any) => ({ ...d, _source: 'local' }))
    } catch { /* table may not exist yet */ }

    // Clinical notes (for locked notes tab)
    let clinicalNotes: any[] = []
    try {
      const { data: local } = await db.from('clinical_notes').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
      clinicalNotes = local || []
      if (dcId) {
        const { data: dc } = await db.from('drchrono_clinical_notes').select('*').eq('drchrono_patient_id', dcId).order('created_at', { ascending: false }).limit(50)
        if (dc) clinicalNotes.push(...dc)
      }
    } catch { /* ok */ }

    // Referrals
    let referrals: any[] = []
    try {
      const { data } = await db.from('referrals').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
      referrals = data || []
    } catch { /* table may not exist */ }

    // Amendments
    let amendments: any[] = []
    try {
      const { data } = await db.from('chart_addendums').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
      amendments = data || []
    } catch { /* table may not exist */ }

    // Tasks
    let tasks: any[] = []
    try {
      const { data } = await db.from('staff_tasks').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
      tasks = data || []
    } catch { /* table may not exist */ }

    return NextResponse.json({
      data: [...drchronoDocs, ...localDocs],
      clinical_notes: clinicalNotes,
      referrals,
      amendments,
      tasks,
    })
  } catch (err: any) {
    console.error('Documents GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { patient_id, description, document_type, file_url, file_name, tags, doctor_id, uploaded_by } = body
      if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { uuid: resolvedUuid, dcId } = await resolvePatientIds(patient_id)

      const { data, error } = await db.from('patient_documents').insert({
        patient_id,
        description: description || file_name || 'Document',
        document_type: document_type || 'general',
        file_url,
        file_name: file_name || 'document',
        tags: tags || [],
        doctor_id,
        uploaded_by: uploaded_by || 'doctor',
        uploaded_by_type: 'doctor',
      }).select().single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // FormData body (file upload)
    const formData = await req.formData()
    const file = formData.get('file') as File
    const patient_id = formData.get('patient_id') as string
    const description = (formData.get('description') as string) || file?.name || 'Document'
    const document_type = (formData.get('document_type') as string) || 'general'
    const doctor_id = formData.get('doctor_id') as string | null

    if (!file || !patient_id) {
      return NextResponse.json({ error: 'file and patient_id required' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const fileName = `${patient_id}/${Date.now()}_${file.name}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let file_url = ''
    try {
      const { data: uploadData, error: uploadError } = await db.storage
        .from('patient-documents')
        .upload(fileName, buffer, { contentType: file.type, upsert: false })

      if (!uploadError && uploadData) {
        const { data: urlData } = db.storage.from('patient-documents').getPublicUrl(uploadData.path)
        file_url = urlData.publicUrl
      }
    } catch {
      console.error('Storage upload failed, saving record without URL')
    }

    const { data: docData, error: docError } = await db.from('patient_documents').insert({
      patient_id,
      file_name: file.name,
      description,
      document_type,
      file_url,
      file_size: file.size,
      mime_type: file.type,
      tags: [],
      doctor_id: doctor_id || null,
      uploaded_by: 'doctor',
      uploaded_by_type: 'doctor',
    }).select().single()

    if (docError) throw docError
    return NextResponse.json({ data: docData })
  } catch (err: any) {
    console.error('Documents POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const document_id = req.nextUrl.searchParams.get('document_id')
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!document_id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

  try {
    const { data: doc } = await db.from('patient_documents').select('file_url, file_name').eq('id', document_id).single()

    if (doc?.file_url && patient_id) {
      try {
        const path = `${patient_id}/${doc.file_name}`
        await db.storage.from('patient-documents').remove([path])
      } catch { /* ok */ }
    }

    const { error } = await db.from('patient_documents').delete().eq('id', document_id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { document_id, tags, description, document_type } = body
    if (!document_id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

    const update: any = { updated_at: new Date().toISOString() }
    if (tags !== undefined) update.tags = tags
    if (description !== undefined) update.description = description
    if (document_type !== undefined) update.document_type = document_type

    const { data, error } = await db.from('patient_documents').update(update).eq('id', document_id).select().single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for documents
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId, resolvePatientIds
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from documents panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId, resolvePatientIds()
// ═══════════════════════════════════════════════════════════════

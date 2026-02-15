import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch tasks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const doctorId = searchParams.get('doctorId')
    const staffId = searchParams.get('staffId')
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assignedTo')

    if (!doctorId) return NextResponse.json({ error: 'doctorId required' }, { status: 400 })

    let query = supabaseAdmin
      .from('staff_tasks')
      .select(`
        id, title, description, priority, status, category,
        due_date, notes, created_at, updated_at, completed_at,
        patient_id, appointment_id,
        assigned_to_staff:doctor_staff!staff_tasks_assigned_to_fkey(id, first_name, last_name, role, email),
        assigned_by_staff:doctor_staff!staff_tasks_assigned_by_fkey(id, first_name, last_name, role, email),
        completed_by_staff:doctor_staff!staff_tasks_completed_by_fkey(id, first_name, last_name, role),
        patients(first_name, last_name),
        staff_task_comments(id, content, created_at,
          doctor_staff(first_name, last_name))
      `)
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') query = query.eq('status', status)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    if (staffId && !assignedTo) {
      // Show tasks assigned to this person OR created by them
      query = query.or(`assigned_to.eq.${staffId},assigned_by.eq.${staffId}`)
    }

    const { data: tasks, error } = await query.limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ tasks: tasks || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Create, update, complete tasks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, doctorId, staffId } = body

    if (!doctorId || !staffId) return NextResponse.json({ error: 'doctorId and staffId required' }, { status: 400 })

    // Create task
    if (action === 'create') {
      const { title, description, priority, category, assignedTo, patientId, appointmentId, dueDate } = body
      if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

      const { data: task, error } = await supabaseAdmin
        .from('staff_tasks')
        .insert({
          doctor_id: doctorId,
          title,
          description,
          priority: priority || 'normal',
          category: category || 'general',
          assigned_to: assignedTo || null,
          assigned_by: staffId,
          patient_id: patientId || null,
          appointment_id: appointmentId || null,
          due_date: dueDate || null
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Notify assigned staff
      if (assignedTo && assignedTo !== staffId) {
        const { data: assigner } = await supabaseAdmin
          .from('doctor_staff')
          .select('first_name, last_name')
          .eq('id', staffId)
          .single()

        const assignerName = `${assigner?.first_name || ''} ${assigner?.last_name || ''}`.trim()

        await supabaseAdmin.from('staff_notifications').insert({
          doctor_id: doctorId,
          recipient_id: assignedTo,
          type: 'task_assigned',
          title: `New task from ${assignerName}`,
          body: title,
          link: `/doctor/staff-hub?tab=tasks&taskId=${task.id}`,
          reference_type: 'task',
          reference_id: task.id
        })
      }

      // Audit log (non-critical)
      try {
        await supabaseAdmin.from('chart_audit_log').insert({
          action: 'task_created',
          performed_by_name: staffId,
          performed_by_role: 'staff',
          details: { task_id: task.id, title, assigned_to: assignedTo }
        })
      } catch {} // non-critical

      return NextResponse.json({ task })
    }

    // Update task status
    if (action === 'update_status') {
      const { taskId, status: newStatus } = body
      if (!taskId || !newStatus) return NextResponse.json({ error: 'taskId and status required' }, { status: 400 })

      const updates: any = { status: newStatus }
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString()
        updates.completed_by = staffId
      }

      const { data: task, error } = await supabaseAdmin
        .from('staff_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Notify assigner when completed
      if (newStatus === 'completed' && task.assigned_by !== staffId) {
        const { data: completer } = await supabaseAdmin
          .from('doctor_staff')
          .select('first_name, last_name')
          .eq('id', staffId)
          .single()

        await supabaseAdmin.from('staff_notifications').insert({
          doctor_id: doctorId,
          recipient_id: task.assigned_by,
          type: 'task_completed',
          title: `Task completed by ${completer?.first_name || ''} ${completer?.last_name || ''}`.trim(),
          body: task.title,
          link: `/doctor/staff-hub?tab=tasks&taskId=${task.id}`,
          reference_type: 'task',
          reference_id: task.id
        })
      }

      return NextResponse.json({ task })
    }

    // Add comment
    if (action === 'add_comment') {
      const { taskId, content } = body
      if (!taskId || !content) return NextResponse.json({ error: 'taskId and content required' }, { status: 400 })

      const { data: comment, error } = await supabaseAdmin
        .from('staff_task_comments')
        .insert({ task_id: taskId, staff_id: staffId, content })
        .select(`id, content, created_at, doctor_staff(first_name, last_name)`)
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ comment })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

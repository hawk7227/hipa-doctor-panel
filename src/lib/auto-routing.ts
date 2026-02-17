// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AutoRoutingRule {
  id: string
  trigger: 'on_sign' | 'on_close' | 'on_lock'
  action: 'assign_task' | 'notify' | 'create_followup'
  to_role: string
  task_title: string
  task_description?: string
}

/**
 * Fire auto-routing rules when a chart event occurs.
 * Creates staff_tasks for matching rules.
 */
export async function fireAutoRouting(
  trigger: 'on_sign' | 'on_close' | 'on_lock',
  doctorId: string,
  appointmentId: string,
  patientId: string | null,
  providerName: string,
) {
  try {
    // 1. Fetch doctor's routing rules
    const { data: prefs } = await supabaseAdmin
      .from('doctor_chart_preferences')
      .select('auto_routing_rules')
      .eq('doctor_id', doctorId)
      .maybeSingle()

    if (!prefs?.auto_routing_rules) {
      console.log(`[AutoRouting] No rules configured for doctor ${doctorId}`)
      return { tasksCreated: 0 }
    }

    const rules = (prefs.auto_routing_rules as AutoRoutingRule[]).filter(r => r.trigger === trigger)
    if (rules.length === 0) {
      console.log(`[AutoRouting] No ${trigger} rules found`)
      return { tasksCreated: 0 }
    }

    // 2. For each rule, find matching staff and create tasks
    let tasksCreated = 0
    for (const rule of rules) {
      if (rule.action === 'assign_task') {
        // Find staff members with matching role
        const { data: staffMembers } = await supabaseAdmin
          .from('practice_staff')
          .select('id, first_name, last_name, role, email')
          .eq('doctor_id', doctorId)
          .eq('role', rule.to_role)
          .eq('active', true)

        if (!staffMembers || staffMembers.length === 0) {
          console.log(`[AutoRouting] No active ${rule.to_role} staff found for rule: ${rule.task_title}`)
          continue
        }

        // Get the doctor's staff ID (for assigned_by)
        const { data: doctorStaff } = await supabaseAdmin
          .from('practice_staff')
          .select('id')
          .eq('doctor_id', doctorId)
          .eq('role', 'provider')
          .maybeSingle()

        // Create task for each matching staff member
        for (const staff of staffMembers) {
          const { error: taskErr } = await supabaseAdmin
            .from('staff_tasks')
            .insert({
              doctor_id: doctorId,
              title: rule.task_title,
              description: rule.task_description || `Auto-created when chart was ${trigger === 'on_sign' ? 'signed' : trigger === 'on_close' ? 'closed' : 'locked'} by ${providerName}`,
              priority: 'medium',
              status: 'pending',
              category: 'chart',
              assigned_to: staff.id,
              assigned_by: doctorStaff?.id || null,
              appointment_id: appointmentId,
              patient_id: patientId,
              due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due in 24h
            })

          if (taskErr) {
            console.error(`[AutoRouting] Task creation error for staff ${staff.id}:`, taskErr)
          } else {
            tasksCreated++
            console.log(`[AutoRouting] Created task "${rule.task_title}" for ${staff.first_name} ${staff.last_name} (${staff.role})`)
          }
        }
      }

      if (rule.action === 'notify') {
        // Create notification for matching staff
        const { data: staffMembers } = await supabaseAdmin
          .from('practice_staff')
          .select('id')
          .eq('doctor_id', doctorId)
          .eq('role', rule.to_role)
          .eq('active', true)

        for (const staff of (staffMembers || [])) {
          await supabaseAdmin.from('staff_notifications').insert({
            staff_id: staff.id,
            doctor_id: doctorId,
            title: rule.task_title,
            body: `Chart ${trigger === 'on_sign' ? 'signed' : 'closed'} by ${providerName}`,
            type: 'chart_event',
            read: false,
          }).catch(() => {}) // Best effort
          tasksCreated++
        }
      }
    }

    console.log(`[AutoRouting] Fired ${trigger}: ${tasksCreated} tasks/notifications created`)
    return { tasksCreated }
  } catch (err) {
    console.error('[AutoRouting] Error:', err)
    return { tasksCreated: 0, error: err }
  }
}

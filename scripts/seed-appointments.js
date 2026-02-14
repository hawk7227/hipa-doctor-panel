// Run this from your hipa-doctor-panel folder:
// node scripts/seed-appointments.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kxfibeigvfshamnlpthf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZmliZWlndmZzaGFtbmxwdGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE1NDUzOCwiZXhwIjoyMDc1NzMwNTM4fQ.xv3waIUPnEiGO-wsXrM3m5YRopTa604zJsDyyqMaxfc'
);

async function seed() {
  console.log('Finding doctor...');
  const { data: doctors, error: docErr } = await supabase
    .from('doctors')
    .select('id, email, first_name, last_name')
    .limit(1);

  if (docErr || !doctors?.length) {
    console.error('No doctors found:', docErr);
    return;
  }

  const doctor = doctors[0];
  console.log(`Doctor: ${doctor.first_name} ${doctor.last_name} (${doctor.id})`);

  // Check for existing patients
  let { data: patients } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .limit(3);

  // Create sample patients if none exist
  if (!patients || patients.length === 0) {
    console.log('Creating sample patients...');
    const samplePatients = [
      { first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@example.com', phone: '555-0101', date_of_birth: '1990-05-15', doctor_id: doctor.id },
      { first_name: 'Michael', last_name: 'Chen', email: 'michael.chen@example.com', phone: '555-0102', date_of_birth: '1985-08-22', doctor_id: doctor.id },
      { first_name: 'Emily', last_name: 'Rodriguez', email: 'emily.rodriguez@example.com', phone: '555-0103', date_of_birth: '1978-12-03', doctor_id: doctor.id },
    ];

    const { data: created, error: patErr } = await supabase
      .from('patients')
      .insert(samplePatients)
      .select('id, first_name, last_name');

    if (patErr) {
      console.error('Error creating patients:', patErr);
      return;
    }
    patients = created;
    console.log(`Created ${patients.length} patients`);
  } else {
    console.log(`Found ${patients.length} existing patients`);
  }

  // Create appointments for today and upcoming days
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const appointments = [
    {
      doctor_id: doctor.id,
      patient_id: patients[0]?.id,
      status: 'accepted',
      visit_type: 'video',
      scheduled_time: new Date(today.getTime() + 9 * 3600000).toISOString(), // 9 AM today
      requested_date_time: new Date(today.getTime() + 9 * 3600000).toISOString(),
      chart_status: 'draft',
      chief_complaint: 'UTI symptoms - burning sensation, frequent urination for 3 days',
    },
    {
      doctor_id: doctor.id,
      patient_id: patients[1]?.id || patients[0]?.id,
      status: 'accepted',
      visit_type: 'phone',
      scheduled_time: new Date(today.getTime() + 11 * 3600000).toISOString(), // 11 AM today
      requested_date_time: new Date(today.getTime() + 11 * 3600000).toISOString(),
      chart_status: 'preliminary',
      chief_complaint: 'Follow-up on ADHD medication adjustment - Adderall 20mg',
    },
    {
      doctor_id: doctor.id,
      patient_id: patients[2]?.id || patients[0]?.id,
      status: 'completed',
      visit_type: 'video',
      scheduled_time: new Date(today.getTime() - 2 * 3600000).toISOString(), // 2 hours ago
      requested_date_time: new Date(today.getTime() - 2 * 3600000).toISOString(),
      chart_status: 'signed',
      chart_locked: false,
      chief_complaint: 'STD testing - routine screening, no symptoms',
    },
    {
      doctor_id: doctor.id,
      patient_id: patients[0]?.id,
      status: 'pending',
      visit_type: 'async',
      scheduled_time: new Date(today.getTime() + 86400000 + 10 * 3600000).toISOString(), // Tomorrow 10 AM
      requested_date_time: new Date(today.getTime() + 86400000 + 10 * 3600000).toISOString(),
      chief_complaint: 'Prescription refill request - birth control',
    },
    {
      doctor_id: doctor.id,
      patient_id: patients[1]?.id || patients[0]?.id,
      status: 'accepted',
      visit_type: 'instant',
      scheduled_time: new Date(today.getTime() + 14 * 3600000).toISOString(), // 2 PM today
      requested_date_time: new Date(today.getTime() + 14 * 3600000).toISOString(),
      chart_status: 'draft',
      chief_complaint: 'Urgent care - severe headache and nausea since this morning',
    },
  ];

  console.log('Creating appointments...');
  const { data: created, error: aptErr } = await supabase
    .from('appointments')
    .insert(appointments)
    .select('id, status, visit_type, scheduled_time, chart_status');

  if (aptErr) {
    console.error('Error creating appointments:', aptErr);
    console.error('Details:', JSON.stringify(aptErr, null, 2));
    return;
  }

  console.log(`\n✅ Created ${created.length} appointments:`);
  created.forEach(apt => {
    const time = new Date(apt.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    console.log(`  ${apt.id} — ${apt.visit_type} — ${apt.status} — ${time} — chart: ${apt.chart_status || 'none'}`);
  });

  console.log('\n🎉 Done! Refresh your calendar at http://localhost:3000/doctor/appointments');
  console.log('Click any appointment to open the Appointment Detail Modal.');
}

seed().catch(console.error);

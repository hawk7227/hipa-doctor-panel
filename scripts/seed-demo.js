const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://kxfibeigvfshamnlpthf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZmliZWlndmZzaGFtbmxwdGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE1NDUzOCwiZXhwIjoyMDc1NzMwNTM4fQ.xv3waIUPnEiGO-wsXrM3m5YRopTa604zJsDyyqMaxfc'
);

const docId = '1fd1af57-5529-4d00-a301-e653b4829efc';

async function run() {
  // Get today midnight
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Helper: today + hours
  const h = (hrs) => new Date(today.getTime() + hrs * 3600000).toISOString();

  const apts = [
    { doctor_id: docId, status: 'accepted',  visit_type: 'video', service_type: 'consultation', requested_date_time: h(9),  chief_complaint: 'UTI symptoms - burning sensation for 3 days' },
    { doctor_id: docId, status: 'accepted',  visit_type: 'phone', service_type: 'consultation', requested_date_time: h(11), chief_complaint: 'ADHD follow-up - Adderall 20mg adjustment' },
    { doctor_id: docId, status: 'completed', visit_type: 'video', service_type: 'consultation', requested_date_time: h(8),  chief_complaint: 'STD testing - routine screening' },
    { doctor_id: docId, status: 'accepted',  visit_type: 'video', service_type: 'consultation', requested_date_time: h(14), chief_complaint: 'Severe headache and nausea since morning' },
    { doctor_id: docId, status: 'accepted',  visit_type: 'async', service_type: 'consultation', requested_date_time: h(16), chief_complaint: 'Prescription refill request - birth control' },
  ];

  console.log('Creating 5 appointments for today...');
  const { data, error } = await s.from('appointments').insert(apts).select('id, status, visit_type, requested_date_time');

  if (error) {
    console.error('Error:', error.message);
    console.error('Details:', error.details);
  } else {
    console.log('SUCCESS! Created ' + data.length + ' appointments:');
    data.forEach(a => {
      const t = new Date(a.requested_date_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      console.log('  ' + a.visit_type.padEnd(6) + ' | ' + a.status.padEnd(10) + ' | ' + t + ' | ' + a.id);
    });
    console.log('\nRefresh http://localhost:3000/doctor/appointments to see them!');
  }
}

run();

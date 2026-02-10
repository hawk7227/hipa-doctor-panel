// ═══════════════════════════════════════════════════════════════════
// PATIENTS PAGE SEARCH FIX — Apply these changes to:
// src/app/doctor/patients/page.tsx
// 
// These are the 3 exact search/filter blocks that need updating.
// The rest of the file stays UNTOUCHED.
// ═══════════════════════════════════════════════════════════════════


// ─── FIX 1: Debounced search (around line 720-745) ──────────────
// REPLACE the entire useEffect for search suggestions:

// ❌ OLD CODE (remove this):
/*
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timeoutId = setTimeout(() => {
      const searchLower = searchTerm.toLowerCase()
      const matches = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
        return (
          fullName.includes(searchLower) ||
          patient.first_name.toLowerCase().includes(searchLower) ||
          patient.last_name.toLowerCase().includes(searchLower) ||
          patient.email.toLowerCase().includes(searchLower)
        )
      }).slice(0, 10)
      
      setSearchSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, patients])
*/

// ✅ NEW CODE (paste this in its place):
/*
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timeoutId = setTimeout(() => {
      const searchLower = searchTerm.toLowerCase().trim()
      // Strip non-digits for phone matching
      const searchDigits = searchLower.replace(/[\s\-\(\)\+\.]/g, '')
      const isPhoneSearch = /^\d{3,}$/.test(searchDigits)
      // Check if DOB search (MM/DD/YYYY or similar)
      const isDOBSearch = /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(searchLower) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(searchLower)
      // Check "Last, First" format
      const hasComma = searchLower.includes(',')
      let firstName = '', lastName = ''
      if (hasComma) {
        const parts = searchLower.split(',').map(s => s.trim())
        lastName = parts[0] || ''
        firstName = parts[1] || ''
      }

      const matches = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()

        // Phone search
        if (isPhoneSearch) {
          const patientDigits = (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '')
          return patientDigits.includes(searchDigits)
        }

        // DOB search
        if (isDOBSearch) {
          const dob = patient.date_of_birth || ''
          // Try matching formatted DOB
          const dobFormatted = dob ? new Date(dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''
          return dob.includes(searchLower) || dobFormatted.includes(searchLower)
        }

        // "Last, First" search
        if (hasComma && lastName) {
          const matchLast = patient.last_name.toLowerCase().includes(lastName)
          const matchFirst = !firstName || patient.first_name.toLowerCase().includes(firstName)
          return matchLast && matchFirst
        }

        // Default: name + email + phone combined search
        return (
          fullName.includes(searchLower) ||
          patient.first_name.toLowerCase().includes(searchLower) ||
          patient.last_name.toLowerCase().includes(searchLower) ||
          patient.email.toLowerCase().includes(searchLower) ||
          (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '').includes(searchDigits) ||
          (patient.date_of_birth || '').includes(searchLower)
        )
      }).slice(0, 10)
      
      setSearchSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, patients])
*/


// ─── FIX 2: filteredPatients (around line 771-778) ──────────────
// REPLACE the matchesSearch logic:

// ❌ OLD CODE:
/*
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false
*/

// ✅ NEW CODE:
/*
  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase().trim()
    const searchDigits = searchLower.replace(/[\s\-\(\)\+\.]/g, '')
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
    const patientPhone = (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '')
    
    const matchesSearch = !searchLower ||
      fullName.includes(searchLower) ||
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower) ||
      patient.email.toLowerCase().includes(searchLower) ||
      patientPhone.includes(searchDigits) ||
      (patient.date_of_birth || '').includes(searchLower)

    if (!matchesSearch) return false
*/


// ─── FIX 3: Search placeholder + suggestion display (around line 1253) ──
// REPLACE the placeholder text:

// ❌ OLD: placeholder="Search patients by name or email..."
// ✅ NEW: placeholder="Search by name, DOB, phone, or email..."

// AND in the suggestion dropdown (around line 1289-1295), ADD phone + DOB display:

// ❌ OLD suggestion item:
/*
  <div className="text-sm text-gray-400 truncate">
    {patient.email}
  </div>
*/

// ✅ NEW suggestion item (shows DOB + phone + email):
/*
  <div className="flex items-center gap-3 text-xs text-gray-400">
    {patient.date_of_birth && (
      <span>DOB: {new Date(patient.date_of_birth + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
    )}
    {patient.mobile_phone && (
      <span>{patient.mobile_phone}</span>
    )}
    {patient.email && (
      <span className="truncate">{patient.email}</span>
    )}
  </div>
*/














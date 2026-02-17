// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface RxItem {
  id: string
  medication: string
  sig: string
  quantity: string
  refills: string
  pharmacy: string
  notes: string
  dbId?: string
}

interface DrugInteraction {
  id: string
  drug1: string
  drug2: string
  severity: 'mild' | 'moderate' | 'severe'
  description: string
}

interface FavoriteMedication {
  id: string
  medication: string
  sig: string
  qty: string
  refills: string
  notes: string
  useCount: number
}

export function usePrescriptions(appointmentId: string | null, medicationHistory?: any[]) {
  const [rxData, setRxData] = useState({
    medication: '',
    sig: '',
    quantity: '',
    refills: '0',
    pharmacy: '',
    notes: ''
  })
  const [rxHistory, setRxHistory] = useState<any[]>([])
  const [rxList, setRxList] = useState<RxItem[]>([])
  const [editingRxId, setEditingRxId] = useState<string | null>(null)
  const [editingRxData, setEditingRxData] = useState<RxItem | null>(null)
  const [showRxHistory, setShowRxHistory] = useState(false)
  const [sendingRx, setSendingRx] = useState(false)
  const [addingRx, setAddingRx] = useState(false)
  const [recipientAddress, setRecipientAddress] = useState('')
  
  // Drug interactions
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([])
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false)
  
  // Favorite medications
  const [favoriteMedications, setFavoriteMedications] = useState<FavoriteMedication[]>([])
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false)

  const fetchPrescriptionHistory = useCallback(async () => {
    if (!appointmentId) return

    try {
      // OPTIMIZED: Using Next.js API route (server-side fetch) to bypass browser fetch delays
      const response = await fetch(`/api/prescriptions-fast?appointment_id=${appointmentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch prescriptions')
      }
      
      const resultData = await response.json()
      setRxHistory(resultData.data || [])
      
      // Load pending prescriptions into rxList so they appear in eRx Composer
      const pendingPrescriptions = (resultData.data || []).filter(
        (p: any) => p.status === 'pending' || p.status === 'draft'
      )
      
      if (pendingPrescriptions.length > 0) {
        const rxItems: RxItem[] = pendingPrescriptions.map((p: any) => ({
          id: `rx-db-${p.id}`,
          medication: p.medication || '',
          sig: p.sig || '',
          quantity: p.quantity?.toString() || '',
          refills: p.refills?.toString() || '0',
          pharmacy: p.pharmacy_name || '',
          notes: p.notes || '',
          dbId: p.id
        }))
        
        setRxList(rxItems)
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        // Only log if error has meaningful information
        if (err && (err.message || err.code || err.details || err.hint || Object.keys(err).length > 0)) {
          console.error('Error fetching prescription history:', {
            message: err?.message || 'Unknown error',
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
            fullError: err
          })
        } else {
          // Silently handle empty errors or network failures
          console.debug('Prescription history fetch failed (likely network or table not found)')
        }
      }
      // Set empty history on error
      setRxHistory([])
    }
  }, [appointmentId])

  // Optimized input handler with debouncing
  const handleRxDataChange = useCallback((field: string, value: string) => {
    setRxData(prev => ({ ...prev, [field]: value }))
  }, [])

  // NEW API: Receive values directly from component's local state
  const handleAddToRxList = useCallback(async () => {
    if (!rxData.medication.trim()) return

    setAddingRx(true)
    try {
      const newRx: RxItem = {
        id: `rx-${Date.now()}`,
        medication: rxData.medication,
        sig: rxData.sig,
        quantity: rxData.quantity || '30',
        refills: rxData.refills || '0',
        pharmacy: recipientAddress,
        notes: rxData.notes
      }

      setRxList(prev => [...prev, newRx])
      setRxData({
        medication: '',
        sig: '',
        quantity: '',
        refills: '0',
        pharmacy: '',
        notes: ''
      })
    } finally {
      setAddingRx(false)
    }
  }, [rxData, recipientAddress])

  const handleRemoveFromRxList = useCallback((id: string, dbId?: string) => {
    setRxList(prev => prev.filter(rx => rx.id !== id))

    // Delete from database if it exists (fire and forget)
    if (dbId) {
      void (async () => {
        try {
          await supabase
            .from('prescriptions')
            .delete()
            .eq('id', dbId)
        } catch (err: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error removing prescription:', err)
          }
        }
      })()
    }
  }, [])

  const handleClearRxList = useCallback(() => {
    setRxList([])
  }, [])

  const handleStartEditRx = useCallback((rxId: string) => {
    const rx = rxList.find(r => r.id === rxId)
    if (rx) {
      setEditingRxId(rxId)
      setEditingRxData({ ...rx })
    }
  }, [rxList])

  const handleCancelEditRx = useCallback(() => {
    setEditingRxId(null)
    setEditingRxData(null)
  }, [])

  // NEW API: Receive data directly
  const handleSaveEditRx = useCallback(async (rxId: string) => {
    if (!editingRxData) return

    // Update local state immediately
    setRxList(prev => prev.map(rx => 
      rx.id === rxId ? { ...editingRxData } : rx
    ))
    setEditingRxId(null)
    setEditingRxData(null)

    // If this prescription exists in the database, update it there too
    if (editingRxData.dbId) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        const response = await fetch('/api/prescriptions', {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
          body: JSON.stringify({
            prescriptionId: editingRxData.dbId,
            medication: editingRxData.medication,
            sig: editingRxData.sig,
            quantity: editingRxData.quantity,
            refills: parseInt(editingRxData.refills) || 0,
            notes: editingRxData.notes || null
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Error updating prescription in database:', errorData)
        }
      } catch (err) {
        console.error('Error updating prescription:', err)
      }
    }
  }, [])

  // NEW API: Receive recipientAddress directly
  const handleSendERx = useCallback(async (
    appointment?: any,
    setError?: (error: string | null) => void
  ) => {
    if (!appointment?.id) {
      setError?.('Appointment information not available')
      return
    }

    if (!recipientAddress || !recipientAddress.trim()) {
      setError?.('Please enter a recipient Direct messaging address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientAddress.trim())) {
      setError?.('Invalid Direct address format. Must be in format: user@domain.com')
      return
    }

    if (rxList.length === 0) {
      setError?.('Please add medications to the list first')
      return
    }

    setSendingRx(true)
    setError?.(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const prescriptionIds: string[] = []
      
      for (const rx of rxList) {
        if (rx.dbId) {
          prescriptionIds.push(rx.dbId)
        } else {
          if (!appointment?.user_id) {
            throw new Error('Patient ID not found in appointment')
          }

          const createResponse = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            },
            credentials: 'include',
            body: JSON.stringify({
              appointmentId: appointment?.id,
              patientId: appointment?.patient_id || appointment?.user_id,
              medication: rx.medication,
              sig: rx.sig,
              quantity: rx.quantity,
              refills: parseInt(rx.refills) || 0,
              notes: rx.notes || null,
              pharmacyName: appointment?.preferred_pharmacy || null,
              status: 'pending'
            })
          })

          if (!createResponse.ok) {
            const errorData = await createResponse.json()
            throw new Error(errorData.error || 'Failed to create prescription')
          }

          const createData = await createResponse.json()
          prescriptionIds.push(createData.prescription.id)
        }
      }

      const sendPromises = prescriptionIds.map(async (prescriptionId) => {
        const response = await fetch('/api/prescriptions/erx-compose', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
          body: JSON.stringify({
            prescriptionId: prescriptionId,
            recipientAddress: recipientAddress.trim()
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to send prescription via EMRDirect')
        }

        return response.json()
      })

      const results = await Promise.all(sendPromises)
      const failed = results.filter(r => !r.success)

      if (failed.length > 0) {
        const errorMessages = failed.map(r => r.error || 'Unknown error').join('; ')
        throw new Error(`${failed.length} prescription(s) failed to send: ${errorMessages}`)
      }

      setRxData({
        medication: '',
        sig: '',
        quantity: '',
        refills: '0',
        pharmacy: '',
        notes: ''
      })
      setRxList([])
      await fetchPrescriptionHistory()
    } catch (error: any) {
      console.error('Error sending eRx:', error)
      setError?.(error.message || 'Failed to send prescription')
    } finally {
      setSendingRx(false)
    }
  }, [rxList, recipientAddress, fetchPrescriptionHistory])

  // Load favorite medications from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('doctor-favorite-medications')
      if (savedFavorites) {
        setFavoriteMedications(JSON.parse(savedFavorites))
      } else {
        // Default favorites
        setFavoriteMedications([
          { id: '1', medication: 'Amoxicillin 500mg', sig: 'BID × 7 days', qty: '14', refills: '0', notes: '', useCount: 0 },
          { id: '2', medication: 'Ibuprofen 600mg', sig: 'TID PRN pain', qty: '30', refills: '1', notes: 'Take with food', useCount: 0 }
        ])
      }
    } catch (e) {
      console.error('Error loading favorite medications:', e)
    }
  }, [])

  // Select favorite medication - just update favorites list, component handles local state
  const handleSelectFavoriteMedication = useCallback((favorite: FavoriteMedication) => {
    const updated = favoriteMedications.map(f => 
      f.id === favorite.id ? { ...f, useCount: (f.useCount || 0) + 1 } : f
    )
    setFavoriteMedications(updated)
    localStorage.setItem('doctor-favorite-medications', JSON.stringify(updated))
    setShowFavoritesDropdown(false)
  }, [favoriteMedications])

  // Add to favorites - receive data directly
  const handleAddToFavorites = useCallback((rxData: { medication: string; sig: string; quantity: string; refills: string }) => {
    if (!rxData.medication) return
    
    const newFavorite: FavoriteMedication = {
      id: Date.now().toString(),
      medication: rxData.medication,
      sig: rxData.sig,
      qty: rxData.quantity,
      refills: rxData.refills,
      notes: '',
      useCount: 1
    }
    
    const updated = [newFavorite, ...favoriteMedications]
    setFavoriteMedications(updated)
    localStorage.setItem('doctor-favorite-medications', JSON.stringify(updated))
  }, [favoriteMedications])

  // Check for drug interactions
  const checkDrugInteractions = useCallback(async () => {
    setIsCheckingInteractions(true)
    
    // Get all current medications
    const currentMeds = [
      ...rxList.map(rx => rx.medication.toLowerCase()),
      ...(medicationHistory?.map(m => m.medication.toLowerCase()) || [])
    ].filter(Boolean)
    
    if (currentMeds.length < 2) {
      setDrugInteractions([])
      setIsCheckingInteractions(false)
      return
    }
    
    // Simulated interaction check (in production, call a drug interaction API)
    const mockInteractions: DrugInteraction[] = []
    
    // Common interaction patterns
    const interactionRules = [
      { drugs: ['metronidazole', 'alcohol'], severity: 'severe' as const, desc: 'Disulfiram-like reaction - avoid alcohol during and 48h after treatment' },
      { drugs: ['doxycycline', 'antacid'], severity: 'moderate' as const, desc: 'Antacids reduce doxycycline absorption - take 2h apart' },
      { drugs: ['ciprofloxacin', 'nsaid'], severity: 'moderate' as const, desc: 'Increased risk of CNS stimulation and seizures' },
      { drugs: ['trimethoprim', 'methotrexate'], severity: 'severe' as const, desc: 'Increased risk of bone marrow suppression' },
      { drugs: ['fluconazole', 'warfarin'], severity: 'severe' as const, desc: 'Increased anticoagulant effect - monitor INR closely' },
    ]
    
    currentMeds.forEach((drug1, i) => {
      currentMeds.slice(i + 1).forEach(drug2 => {
        for (const rule of interactionRules) {
          if ((rule.drugs.includes(drug1) && rule.drugs.some(d => drug2.includes(d))) ||
              (rule.drugs.includes(drug2) && rule.drugs.some(d => drug1.includes(d)))) {
            mockInteractions.push({
              id: `${drug1}-${drug2}`,
              drug1,
              drug2,
              severity: rule.severity,
              description: rule.desc
            })
          }
        }
      })
    })
    
    setDrugInteractions(mockInteractions)
    setIsCheckingInteractions(false)
  }, [rxList, rxData, medicationHistory])

  useEffect(() => {
    if (appointmentId) {
      fetchPrescriptionHistory()
    } else {
      setRxList([])
      setRxHistory([])
    }
  }, [appointmentId, fetchPrescriptionHistory])

  return {
    rxData,
    rxHistory,
    rxList,
    editingRxId,
    editingRxData,
    showRxHistory,
    sendingRx,
    addingRx,
    recipientAddress,
    drugInteractions,
    isCheckingInteractions,
    favoriteMedications,
    showFavoritesDropdown,
    setRxData,
    setRxList,
    setEditingRxId,
    setEditingRxData,
    setShowRxHistory,
    setSendingRx,
    setRecipientAddress,
    setShowFavoritesDropdown,
    handleRxDataChange,
    handleAddToRxList,
    handleRemoveFromRxList,
    handleClearRxList,
    handleStartEditRx,
    handleCancelEditRx,
    handleSaveEditRx,
    handleSendERx,
    fetchPrescriptionHistory,
    checkDrugInteractions,
    handleSelectFavoriteMedication,
    handleAddToFavorites
  }
}

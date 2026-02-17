// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import './availability.css'

interface WeeklyHoursSlot {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

interface AvailabilityEvent {
  id?: string
  doctor_id: string
  date: string
  start_time: string
  end_time: string
  title: string
  type: 'available' | 'blocked' | 'personal' | 'google' | 'holiday'
  description?: string
  created_at?: string
  updated_at?: string
}

type ViewType = 'month' | 'week' | 'day' | 'year'

export default function DoctorAvailability() {
  const [doctorId, setDoctorId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // View state
  const [currentView, setCurrentView] = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showDrawer, setShowDrawer] = useState(false)
  const [patientViewMode, setPatientViewMode] = useState(false)
  
  // Availability data
  const [weeklyHours, setWeeklyHours] = useState<{ [key: number]: WeeklyHoursSlot[] }>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  })
  const [availabilityEvents, setAvailabilityEvents] = useState<AvailabilityEvent[]>([])
  
  // Drawer form state
  const [drawerType, setDrawerType] = useState<'available' | 'blocked' | 'personal'>('available')
  const [drawerRepeat, setDrawerRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  const [drawerStartDate, setDrawerStartDate] = useState('')
  const [drawerEndDate, setDrawerEndDate] = useState('')
  const [drawerNote, setDrawerNote] = useState('')
  const [createMode, setCreateMode] = useState<'available' | 'blocked'>('available')
  const [editingEvent, setEditingEvent] = useState<AvailabilityEvent | null>(null) // Track which event is being edited
  
  // Drag selection state (for week view)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; col: number; row: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number; col: number; row: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const weekGridRef = useRef<HTMLDivElement>(null)
  
  // Conflict detection state
  const [conflicts, setConflicts] = useState<string[]>([])

  // Fetch doctor ID
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: doctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('email', user.email)
          .single()

        if (doctor) {
          setDoctorId(doctor.id)
        }
      } catch (error) {
        console.error('Error fetching doctor:', error)
      }
    }
    fetchDoctor()
  }, [])

  // Fetch weekly hours
  const fetchWeeklyHours = useCallback(async () => {
    if (!doctorId) return

    try {
      const { data, error } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_available', true)
        .order('day_of_week, start_time')

      if (error) {
        console.log('Weekly hours error:', error)
        return
      }

      const grouped: { [key: number]: WeeklyHoursSlot[] } = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
      }

      data?.forEach((hour: any) => {
        grouped[hour.day_of_week].push({
          id: hour.id,
          day_of_week: hour.day_of_week,
          start_time: hour.start_time,
          end_time: hour.end_time,
          is_available: hour.is_available
        })
      })

      setWeeklyHours(grouped)
    } catch (error) {
      console.error('Error fetching weekly hours:', error)
    }
  }, [doctorId])

  // Fetch all availability events (all types)
  const fetchAvailabilityEvents = useCallback(async () => {
    if (!doctorId) return

    try {
      const { data, error } = await supabase
        .from('doctor_availability_events')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('date', { ascending: true })

      if (error) {
        console.log('Availability events error:', error)
        return
      }

      setAvailabilityEvents(data || [])
    } catch (error) {
      console.error('Error fetching availability events:', error)
    }
  }, [doctorId])

  // Load data when doctor ID is available
  useEffect(() => {
    if (doctorId) {
      Promise.all([fetchWeeklyHours(), fetchAvailabilityEvents()]).finally(() => {
        setLoading(false)
      })
    }
  }, [doctorId, fetchWeeklyHours, fetchAvailabilityEvents])

  // Refresh events when month changes (to ensure we have data for the new month)
  useEffect(() => {
    if (doctorId && !loading) {
      fetchAvailabilityEvents()
    }
  }, [currentDate, doctorId, fetchAvailabilityEvents])

  // Real-time subscription for availability events
  useEffect(() => {
    if (!doctorId) return

    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'doctor_availability_events',
          filter: `doctor_id=eq.${doctorId}`
        },
        (payload) => {
          console.log('Real-time update:', payload)
          // Refresh events when changes occur
          fetchAvailabilityEvents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [doctorId, fetchAvailabilityEvents])

  // Open drawer for creating new event
  const openDrawer = (type: 'available' | 'blocked' | 'personal', selectedDay?: number) => {
    // Reset editing state
    setEditingEvent(null)
    
    // Reset all form fields
    setDrawerType(type)
    setDrawerRepeat('none')
    setDrawerNote('')
    
    // Set date/time based on selected day or current date
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = selectedDay || new Date().getDate()
    
    // Default to 9:00 AM - 9:30 AM for the selected day
    const startDate = new Date(year, month, day, 9, 0)
    const endDate = new Date(year, month, day, 9, 30)
    
    // Format as datetime-local string (YYYY-MM-DDTHH:mm)
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    
    setDrawerStartDate(startStr)
    setDrawerEndDate(endStr)
    setShowDrawer(true)
  }

  // Open drawer for editing existing event
  const openDrawerForEdit = (event: AvailabilityEvent) => {
    setEditingEvent(event)
    setDrawerType(event.type === 'personal' ? 'personal' : event.type === 'blocked' ? 'blocked' : 'available')
    setDrawerRepeat('none') // Don't allow editing repeat for existing events
    setDrawerNote(event.description || '')
    
    // Parse event date and time
    const [year, month, day] = event.date.split('-').map(Number)
    const [startHour, startMin] = event.start_time.split(':').map(Number)
    const [endHour, endMin] = event.end_time.split(':').map(Number)
    
    // Format as datetime-local string
    const startStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
    
    setDrawerStartDate(startStr)
    setDrawerEndDate(endStr)
    setShowDrawer(true)
  }

  // Save availability/block (create or update)
  const saveAvailability = async () => {
    if (!doctorId || !drawerStartDate || !drawerEndDate) return

    setSaving(true)
    try {
      // Parse datetime-local input (format: "YYYY-MM-DDTHH:mm")
      // Convert to local date components to avoid timezone issues
      const startDateStr = drawerStartDate.includes('T') ? drawerStartDate : drawerStartDate.replace(' ', 'T')
      const endDateStr = drawerEndDate.includes('T') ? drawerEndDate : drawerEndDate.replace(' ', 'T')
      
      const start = new Date(startDateStr)
      const end = new Date(endDateStr)
      
      // Extract date components in local timezone (not UTC)
      const year = start.getFullYear()
      const month = String(start.getMonth() + 1).padStart(2, '0')
      const day = String(start.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      // Extract time components in local timezone
      const startHours = String(start.getHours()).padStart(2, '0')
      const startMinutes = String(start.getMinutes()).padStart(2, '0')
      const startTime = `${startHours}:${startMinutes}`
      
      const endHours = String(end.getHours()).padStart(2, '0')
      const endMinutes = String(end.getMinutes()).padStart(2, '0')
      const endTime = `${endHours}:${endMinutes}`

      const eventData: Omit<AvailabilityEvent, 'id' | 'created_at' | 'updated_at'> = {
        doctor_id: doctorId,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        title: drawerType === 'available' ? 'Available' : drawerType === 'blocked' ? 'Blocked' : drawerNote || 'Personal',
        type: drawerType === 'personal' ? 'personal' : drawerType === 'blocked' ? 'blocked' : 'available',
        description: drawerNote
      }

      // If editing existing event, update it
      if (editingEvent && editingEvent.id) {
        const { error } = await supabase
          .from('doctor_availability_events')
          .update(eventData)
          .eq('id', editingEvent.id)

        if (error) {
          console.error('Update error:', error)
          throw error
        }
        
        await fetchAvailabilityEvents()
        setShowDrawer(false)
        setEditingEvent(null)
        alert('Event updated successfully!')
        return
      }

      // Handle repeat logic for new events
      if (drawerRepeat === 'none') {
        // Single event - no repeat
        const { error } = await supabase
          .from('doctor_availability_events')
          .insert([eventData])

        if (error) {
          console.error('Insert error:', error)
          throw error
        }
      } else {
        // Repeat logic - create multiple events
        const events = []
        const repeatEndDate = new Date(currentDate)
        repeatEndDate.setMonth(repeatEndDate.getMonth() + 1) // Repeat for 1 month
        
        // Start from the selected date
        let repeatDate = new Date(start)
        const increment = drawerRepeat === 'daily' ? 1 : drawerRepeat === 'weekly' ? 7 : 30

        while (repeatDate <= repeatEndDate) {
          const year = repeatDate.getFullYear()
          const month = String(repeatDate.getMonth() + 1).padStart(2, '0')
          const day = String(repeatDate.getDate()).padStart(2, '0')
          const repeatDateStr = `${year}-${month}-${day}`
          
          events.push({
            ...eventData,
            date: repeatDateStr
          })
          
          // Move to next date
          repeatDate = new Date(repeatDate)
          repeatDate.setDate(repeatDate.getDate() + increment)
        }

        if (events.length > 0) {
          const { error } = await supabase
            .from('doctor_availability_events')
            .insert(events)

          if (error) {
            console.error('Insert error:', error)
            throw error
          }
        }
      }

      await fetchAvailabilityEvents()
      setShowDrawer(false)
      setEditingEvent(null)
      alert('Saved successfully!')
    } catch (error: any) {
      console.error('Error saving availability:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Delete availability event
  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase
        .from('doctor_availability_events')
        .delete()
        .eq('id', eventId)

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      await fetchAvailabilityEvents()
      alert('Event deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting event:', error)
      alert(`Error: ${error.message}`)
    }
  }

  // Navigate to previous/next month or week
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (currentView === 'week') {
        // Navigate by week
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7))
      } else {
        // Navigate by month
        newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1))
      }
      return newDate
    })
  }

  // Get week dates (Monday to Sunday)
  const getWeekDates = () => {
    const date = new Date(currentDate)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(date)
      d.setDate(diff + i)
      dates.push(d)
    }
    return dates
  }

  // Generate time slots (30-minute intervals from 5 AM to 11 PM)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 5; hour <= 23; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      if (hour < 23) {
        slots.push(`${String(hour).padStart(2, '0')}:30`)
      }
    }
    return slots
  }

  // Get events for a specific date and time range
  const getEventsForTimeSlot = (date: Date, timeSlot: string) => {
    const dateStr = date.toISOString().split('T')[0]
    const [hour, minute] = timeSlot.split(':').map(Number)
    const slotStart = hour * 60 + minute
    const slotEnd = slotStart + 30

    return availabilityEvents.filter(event => {
      if (event.date !== dateStr) return false
      
      const [eventStartHour, eventStartMin] = event.start_time.split(':').map(Number)
      const [eventEndHour, eventEndMin] = event.end_time.split(':').map(Number)
      const eventStart = eventStartHour * 60 + eventStartMin
      const eventEnd = eventEndHour * 60 + eventEndMin

      // Check if event overlaps with time slot
      return (eventStart < slotEnd && eventEnd > slotStart)
    })
  }

  // Check if time slot is within weekly hours
  const isWithinWeeklyHours = (date: Date, timeSlot: string) => {
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayHours = weeklyHours[dayOfWeek] || []
    
    if (dayHours.length === 0) return false

    const [hour, minute] = timeSlot.split(':').map(Number)
    const slotMinutes = hour * 60 + minute

    return dayHours.some(slot => {
      const [startHour, startMin] = slot.start_time.split(':').map(Number)
      const [endHour, endMin] = slot.end_time.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes
    })
  }

  // Check for conflicts
  const checkConflicts = useCallback((dateStr: string, startTime: string, endTime: string, excludeEventId?: string) => {
    const conflicts: string[] = []
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    availabilityEvents.forEach(event => {
      if (event.date !== dateStr) return
      if (excludeEventId && event.id === excludeEventId) return

      const [eventStartHour, eventStartMin] = event.start_time.split(':').map(Number)
      const [eventEndHour, eventEndMin] = event.end_time.split(':').map(Number)
      const eventStartMinutes = eventStartHour * 60 + eventStartMin
      const eventEndMinutes = eventEndHour * 60 + eventEndMin

      // Check for overlap
      if (startMinutes < eventEndMinutes && endMinutes > eventStartMinutes) {
        conflicts.push(`${event.title} (${event.start_time} - ${event.end_time})`)
      }
    })

    return conflicts
  }, [availabilityEvents])

  // Update conflict detection when drawer data changes
  useEffect(() => {
    if (!drawerStartDate || !drawerEndDate) {
      setConflicts([])
      return
    }

    try {
      const startDateStr = drawerStartDate.includes('T') ? drawerStartDate : drawerStartDate.replace(' ', 'T')
      const start = new Date(startDateStr)
      const year = start.getFullYear()
      const month = String(start.getMonth() + 1).padStart(2, '0')
      const day = String(start.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const startHours = String(start.getHours()).padStart(2, '0')
      const startMinutes = String(start.getMinutes()).padStart(2, '0')
      const startTime = `${startHours}:${startMinutes}`

      const endDateStr = drawerEndDate.includes('T') ? drawerEndDate : drawerEndDate.replace(' ', 'T')
      const end = new Date(endDateStr)
      const endHours = String(end.getHours()).padStart(2, '0')
      const endMinutes = String(end.getMinutes()).padStart(2, '0')
      const endTime = `${endHours}:${endMinutes}`

      const detectedConflicts = checkConflicts(dateStr, startTime, endTime, editingEvent?.id)
      setConflicts(detectedConflicts)
    } catch (error) {
      setConflicts([])
    }
  }, [drawerStartDate, drawerEndDate, checkConflicts, editingEvent])

  // Handle drag start in week view
  const handleWeekDragStart = (e: React.MouseEvent, col: number, row: number) => {
    if (col === 0) return // Don't drag on time column
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY, col, row })
    setDragEnd(null)
  }

  // Handle drag move in week view
  const handleWeekDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !weekGridRef.current) return

    const gridRect = weekGridRef.current.getBoundingClientRect()
    const relativeX = e.clientX - gridRect.left
    const relativeY = e.clientY - gridRect.top

    // Calculate which cell we're over
    const cellWidth = (gridRect.width - 80) / 7 // 80px for time column
    const cellHeight = 90 // Approximate cell height
    const col = Math.floor((relativeX - 80) / cellWidth) + 1
    const row = Math.floor(relativeY / cellHeight)

    if (col >= 1 && col <= 7 && row >= 0) {
      setDragEnd({ x: e.clientX, y: e.clientY, col, row })
    }
  }

  // Handle drag end in week view
  const handleWeekDragEnd = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }

    const weekDates = getWeekDates()
    const timeSlots = generateTimeSlots()
    
    const startCol = Math.min(dragStart.col, dragEnd.col)
    const endCol = Math.max(dragStart.col, dragEnd.col)
    const startRow = Math.min(dragStart.row, dragEnd.row)
    const endRow = Math.max(dragStart.row, dragEnd.row)

    // For now, create event for the first selected cell
    if (startCol >= 1 && startCol <= 7 && startRow < timeSlots.length) {
      const selectedDate = weekDates[startCol - 1]
      const selectedTime = timeSlots[startRow]
      
      openDrawer(createMode, selectedDate.getDate())
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Generate week view
  const generateWeekView = () => {
    const weekDates = getWeekDates()
    const timeSlots = generateTimeSlots()
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    if (loading) {
      return (
        <div className="availability-card">
          <div style={{ padding: '40px', textAlign: 'center', color: '#9fb4cc' }}>
            Loading week view...
          </div>
        </div>
      )
    }

    return (
      <div className="availability-card">
        {/* Weekly hours legend */}
        <div className="availability-legend" style={{ marginBottom: '8px' }}>
          <span className="availability-chip"><strong>Weekly Working Hours</strong></span>
          {[0, 1, 2, 3, 4, 5, 6].map(day => {
            const hours = weeklyHours[day] || []
            if (hours.length === 0) {
              return <span key={day} className="availability-chip">{dayNames[day]} —</span>
            }
            return hours.map((slot, idx) => (
              <span key={`${day}-${idx}`} className="availability-chip">
                {dayNames[day]} {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
              </span>
            ))
          })}
        </div>

        <div 
          className="availability-cal" 
          ref={weekGridRef}
          onMouseMove={handleWeekDragMove}
          onMouseUp={handleWeekDragEnd}
          onMouseLeave={handleWeekDragEnd}
        >
          {/* Header row - must be a single row with all cells */}
          <div className="availability-cal-row" style={{ borderBottom: '2px solid var(--line)', position: 'sticky', top: 0, zIndex: 10 }}>
            <div className="availability-dayhead" style={{ background: '#081226' }}>Time</div>
            {weekDates.map((date, idx) => (
              <div key={`header-${idx}`} className="availability-dayhead">
                {dayNames[date.getDay()]} {date.getDate()}
              </div>
            ))}
          </div>

          {/* Time slots */}
          {timeSlots.map((timeSlot, rowIdx) => {
            return (
              <div key={`row-${timeSlot}-${rowIdx}`} className="availability-cal-row">
                <div className="availability-time">{timeSlot}</div>
                {weekDates.map((date, colIdx) => {
                  const dayEvents = getEventsForTimeSlot(date, timeSlot)
                  const hasWeeklyHours = isWithinWeeklyHours(date, timeSlot)

                  return (
                    <div
                      key={`cell-${colIdx}-${rowIdx}`}
                      className="availability-cell"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleWeekDragStart(e, colIdx + 1, rowIdx)
                      }}
                      onClick={(e) => {
                        if (!isDragging) {
                          // Open drawer for this time slot
                          const [hour, minute] = timeSlot.split(':').map(Number)
                          const year = date.getFullYear()
                          const month = date.getMonth()
                          const day = date.getDate()
                          openDrawer(createMode, day)
                        }
                      }}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      {/* Weekly hours shading */}
                      {hasWeeklyHours && (
                        <div className="availability-workshade" style={{ top: 0, bottom: 0 }} />
                      )}

                      {/* Events */}
                      {dayEvents.map((event, eventIdx) => {
                        const [eventStartHour, eventStartMin] = event.start_time.split(':').map(Number)
                        const [slotHour, slotMin] = timeSlot.split(':').map(Number)
                        const eventStartMinutes = eventStartHour * 60 + eventStartMin
                        const slotStartMinutes = slotHour * 60 + slotMin

                        // Calculate position and height
                        const offset = eventStartMinutes - slotStartMinutes
                        const top = offset > 0 ? `${(offset / 30) * 100}%` : '0px'
                        const duration = (parseInt(event.end_time.split(':')[0]) * 60 + parseInt(event.end_time.split(':')[1])) - eventStartMinutes
                        const height = `${Math.max((duration / 30) * 100, 50)}%`

                        return (
                          <div
                            key={event.id || `event-${eventIdx}`}
                            className={`availability-event ${event.type}`}
                            style={{ top, height, minHeight: '36px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openDrawerForEdit(event)
                            }}
                          >
                            {event.title}
                            <small>{event.start_time}–{event.end_time}</small>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="availability-hint" style={{ marginTop: '8px' }}>
          Tip: drag to select a range; click a block to edit it.
        </div>
      </div>
    )
  }

  // Generate month cells
  const generateMonthCells = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()
    
    // Calculate total cells needed: just the days in the month, rounded up to nearest multiple of 7
    const totalCells = Math.ceil(totalDays / 7) * 7

    const cells = []
    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i + 1
      
      // Only show if it's within the current month (1 to totalDays)
      if (dayNumber <= totalDays) {
        // Create date string in YYYY-MM-DD format for current month
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
        const dayEvents = availabilityEvents.filter(e => {
          // Ensure exact date match
          return e.date === dateStr
        })

        // Check if this day has default availability (recurring hours or default 9am-10pm)
        const dayOfWeek = new Date(year, month, dayNumber).getDay()
        const hasRecurringHours = weeklyHours[dayOfWeek] && weeklyHours[dayOfWeek].length > 0
        const hasAvailableEvent = dayEvents.some(e => e.type === 'available')
        const hasBlockedAll = dayEvents.some(e => e.type === 'blocked' || e.type === 'holiday')
        const isAvailableDay = (hasAvailableEvent || hasRecurringHours || dayEvents.length === 0) && !hasBlockedAll
        const isPastDay = new Date(year, month, dayNumber) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
        
        cells.push(
          <div
            key={i}
            className="availability-mcell"
            data-day={dayNumber}
            onClick={() => openDrawer(createMode, dayNumber)}
            style={{ 
              cursor: 'pointer',
              background: isAvailableDay && !isPastDay ? 'rgba(0, 203, 169, 0.12)' : undefined,
              borderColor: isAvailableDay && !isPastDay ? 'rgba(0, 203, 169, 0.3)' : undefined,
            }}
          >
            <div className="availability-d" style={{ color: isAvailableDay && !isPastDay ? '#00CBA9' : undefined, fontWeight: isAvailableDay && !isPastDay ? 700 : undefined }}>{dayNumber}</div>
            {isAvailableDay && !isPastDay && dayEvents.length === 0 && (
              <span className="availability-tag a" style={{ fontSize: '9px', opacity: 0.7 }}>I&apos;m Available</span>
            )}
            {dayEvents.map((event, idx) => (
              <span
                key={event.id || idx}
                className={`availability-tag ${
                  event.type === 'available' ? 'a' :
                  event.type === 'blocked' ? 'b' :
                  event.type === 'personal' ? 'p' :
                  event.type === 'google' ? 'g' :
                  event.type === 'holiday' ? 'h' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation() // Prevent cell click
                  openDrawerForEdit(event)
                }}
                style={{ cursor: 'pointer' }}
                title={`${event.title} (${event.start_time} - ${event.end_time}) - Click to edit`}
              >
                {event.title}
              </span>
            ))}
          </div>
        )
      } else {
        // Empty cell after last day of month
        cells.push(
          <div
            key={i}
            className="availability-mcell"
            style={{ cursor: 'default' }}
          >
            {/* Empty cell */}
          </div>
        )
      }
    }
    return cells
  }

  // Get current range text
  const getCurrentRangeText = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    if (currentView === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else if (currentView === 'week') {
      const weekDates = getWeekDates()
      const startDate = weekDates[0]
      const endDate = weekDates[6]
      if (startDate.getMonth() === endDate.getMonth()) {
        return `Week of ${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}`
      } else {
        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}`
      }
    } else if (currentView === 'day') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()} — Day View`
    } else {
      return `${currentDate.getFullYear()} — Year View`
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div className={`availability-page ${patientViewMode ? 'patient-view' : ''}`}>
      <header className="availability-header">
        <div className="availability-top">
          <div className="availability-logo">
            <div className="availability-orb"></div>
            Provider Availability Calendar
            </div>
          <span className="availability-pill">Set hours • Block time • Notes • Holidays • Google sync</span>
          <span style={{ flex: 1 }}></span>
          <a href="/doctor/dashboard" className="availability-pill">Back to Dashboard</a>
                    </div>
      </header>

      <div className="availability-container">
        {/* Toolbar */}
        <div className="availability-toolbar availability-card">
          <button
            className={currentView === 'month' ? 'availability-btn' : 'availability-btn ghost'}
            onClick={() => setCurrentView('month')}
          >
            Month
          </button>
                        <button
            className={currentView === 'week' ? 'availability-btn' : 'availability-btn ghost'}
            onClick={() => setCurrentView('week')}
                        >
            Week
                        </button>
                            <button
            className={currentView === 'day' ? 'availability-btn' : 'availability-btn ghost'}
            onClick={() => setCurrentView('day')}
                            >
            Day
                            </button>
                            <button
            className={currentView === 'year' ? 'availability-btn' : 'availability-btn ghost'}
            onClick={() => setCurrentView('year')}
                            >
            Year
                            </button>
          <button
            className="availability-btn ghost"
            onClick={() => navigateMonth('prev')}
            title="Previous month"
          >
            ←
          </button>
          <span className="availability-pill">{getCurrentRangeText()}</span>
          <button
            className="availability-btn ghost"
            onClick={() => navigateMonth('next')}
            title="Next month"
          >
            →
          </button>
          <span style={{ flex: 1 }}></span>
          <select className="availability-input availability-select" style={{ maxWidth: '220px' }} disabled>
            <option>Timezone: America/Phoenix</option>
          </select>
          <button className="availability-btn ghost" onClick={() => window.print()}>Print / PDF</button>
          <button className="availability-btn" onClick={() => openDrawer('available', new Date().getDate())}>Add Availability</button>
          <button className="availability-btn ghost" onClick={() => openDrawer('blocked', new Date().getDate())}>Block Time</button>
          <button className="availability-btn ghost" onClick={() => openDrawer('personal', new Date().getDate())}>Add Reminder</button>
          <button className="availability-btn" onClick={() => alert('Google OAuth flow (demo)')}>Connect Google Calendar</button>
          <select
            className="availability-input availability-select"
            style={{ maxWidth: '220px' }}
            value={createMode}
            onChange={(e) => setCreateMode(e.target.value as 'available' | 'blocked')}
          >
            <option value="available">Create Mode: Availability</option>
            <option value="blocked">Create Mode: Block</option>
          </select>
                              <button
            className="availability-btn ghost"
            onClick={() => setPatientViewMode(!patientViewMode)}
                              >
            {patientViewMode ? 'Exit Patient View' : 'Patient View Preview'}
                              </button>
                          </div>

        {/* Legend */}
        <div className="availability-card">
          <div className="availability-legend">
            <span className="availability-chip"><span className="availability-dot availability-dot-avai"></span> Available</span>
            <span className="availability-chip"><span className="availability-dot availability-dot-block"></span> Blocked / Unavailable</span>
            <span className="availability-chip"><span className="availability-dot availability-dot-pers"></span> Personal / Reminder</span>
            <span className="availability-chip"><span className="availability-dot availability-dot-google"></span> Google Calendar Event</span>
            <span className="availability-chip"><span className="availability-dot availability-dot-holiday"></span> Holiday</span>
            <span className="availability-chip"><strong>Vacation Mode</strong></span>
            <span className="availability-chip">AI Suggestions</span>
            <span className="availability-chip">Conflict Detector</span>
                      </div>
                  </div>

        {/* Month View */}
        {currentView === 'month' && (
          <div className="availability-card">
            <div className="availability-month">
              {generateMonthCells()}
            </div>
            <div className="availability-hint" style={{ marginTop: '8px' }}>
              Tip: Click a day to add availability, block time, or a reminder.
            </div>
          </div>
        )}

        {/* Week View */}
        {currentView === 'week' && generateWeekView()}

        {/* Day View - Placeholder */}
        {currentView === 'day' && (
          <div className="availability-card">
            <div className="availability-hint">Day view (to be implemented)</div>
          </div>
        )}

        {/* Year View - Placeholder */}
        {currentView === 'year' && (
          <div className="availability-card">
            <div className="availability-hint">Year view (to be implemented)</div>
              </div>
        )}
            </div>

      {/* Drawer */}
      {showDrawer && (
        <div className="availability-drawer">
          <h3 style={{ margin: '0 0 10px', color: 'var(--ink)' }}>
            {editingEvent ? 'Edit Event' : 'Availability & Blocks'}
          </h3>
          <div className="availability-row2">
            <select
              className="availability-input availability-select"
              value={drawerType}
              onChange={(e) => setDrawerType(e.target.value as any)}
            >
              <option value="available">Available</option>
              <option value="blocked">Blocked / Unavailable</option>
              <option value="personal">Personal / Reminder</option>
            </select>
            <select
              className="availability-input availability-select"
              value={drawerRepeat}
              onChange={(e) => setDrawerRepeat(e.target.value as any)}
            >
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="availability-row2" style={{ marginTop: '8px' }}>
            <input
              className="availability-input"
              type="datetime-local"
              value={drawerStartDate}
              onChange={(e) => setDrawerStartDate(e.target.value)}
              placeholder="Start: 2025-10-16 09:00"
            />
            <input
              className="availability-input"
              type="datetime-local"
              value={drawerEndDate}
              onChange={(e) => setDrawerEndDate(e.target.value)}
              placeholder="End: 2025-10-16 09:30"
            />
          </div>
          <textarea
            className="availability-input availability-textarea"
            rows={4}
            value={drawerNote}
            onChange={(e) => setDrawerNote(e.target.value)}
            placeholder="Notes (optional): e.g., lunch, admin work, training"
            style={{ marginTop: '8px' }}
          />
          <div className="availability-row3" style={{ marginTop: '8px' }}>
            <button className="availability-btn" onClick={saveAvailability} disabled={saving}>
              {saving ? 'Saving...' : editingEvent ? 'Update' : 'Save'}
            </button>
            <button className="availability-btn ghost" onClick={() => {
              setShowDrawer(false)
              setEditingEvent(null)
            }}>Close</button>
            {editingEvent && editingEvent.id && (
              <button 
                className="availability-btn warn" 
                onClick={() => {
                  if (editingEvent.id) {
                    deleteEvent(editingEvent.id)
                    setShowDrawer(false)
                    setEditingEvent(null)
                  }
                }}
                disabled={saving}
              >
                Delete
              </button>
            )}
            {!editingEvent && (
              <button className="availability-btn warn" onClick={() => alert('Vacation Mode (demo)')}>Vacation Mode</button>
            )}
          </div>
          <div className="availability-sep"></div>
          <div className="availability-section-title">AI Suggestions</div>
          <button className="availability-btn" onClick={() => alert('AI suggestions (demo)')}>Suggest Availability</button>
          <div className="availability-hint">AI can suggest open hours based on your patterns (demo).</div>
          <div className="availability-sep"></div>
          <div className="availability-section-title">Conflict Detector</div>
          {conflicts.length > 0 ? (
            <div>
              <div className="availability-badge" style={{ borderColor: '#f5a524', color: '#ffd07a' }}>
                ⚠️ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected
              </div>
              <div style={{ marginTop: '8px' }}>
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className="availability-hint" style={{ color: '#ffd07a', fontSize: '11px' }}>
                    • {conflict}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="availability-badge">No conflicts detected</div>
          )}
          <div className="availability-sep"></div>
          <div className="availability-section-title">Assistant Collaboration</div>
          <div className="availability-hint">Assistants may propose changes that you can approve here (demo).</div>
          <div className="availability-sep"></div>
          <div className="availability-section-title">Google Calendar</div>
          <div className="availability-hint">Connect your Google account to sync personal events and busy times.</div>
          <button className="availability-btn" style={{ marginTop: '8px' }} onClick={() => alert('Google OAuth (demo)')}>
            Connect Google
          </button>
        </div>
      )}
    </div>
  )
}
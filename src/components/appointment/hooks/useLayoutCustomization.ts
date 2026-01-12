import { useState, useEffect, useCallback, useRef } from 'react'

const defaultLeftPanel = [
  'patient-header',
  'medical-records',
  'erx-composer',
  'problems-medications',
  'email-section'
]

const defaultRightPanel = [
  'doctor-notes',
  'meeting-info',
  'sms-section',
  'call-section',
  'lab-results',
  'referrals-followup',
  'prior-auth',
  'communication-history'
]

export function useLayoutCustomization(isOpen: boolean) {
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [leftPanelSections, setLeftPanelSections] = useState<string[]>([])
  const [rightPanelSections, setRightPanelSections] = useState<string[]>([])
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [dragOverPanel, setDragOverPanel] = useState<'left' | 'right' | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null)

  // Load saved layout from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedLayout = localStorage.getItem('appointment-modal-layout')
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout)
          if (parsed.left && parsed.right) {
            let leftSections = parsed.left || []
            let rightSections = parsed.right || []
            
            // Ensure required sections exist
            if (!leftSections.includes('patient-header') && !rightSections.includes('patient-header')) {
              leftSections = ['patient-header', ...leftSections]
            }
            if (!leftSections.includes('communication-history') && !rightSections.includes('communication-history')) {
              rightSections = [...rightSections, 'communication-history']
            }
            if (!leftSections.includes('problems-medications') && !rightSections.includes('problems-medications')) {
              leftSections = [...leftSections, 'problems-medications']
            }
            // Ensure meeting-info is in right panel after doctor-notes
            if (!leftSections.includes('meeting-info') && !rightSections.includes('meeting-info')) {
              const doctorNotesIndex = rightSections.indexOf('doctor-notes')
              if (doctorNotesIndex !== -1) {
                rightSections.splice(doctorNotesIndex + 1, 0, 'meeting-info')
              } else {
                rightSections = ['doctor-notes', 'meeting-info', ...rightSections]
              }
            }
            // Ensure sms-section is in right panel after meeting-info
            if (!leftSections.includes('sms-section') && !rightSections.includes('sms-section')) {
              const meetingInfoIndex = rightSections.indexOf('meeting-info')
              if (meetingInfoIndex !== -1) {
                rightSections.splice(meetingInfoIndex + 1, 0, 'sms-section')
              } else {
                const doctorNotesIndex = rightSections.indexOf('doctor-notes')
                if (doctorNotesIndex !== -1) {
                  rightSections.splice(doctorNotesIndex + 1, 0, 'sms-section')
                } else {
                  rightSections = ['doctor-notes', 'sms-section', ...rightSections]
                }
              }
            }
            // Ensure call-section is in right panel after sms-section
            if (!leftSections.includes('call-section') && !rightSections.includes('call-section')) {
              const smsIndex = rightSections.indexOf('sms-section')
              if (smsIndex !== -1) {
                rightSections.splice(smsIndex + 1, 0, 'call-section')
              } else {
                rightSections = [...rightSections, 'call-section']
              }
            }
            // Ensure email-section is in left panel after problems-medications
            if (!leftSections.includes('email-section') && !rightSections.includes('email-section')) {
              const problemsIndex = leftSections.indexOf('problems-medications')
              if (problemsIndex !== -1) {
                leftSections.splice(problemsIndex + 1, 0, 'email-section')
              } else {
                leftSections = [...leftSections, 'email-section']
              }
            } else if (rightSections.includes('email-section')) {
              // Move email-section from right to left panel after problems-medications
              rightSections = rightSections.filter((s: string) => s !== 'email-section')
              const problemsIndex = leftSections.indexOf('problems-medications')
              if (problemsIndex !== -1) {
                leftSections.splice(problemsIndex + 1, 0, 'email-section')
              } else {
                leftSections = [...leftSections, 'email-section']
              }
            }
            // Ensure referrals-followup is in right panel
            if (!leftSections.includes('referrals-followup') && !rightSections.includes('referrals-followup')) {
              rightSections = [...rightSections, 'referrals-followup']
            }
            // Ensure lab-results is in right panel
            if (!leftSections.includes('lab-results') && !rightSections.includes('lab-results')) {
              rightSections = [...rightSections, 'lab-results']
            }
            // Ensure prior-auth is in right panel
            if (!leftSections.includes('prior-auth') && !rightSections.includes('prior-auth')) {
              rightSections = [...rightSections, 'prior-auth']
            }
            
            setLeftPanelSections(leftSections)
            setRightPanelSections(rightSections)
          } else {
            setLeftPanelSections(defaultLeftPanel)
            setRightPanelSections(defaultRightPanel)
          }
        } catch (e) {
          setLeftPanelSections(defaultLeftPanel)
          setRightPanelSections(defaultRightPanel)
        }
      } else {
        setLeftPanelSections(defaultLeftPanel)
        setRightPanelSections(defaultRightPanel)
      }
    }
  }, [isOpen])

  // Save layout to localStorage
  const saveLayout = useCallback(() => {
    localStorage.setItem('appointment-modal-layout', JSON.stringify({
      left: leftPanelSections,
      right: rightPanelSections
    }))
  }, [leftPanelSections, rightPanelSections])

  // Auto-scroll function for drag and drop
  const handleAutoScroll = useCallback((e?: React.DragEvent) => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    
    let mouseY: number
    if (e) {
      mouseY = e.clientY
      mousePositionRef.current = { x: e.clientX, y: e.clientY }
    } else if (mousePositionRef.current) {
      mouseY = mousePositionRef.current.y
    } else {
      return
    }

    const scrollThreshold = 100
    const scrollSpeed = 10

    const distanceFromTop = mouseY - containerRect.top
    if (distanceFromTop < scrollThreshold && container.scrollTop > 0) {
      container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed)
    }

    const distanceFromBottom = containerRect.bottom - mouseY
    if (distanceFromBottom < scrollThreshold && 
        container.scrollTop < container.scrollHeight - container.clientHeight) {
      container.scrollTop = Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + scrollSpeed
      )
    }
  }, [])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    if (!isCustomizeMode) return
    setDraggedSection(sectionId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', sectionId)
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }, [isCustomizeMode])

  const handleDragOver = useCallback((e: React.DragEvent, sectionId: string, panel: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSection(sectionId)
    setDragOverPanel(panel)
    handleAutoScroll(e)
  }, [isCustomizeMode, draggedSection, handleAutoScroll])

  const handleDragLeave = useCallback(() => {
    setDragOverSection(null)
    setDragOverPanel(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetSectionId: string, targetPanel: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection) return
    e.preventDefault()

    const sourcePanel = leftPanelSections.includes(draggedSection) ? 'left' : 'right'
    const targetSections = targetPanel === 'left' ? leftPanelSections : rightPanelSections
    const sourceSections = sourcePanel === 'left' ? leftPanelSections : rightPanelSections

    if (sourcePanel === targetPanel) {
      // Reorder within same panel
      const newSections = [...targetSections]
      const draggedIndex = newSections.indexOf(draggedSection)
      const targetIndex = newSections.indexOf(targetSectionId)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        newSections.splice(draggedIndex, 1)
        newSections.splice(targetIndex, 0, draggedSection)
        
        if (targetPanel === 'left') {
          setLeftPanelSections(newSections)
        } else {
          setRightPanelSections(newSections)
        }
      }
    } else {
      // Move between panels
      const newSourceSections = sourceSections.filter(s => s !== draggedSection)
      const newTargetSections = [...targetSections]
      const targetIndex = newTargetSections.indexOf(targetSectionId)
      
      if (targetIndex !== -1) {
        newTargetSections.splice(targetIndex, 0, draggedSection)
      } else {
        newTargetSections.push(draggedSection)
      }
      
      if (sourcePanel === 'left') {
        setLeftPanelSections(newSourceSections)
        setRightPanelSections(newTargetSections)
      } else {
        setRightPanelSections(newSourceSections)
        setLeftPanelSections(newTargetSections)
      }
    }

    setDraggedSection(null)
    setDragOverSection(null)
    setDragOverPanel(null)
    saveLayout()
  }, [isCustomizeMode, draggedSection, leftPanelSections, rightPanelSections, saveLayout])

  const handleDragEnd = useCallback(() => {
    setDraggedSection(null)
    setDragOverSection(null)
    setDragOverPanel(null)
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
      }
    }
  }, [])

  return {
    isCustomizeMode,
    isMaximized,
    leftPanelSections,
    rightPanelSections,
    draggedSection,
    dragOverSection,
    dragOverPanel,
    scrollContainerRef,
    setIsCustomizeMode,
    setIsMaximized,
    setLeftPanelSections,
    setRightPanelSections,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    saveLayout
  }
}

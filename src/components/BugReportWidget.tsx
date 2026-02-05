'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bug, Minus, Square, X } from 'lucide-react'
import BugReportForm from './BugReportForm'

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

const MIN_WIDTH = 420
const MIN_HEIGHT = 500
const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 600
const ICON_SIZE = 56

const STORAGE_KEYS = {
  position: 'bugReportWidget_position',
  size: 'bugReportWidget_size',
}

export default function BugReportWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 })
  const [size, setSize] = useState<Size>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [preMaximizeState, setPreMaximizeState] = useState<{ position: Position; size: Size } | null>(null)
  
  const widgetRef = useRef<HTMLDivElement>(null)
  const initialMousePos = useRef<Position>({ x: 0, y: 0 })
  const initialSize = useRef<Size>({ width: 0, height: 0 })
  const initialPosition = useRef<Position>({ x: 0, y: 0 })

  // Load saved position and size from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedPosition = localStorage.getItem(STORAGE_KEYS.position)
    const savedSize = localStorage.getItem(STORAGE_KEYS.size)

    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition)
        // Validate position is within viewport
        const maxX = window.innerWidth - ICON_SIZE
        const maxY = window.innerHeight - ICON_SIZE
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        })
      } catch (e) {
        console.error('Failed to parse saved position:', e)
        setPosition({ x: window.innerWidth - ICON_SIZE - 24, y: window.innerHeight - ICON_SIZE - 24 })
      }
    } else {
      // Default position: bottom-right
      setPosition({ x: window.innerWidth - ICON_SIZE - 24, y: window.innerHeight - ICON_SIZE - 24 })
    }

    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize)
        setSize({
          width: Math.max(MIN_WIDTH, parsed.width),
          height: Math.max(MIN_HEIGHT, parsed.height),
        })
      } catch (e) {
        console.error('Failed to parse saved size:', e)
      }
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    if (position.x >= 0 && position.y >= 0) {
      localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(position))
    }
  }, [position])

  // Save size to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.size, JSON.stringify(size))
  }, [size])

  // Constrain position to viewport on resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (!isExpanded) {
        const maxX = window.innerWidth - ICON_SIZE
        const maxY = window.innerHeight - ICON_SIZE
        setPosition(prev => ({
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        }))
      } else if (!isMaximized) {
        const maxX = window.innerWidth - size.width
        const maxY = window.innerHeight - size.height
        setPosition(prev => ({
          x: Math.min(Math.max(0, prev.x), Math.max(0, maxX)),
          y: Math.min(Math.max(0, prev.y), Math.max(0, maxY)),
        }))
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [isExpanded, isMaximized, size])

  // Handle dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return
    e.preventDefault()
    setIsDragging(true)
    
    const rect = widgetRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [isMaximized])

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const elementWidth = isExpanded ? size.width : ICON_SIZE
    const elementHeight = isExpanded ? size.height : ICON_SIZE

    const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - elementWidth))
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - elementHeight))

    setPosition({ x: newX, y: newY })
  }, [isDragging, dragOffset, isExpanded, size])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle resizing
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (isMaximized) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    initialMousePos.current = { x: e.clientX, y: e.clientY }
    initialSize.current = { ...size }
    initialPosition.current = { ...position }
  }, [isMaximized, size, position])

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return

    const deltaX = e.clientX - initialMousePos.current.x
    const deltaY = e.clientY - initialMousePos.current.y

    let newWidth = initialSize.current.width
    let newHeight = initialSize.current.height
    let newX = initialPosition.current.x
    let newY = initialPosition.current.y

    const maxWidth = window.innerWidth * 0.95
    const maxHeight = window.innerHeight * 0.95

    // Handle different resize directions
    if (resizeDirection.includes('e')) {
      newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, initialSize.current.width + deltaX))
    }
    if (resizeDirection.includes('w')) {
      const proposedWidth = initialSize.current.width - deltaX
      if (proposedWidth >= MIN_WIDTH && proposedWidth <= maxWidth) {
        newWidth = proposedWidth
        newX = initialPosition.current.x + deltaX
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, initialSize.current.height + deltaY))
    }
    if (resizeDirection.includes('n')) {
      const proposedHeight = initialSize.current.height - deltaY
      if (proposedHeight >= MIN_HEIGHT && proposedHeight <= maxHeight) {
        newHeight = proposedHeight
        newY = initialPosition.current.y + deltaY
      }
    }

    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - newWidth))
    newY = Math.max(0, Math.min(newY, window.innerHeight - newHeight))

    setSize({ width: newWidth, height: newHeight })
    setPosition({ x: newX, y: newY })
  }, [isResizing, resizeDirection])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
  }, [])

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])

  // Expand/collapse handlers
  const handleExpand = () => {
    if (!isExpanded) {
      // Calculate centered position for expanded widget
      const newX = Math.max(0, Math.min(position.x - (size.width - ICON_SIZE) / 2, window.innerWidth - size.width))
      const newY = Math.max(0, Math.min(position.y - (size.height - ICON_SIZE) / 2, window.innerHeight - size.height))
      setPosition({ x: newX, y: newY })
    }
    setIsExpanded(true)
  }

  const handleMinimize = () => {
    if (isMaximized) {
      setIsMaximized(false)
      if (preMaximizeState) {
        setPosition(preMaximizeState.position)
        setSize(preMaximizeState.size)
      }
    }
    setIsExpanded(false)
    // Move icon to where the widget was
    const newX = Math.min(position.x, window.innerWidth - ICON_SIZE)
    const newY = Math.min(position.y, window.innerHeight - ICON_SIZE)
    setPosition({ x: newX, y: newY })
  }

  const handleMaximize = () => {
    if (!isMaximized) {
      setPreMaximizeState({ position, size })
      setIsMaximized(true)
    } else {
      setIsMaximized(false)
      if (preMaximizeState) {
        setPosition(preMaximizeState.position)
        setSize(preMaximizeState.size)
      }
    }
  }

  const handleClose = () => {
    setIsExpanded(false)
    setIsMaximized(false)
    if (preMaximizeState) {
      setPosition(preMaximizeState.position)
    }
  }

  const handleSubmitSuccess = () => {
    handleClose()
  }

  // Don't render until position is calculated
  if (position.x < 0 || position.y < 0) {
    return null
  }

  // Minimized state - floating bug icon
  if (!isExpanded) {
    return (
      <div
        ref={widgetRef}
        className="fixed z-[9999] cursor-move select-none"
        style={{
          left: position.x,
          top: position.y,
          width: ICON_SIZE,
          height: ICON_SIZE,
        }}
        onMouseDown={handleDragStart}
        onClick={(e) => {
          if (!isDragging) {
            handleExpand()
          }
        }}
      >
        <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-110 active:scale-95 border-2 border-red-400">
          <Bug className="w-7 h-7 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse border border-yellow-300" />
      </div>
    )
  }

  // Expanded state - full widget
  const expandedStyle = isMaximized
    ? {
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
      }
    : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }

  return (
    <div
      ref={widgetRef}
      className={`fixed z-[9999] bg-[#0d2626] border border-[#1a3d3d] shadow-2xl flex flex-col ${
        isMaximized ? 'rounded-none' : 'rounded-xl'
      } ${isDragging || isResizing ? 'select-none' : ''}`}
      style={expandedStyle}
    >
      {/* Header - Draggable */}
      <div
        className={`flex items-center justify-between px-4 py-3 bg-[#0a1f1f] border-b border-[#1a3d3d] ${
          isMaximized ? '' : 'rounded-t-xl cursor-move'
        }`}
        onMouseDown={!isMaximized ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-red-400" />
          <span className="font-semibold text-white">Report a Bug</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1.5 hover:bg-[#1a3d3d] rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1.5 hover:bg-[#1a3d3d] rounded transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <BugReportForm onSubmitSuccess={handleSubmitSuccess} />
      </div>

      {/* Resize Handles (only when not maximized) */}
      {!isMaximized && (
        <>
          {/* Edge handles */}
          <div
            className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className="absolute left-0 top-2 bottom-2 w-1 cursor-w-resize"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            className="absolute right-0 top-2 bottom-2 w-1 cursor-e-resize"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
        </>
      )}
    </div>
  )
}

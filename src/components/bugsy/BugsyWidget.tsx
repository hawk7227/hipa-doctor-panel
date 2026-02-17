// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client';

// ============================================================================
// BUGSY AI WIDGET - Main Entry Point
// Version: 1.0.0
// Description: Floating bug button that opens the Bugsy interview modal
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bug, Sparkles } from 'lucide-react';
import BugsyModal from './BugsyModal';

// ============================================================================
// TYPES
// ============================================================================

interface Position {
  x: number;
  y: number;
}

interface BugsyWidgetProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ICON_SIZE = 60;
const STORAGE_KEY = 'bugsy_widget_position';

const POSITION_DEFAULTS: Record<string, Position> = {
  'bottom-right': { x: -1, y: -1 }, // Will be calculated
  'bottom-left': { x: 24, y: -1 },
  'top-right': { x: -1, y: 24 },
  'top-left': { x: 24, y: 24 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function BugsyWidget({ position = 'bottom-right' }: BugsyWidgetProps) {
  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  // Refs
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartTime = useRef<number>(0);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize position
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPosition = localStorage.getItem(STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        const maxX = window.innerWidth - ICON_SIZE;
        const maxY = window.innerHeight - ICON_SIZE;
        setWidgetPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      } catch {
        setDefaultPosition();
      }
    } else {
      setDefaultPosition();
    }
  }, [position]);

  // Save position on change
  useEffect(() => {
    if (widgetPosition.x >= 0 && widgetPosition.y >= 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetPosition));
    }
  }, [widgetPosition]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (widgetPosition.x >= 0 && widgetPosition.y >= 0) {
        const maxX = window.innerWidth - ICON_SIZE;
        const maxY = window.innerHeight - ICON_SIZE;
        setWidgetPosition((prev) => ({
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [widgetPosition]);

  // Periodic pulse animation
  useEffect(() => {
    if (isModalOpen) return;

    const interval = setInterval(() => {
      setPulseCount((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [isModalOpen]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const setDefaultPosition = () => {
    if (typeof window === 'undefined') return;

    const defaults = POSITION_DEFAULTS[position];
    setWidgetPosition({
      x: defaults.x < 0 ? window.innerWidth - ICON_SIZE - 24 : defaults.x,
      y: defaults.y < 0 ? window.innerHeight - ICON_SIZE - 24 : defaults.y,
    });
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartTime.current = Date.now();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }
  }, []);

  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const newX = Math.max(0, Math.min(clientX - dragOffset.x, window.innerWidth - ICON_SIZE));
      const newY = Math.max(0, Math.min(clientY - dragOffset.y, window.innerHeight - ICON_SIZE));

      setWidgetPosition({ x: newX, y: newY });
    },
    [isDragging, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    const dragDuration = Date.now() - dragStartTime.current;
    setIsDragging(false);

    // If drag was short (< 200ms) and minimal movement, treat as click
    if (dragDuration < 200) {
      setIsModalOpen(true);
    }
  }, []);

  // Global mouse/touch event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDrag);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  const handleClick = () => {
    if (!isDragging) {
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleSubmitSuccess = (reportId: string) => {
    console.log('Bug report submitted:', reportId);
    setIsModalOpen(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Don't render until position is calculated
  if (widgetPosition.x < 0 || widgetPosition.y < 0) {
    return null;
  }

  return (
    <>
      {/* Floating Bug Button */}
      <div
        ref={widgetRef}
        className={`fixed z-[9998] cursor-grab select-none transition-transform duration-200 ${
          isDragging ? 'cursor-grabbing scale-110' : ''
        } ${isHovered && !isDragging ? 'scale-110' : ''}`}
        style={{
          left: widgetPosition.x,
          top: widgetPosition.y,
          width: ICON_SIZE,
          height: ICON_SIZE,
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main Button */}
        <div
          className={`w-full h-full rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            isHovered
              ? 'bg-gradient-to-br from-teal-400 to-teal-600 shadow-teal-500/50 shadow-xl'
              : 'bg-gradient-to-br from-teal-500 to-teal-700'
          }`}
        >
          {/* Bugsy Icon */}
          <div className="relative">
            <Bug className="w-7 h-7 text-white" />
            <Sparkles
              className={`absolute -top-1 -right-1 w-3 h-3 text-yellow-300 transition-opacity duration-300 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        </div>

        {/* Pulse Ring Animation */}
        <div
          key={pulseCount}
          className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-30 pointer-events-none"
          style={{ animationDuration: '2s', animationIterationCount: 1 }}
        />

        {/* Notification Badge */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
          <span className="text-[8px] font-bold text-yellow-900">AI</span>
        </div>

        {/* Tooltip */}
        {isHovered && !isDragging && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
            <span className="font-medium">Report a Bug</span>
            <span className="text-teal-400 ml-1">with Bugsy AI</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <BugsyModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmitSuccess={handleSubmitSuccess}
        />
      )}
    </>
  );
}


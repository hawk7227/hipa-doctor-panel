// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React from 'react'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — SKELETON LOADERS
// Reusable loading placeholders for panels and cards
// ═══════════════════════════════════════════════════════════════

// Base pulse bar
function Bar({ w = 'w-full', h = 'h-3', className = '' }: { w?: string; h?: string; className?: string }) {
  return <div className={`${w} ${h} bg-white/[0.06] rounded animate-pulse ${className}`} />
}

// ── Panel skeleton (generic) ──
export function PanelSkeleton({ rows = 4, hasHeader = true }: { rows?: number; hasHeader?: boolean }) {
  return (
    <div className="p-4 space-y-4">
      {hasHeader && (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <Bar w="w-32" h="h-4" />
            <Bar w="w-48" h="h-2.5" />
          </div>
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Bar w="w-20" h="h-3" />
          <Bar w={i % 2 === 0 ? 'w-2/3' : 'w-1/2'} h="h-3" />
        </div>
      ))}
    </div>
  )
}

// ── Table skeleton ──
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center space-x-3 px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Bar key={i} w={i === 0 ? 'w-1/4' : 'w-1/6'} h="h-2.5" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center space-x-3 px-4 py-3 border-t border-[#1a3d3d]/30">
          {Array.from({ length: cols }).map((_, c) => (
            <Bar key={c} w={c === 0 ? 'w-1/4' : 'w-1/6'} h="h-3" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Card skeleton ──
export function CardSkeleton() {
  return (
    <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 space-y-3">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="space-y-1.5 flex-1">
          <Bar w="w-28" h="h-4" />
          <Bar w="w-40" h="h-2.5" />
        </div>
      </div>
      <Bar />
      <Bar w="w-3/4" />
    </div>
  )
}

// ── Stat card skeleton ──
export function StatCardSkeleton() {
  return (
    <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 space-y-2">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-white/[0.06] rounded animate-pulse" />
        <Bar w="w-16" h="h-2.5" />
      </div>
      <Bar w="w-12" h="h-7" />
    </div>
  )
}

// ── Chat message skeleton ──
export function ChatSkeleton({ messages = 3 }: { messages?: number }) {
  return (
    <div className="p-4 space-y-4">
      {Array.from({ length: messages }).map((_, i) => {
        const isRight = i % 2 === 1
        return (
          <div key={i} className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] space-y-1.5 ${isRight ? 'items-end' : 'items-start'}`}>
              <Bar w={i === 0 ? 'w-48' : i === 1 ? 'w-32' : 'w-56'} h="h-8" />
              <Bar w="w-16" h="h-2" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Form skeleton ──
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="p-4 space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bar w="w-20" h="h-2.5" />
          <Bar h="h-9" />
        </div>
      ))}
      <Bar w="w-28" h="h-9" className="mt-2" />
    </div>
  )
}

// ── Full page skeleton ──
export function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="space-y-1.5">
          <Bar w="w-40" h="h-5" />
          <Bar w="w-56" h="h-3" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      {/* Table */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
        <TableSkeleton />
      </div>
    </div>
  )
}

'use client'
import React from 'react'
import { BarChart3 } from 'lucide-react'

export default function QualityMeasuresPage() {
  return (
    <div className="min-h-screen bg-[#030f0f] text-white p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold">Quality Measures (MIPS)</h1>
          <p className="text-xs text-gray-500">Track quality metrics across all patients from the patient workspace</p>
        </div>
      </div>
      <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Quality measures are tracked per-patient in the EHR workspace.</p>
        <p className="text-xs text-gray-600 mt-2">Open a patient chart → Quality panel to view MIPS scores, care gaps, and performance metrics.</p>
      </div>
    </div>
  )
}

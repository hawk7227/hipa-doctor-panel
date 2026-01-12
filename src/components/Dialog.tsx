'use client'

import { Fragment } from 'react'
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  confirmText?: string
  showCancel?: boolean
  cancelText?: string
  onConfirm?: () => void
}

export default function Dialog({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  showCancel = false,
  cancelText = 'Cancel',
  onConfirm
}: DialogProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  const iconMap = {
    success: <CheckCircle className="w-8 h-8 text-green-400" />,
    error: <XCircle className="w-8 h-8 text-red-400" />,
    warning: <AlertCircle className="w-8 h-8 text-yellow-400" />,
    info: <Info className="w-8 h-8 text-teal-400" />
  }

  const bgColorMap = {
    success: 'bg-green-500/10 border-green-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    info: 'bg-teal-500/10 border-teal-500/20'
  }

  const buttonColorMap = {
    success: 'bg-green-500 hover:bg-green-600',
    error: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    info: 'bg-teal-500 hover:bg-teal-600'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`p-6 border-b border-[#1a3d3d] ${bgColorMap[type]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {iconMap[type]}
              <h3 className="text-xl font-semibold text-white">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1a3d3d]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a3d3d] flex gap-3 justify-end">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#164e4e] hover:bg-[#1a5a5a] text-white rounded-lg font-medium transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-6 py-2.5 ${buttonColorMap[type]} text-white rounded-lg font-medium transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}


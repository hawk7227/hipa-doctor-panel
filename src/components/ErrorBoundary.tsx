'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — ERROR BOUNDARY
// Catches React render errors and shows a recovery UI
// HIPAA: Prevents patient data exposure from unhandled crashes
// ═══════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  label?: string // e.g. "Calendar", "Chart Management" — shown in error UI
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, errorInfo)
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)

    // TODO Phase I: Log to audit_logs table for HIPAA compliance
    // logAuditEvent('ERROR_BOUNDARY', { error: error.message, component: errorInfo.componentStack })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    window.location.href = '/doctor/dashboard'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="bg-[#0d2626] border border-red-500/30 rounded-xl p-6 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/15 rounded-xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {this.props.label ? `${this.props.label} Error` : 'Something went wrong'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {this.state.error?.message || 'An unexpected error occurred. No patient data was exposed.'}
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={this.handleReset}
                className="flex items-center space-x-1.5 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center space-x-1.5 bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/30 text-gray-300 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left mt-4">
                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">Stack trace (dev only)</summary>
                <pre className="mt-2 text-[9px] text-red-400/70 bg-[#0a1f1f] rounded-lg p-3 overflow-x-auto max-h-40">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

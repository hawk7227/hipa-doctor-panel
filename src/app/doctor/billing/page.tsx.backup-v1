'use client'

import { useEffect, useState } from 'react'
import { supabase, PaymentRecordWithAppointment } from '@/lib/supabase'

export default function DoctorBilling() {
  const [payments, setPayments] = useState<PaymentRecordWithAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [monthlyEarnings, setMonthlyEarnings] = useState(0)

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      // Fetch payment records
      const { data: paymentData, error } = await supabase
        .from('payment_records')
        .select(`
          *,
          appointments!payment_records_appointment_id_fkey(
            id,
            status,
            created_at,
            patients!appointments_patient_id_fkey(first_name, last_name)
          )
        `)
        .eq('status', 'captured')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching payment data:', error)
        return
      }

      setPayments(paymentData || [])

      // Calculate earnings
      const total = paymentData?.reduce((sum, payment) => sum + payment.amount, 0) || 0
      setTotalEarnings(total)

      // Calculate monthly earnings (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const monthly = paymentData?.filter(payment => 
        new Date(payment.created_at) >= thirtyDaysAgo
      ).reduce((sum, payment) => sum + payment.amount, 0) || 0
      
      setMonthlyEarnings(monthly)
    } catch (error) {
      console.error('Error fetching billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100) // Assuming amount is in cents
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Patient', 'Amount', 'Status', 'Payment Intent ID'].join(','),
      ...payments.map(payment => [
        new Date(payment.created_at).toLocaleDateString(),
        `${payment.appointments?.patients?.first_name || ''} ${payment.appointments?.patients?.last_name || ''}`.trim() || 'N/A',
        formatCurrency(payment.amount),
        payment.status,
        payment.payment_intent_id
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `doctor-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Billing & Reports</h1>
            <p className="text-gray-600 mt-2">Track your earnings and payment history</p>
          </div>
                     <button
             onClick={exportToCSV}
             className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-0"
           >
             Export CSV
           </button>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Total Earnings</p>
              <p className="text-2xl font-semibold text-white">{formatCurrency(totalEarnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">This Month</p>
              <p className="text-2xl font-semibold text-white">{formatCurrency(monthlyEarnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Total Sessions</p>
              <p className="text-2xl font-semibold text-white">{payments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d]">
        <div className="p-6 border-b border-[#1a3d3d]">
          <h2 className="text-lg font-semibold text-white">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#1a3d3d]">
            <thead className="bg-[#0a1f1f]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Payment ID
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#0d2626] divide-y divide-[#1a3d3d]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                    No payment records found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {payment.appointments?.patients?.first_name || ''} {payment.appointments?.patients?.last_name || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        payment.status === 'captured' ? 'bg-green-100 text-green-800' :
                        payment.status === 'authorized' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {payment.payment_intent_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

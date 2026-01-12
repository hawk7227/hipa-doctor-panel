import { stripe } from './stripe'
import { supabase } from './supabase'

export interface PaymentResult {
  success: boolean
  error?: string
  paymentIntentId?: string
  amount?: number
}

export const capturePayment = async (paymentIntentId: string): Promise<PaymentResult> => {
  try {
    // Capture the payment intent
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId)

    if (paymentIntent.status === 'succeeded') {
      // Update payment record in database
      const { error } = await supabase
        .from('payment_records')
        .update({
          status: 'captured',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntentId)

      if (error) {
        console.error('Error updating payment record:', error)
        // Payment was captured but database update failed
        return {
          success: true,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          error: 'Payment captured but database update failed'
        }
      }

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount
      }
    } else {
      return {
        success: false,
        error: `Payment failed with status: ${paymentIntent.status}`
      }
    }
  } catch (error: any) {
    console.error('Error capturing payment:', error)
    return {
      success: false,
      error: error.message || 'Failed to capture payment'
    }
  }
}

export const refundPayment = async (paymentIntentId: string, amount?: number): Promise<PaymentResult> => {
  try {
    const refundParams: any = {
      payment_intent: paymentIntentId
    }

    if (amount) {
      refundParams.amount = amount
    }

    const refund = await stripe.refunds.create(refundParams)

    // Update payment record in database
    const { error } = await supabase
      .from('payment_records')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntentId)

    if (error) {
      console.error('Error updating payment record:', error)
    }

    return {
      success: true,
      paymentIntentId: refund.payment_intent as string,
      amount: refund.amount
    }
  } catch (error: any) {
    console.error('Error refunding payment:', error)
    return {
      success: false,
      error: error.message || 'Failed to refund payment'
    }
  }
}

export const getPaymentStatus = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    return {
      success: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    }
  } catch (error: any) {
    console.error('Error getting payment status:', error)
    return {
      success: false,
      error: error.message || 'Failed to get payment status'
    }
  }
}

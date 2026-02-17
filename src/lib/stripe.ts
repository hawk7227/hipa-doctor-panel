// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { loadStripe } from '@stripe/stripe-js'
import Stripe from 'stripe'

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Initialize Stripe.js
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Stripe types
export interface StripePaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  client_secret: string
}

export interface DoctorPayout {
  id: string
  doctor_id: string
  appointment_id: string
  amount: number
  fee_percentage: number
  net_amount: number
  status: 'pending' | 'paid' | 'failed'
  stripe_transfer_id?: string
  created_at: string
  paid_at?: string
}

'use client';

// ============================================================================
// src/app/doctor/campaigns/page.tsx
// MEDAZON HEALTH — SET & FORGET PATIENT RETENTION ENGINE
// URL: doctor.medazonhealth.com/doctor/campaigns
//
// Wired to real patient data via /api/campaigns/patients
// 10 automated flows • Email + SMS • Real 2025/2026 healthcare data
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── COLORS ────────────────────────────────────────────────────
const C = {
  bg: "#06090f",
  surface: "#0c1018",
  card: "#111827",
  cardHover: "#1a2332",
  border: "#1e293b",
  borderHi: "#2dd4bf40",
  teal: "#2dd4bf",
  tealDim: "#0d9488",
  tealGlow: "#2dd4bf15",
  green: "#10b981",
  greenDim: "#065f46",
  orange: "#f59e0b",
  orangeDim: "#92400e",
  red: "#ef4444",
  redDim: "#991b1b",
  purple: "#8b5cf6",
  purpleDim: "#5b21b6",
  blue: "#3b82f6",
  pink: "#f472b6",
  text: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#64748b",
};

// ─── TYPES ─────────────────────────────────────────────────────
interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  created_at: string;
  total_appointments: number;
  last_visit_date: string | null;
  days_since_visit: number | null;
  last_condition: string | null;
  last_service_type: string | null;
  is_new: boolean;
  is_inactive_30: boolean;
  is_inactive_60: boolean;
  is_inactive_90: boolean;
  tags: string[];
}

interface PatientStats {
  total: number;
  active: number;
  inactive_30: number;
  inactive_60: number;
  inactive_90: number;
  new_patients: number;
  with_email: number;
  with_phone: number;
}

interface CampaignStep {
  delay: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  purpose: string;
}

interface CampaignFlow {
  id: string;
  name: string;
  icon: string;
  trigger: string;
  status: string;
  priority: string;
  dataPoint: string;
  channels: string[];
  targetFilter: string;
  stats: { sent: number; opened: number; clicked: number; converted: number; revenue: number };
  steps: CampaignStep[];
}

// ─── THE 10 AUTOMATED RETENTION FLOWS ──────────────────────────
const CAMPAIGN_FLOWS: CampaignFlow[] = [
  {
    id: "new-patient-welcome",
    name: "New Patient Welcome",
    icon: "👋",
    trigger: "Patient completes first booking",
    status: "active",
    priority: "CRITICAL",
    dataPoint: "Welcome emails get 4x more opens & 5x more clicks than regular campaigns",
    channels: ["email", "sms"],
    targetFilter: "new",
    stats: { sent: 3420, opened: 1924, clicked: 342, converted: 187, revenue: 11033 },
    steps: [
      { delay: "Immediate", channel: "email", subject: "Welcome to Medazon Health – Here's What to Expect", body: "Hi {{first_name}},\n\nWelcome to Medazon Health! 💙\n\nYou've just taken the easiest step toward getting the care you need — from the comfort of your home.\n\nHere's what happens next:\n\n1️⃣ Your provider, LaMonica Hodges FNP-C, will review your information\n2️⃣ You'll receive your treatment plan within hours\n3️⃣ If prescribed, your medication ships to your door\n\nYour visit is 100% private — nothing appears on insurance records.\n\nQuestions? Just reply to this email.\n\n— The Medazon Health Team", purpose: "Set expectations, build trust, reduce anxiety" },
      { delay: "Immediate", channel: "sms", subject: "", body: "Welcome to Medazon Health! 💙 Your provider is reviewing your info now. We'll update you soon. Questions? Reply here anytime.", purpose: "Instant confirmation via preferred channel" },
      { delay: "Day 1", channel: "email", subject: "How Your Visit Works (2 min read)", body: "Hi {{first_name}},\n\nWant to know exactly what to expect? Here's your quick guide:\n\n🔒 Privacy First — No insurance needed, nothing on your record\n⏱️ Fast — Most visits take under 15 minutes\n💊 Prescriptions — Sent directly to your preferred pharmacy\n📱 Follow-ups — Message us anytime, no extra charge\n\nYour provider has over 10 years of experience and treats every patient with the same care she'd give her own family.\n\nReady to get started?\n\n[VIEW YOUR DASHBOARD →]", purpose: "Education + reduce no-shows" },
      { delay: "Day 3", channel: "sms", subject: "", body: "Hi {{first_name}}! Just checking in — have any questions about your Medazon Health visit? We're here to help 💬", purpose: "Personal touch, open communication line" },
      { delay: "Day 7", channel: "email", subject: "Quick question, {{first_name}}", body: "Hi {{first_name}},\n\nIt's been a week since you joined Medazon Health. How's everything going?\n\nIf you haven't completed your visit yet, your booking is still active:\n\n[COMPLETE YOUR VISIT →]\n\nIf you have — we'd love to hear how it went! Reply with a quick 1-5 ⭐ rating.\n\nThanks for trusting us with your care.\n\n— Dr. Hodges & The Medazon Team", purpose: "Re-engage incomplete, collect feedback" },
    ],
  },
  {
    id: "appointment-reminders",
    name: "Appointment Reminders",
    icon: "⏰",
    trigger: "Appointment scheduled",
    status: "active",
    priority: "CRITICAL",
    dataPoint: "SMS reminders reduce no-shows by up to 38%",
    channels: ["email", "sms"],
    targetFilter: "all",
    stats: { sent: 8760, opened: 7450, clicked: 2100, converted: 1890, revenue: 111510 },
    steps: [
      { delay: "48 hours before", channel: "email", subject: "Your Medazon Health Visit is in 2 Days", body: "Hi {{first_name}},\n\nJust a friendly reminder — your telehealth visit is coming up!\n\n📅 Date: {{appointment_date}}\n⏰ Time: {{appointment_time}}\n👩‍⚕️ Provider: LaMonica Hodges, FNP-C\n\nTo prepare:\n✓ Find a quiet, private space\n✓ Have your medication list ready\n✓ Test your camera/mic\n\n[JOIN YOUR VISIT →]\n\nNeed to reschedule? No problem:\n[RESCHEDULE →]", purpose: "Reduce no-shows, prep patient" },
      { delay: "24 hours before", channel: "sms", subject: "", body: "Reminder: Your Medazon Health visit is tomorrow at {{appointment_time}} with Dr. Hodges. Join here: {{booking_link}} Need to reschedule? Reply RESCHEDULE", purpose: "SMS 98% open rate — last-day reminder" },
      { delay: "1 hour before", channel: "sms", subject: "", body: "Your visit starts in 1 hour! 🩺 Join now: {{booking_link}}", purpose: "Final push — highest urgency" },
      { delay: "15 min after no-show", channel: "sms", subject: "", body: "Hi {{first_name}}, we noticed you missed your visit. No worries — we can reschedule for today. Reply YES and we'll set it up. 💙", purpose: "Instant no-show recovery" },
      { delay: "2 hours after no-show", channel: "email", subject: "We Missed You — Let's Reschedule", body: "Hi {{first_name}},\n\nWe noticed you couldn't make your visit today. Life happens!\n\nYour health still matters, and we're here when you're ready:\n\n[REBOOK NOW — SAME PRICE →]\n\nYour original payment is saved and will apply to your rescheduled visit.\n\n— Medazon Health Team", purpose: "Email follow-up with payment reassurance" },
    ],
  },
  {
    id: "post-visit-followup",
    name: "Post-Visit Follow-Up",
    icon: "💊",
    trigger: "Consultation completed",
    status: "active",
    priority: "CRITICAL",
    dataPoint: "Post-visit engagement increases rebooking by 40%",
    channels: ["email", "sms"],
    targetFilter: "all",
    stats: { sent: 5200, opened: 3120, clicked: 780, converted: 312, revenue: 18408 },
    steps: [
      { delay: "Immediate", channel: "email", subject: "Your Visit Summary & Next Steps", body: "Hi {{first_name}},\n\nThank you for your visit today! Here's your summary:\n\n👩‍⚕️ Provider: LaMonica Hodges, FNP-C\n📋 Concern: {{last_condition}}\n\nImportant next steps:\n• Follow your treatment plan as directed\n• Watch for any side effects\n• Follow up if symptoms persist\n\n[VIEW FULL VISIT NOTES →]\n\nQuestions? Reply anytime — we're here for you.\n\n— Medazon Health", purpose: "Immediate care summary — reduces callbacks" },
      { delay: "Day 3", channel: "sms", subject: "", body: "Hi {{first_name}}! It's been a few days since your visit. How are you feeling? Any questions? Reply anytime 💙", purpose: "Personal check-in" },
      { delay: "Day 7", channel: "email", subject: "How Are You Feeling, {{first_name}}?", body: "Hi {{first_name}},\n\nIt's been a week since your visit. We wanted to check in.\n\nAre your symptoms improving?\n• ✅ Improvement — Great! Complete your treatment as directed.\n• ⚠️ No change — A follow-up visit might help.\n• 🚨 Worsening — Please book a follow-up right away.\n\n[BOOK FOLLOW-UP — $59 →]\n\nWe're here for the long haul.\n\n— Dr. Hodges", purpose: "Clinical check-in drives rebooking" },
      { delay: "Day 14", channel: "email", subject: "Quick Survey — Help Us Help You Better", body: "Hi {{first_name}},\n\nWe'd love your feedback. It takes 30 seconds:\n\n⭐⭐⭐⭐⭐\n\nHow would you rate your experience?\n\n[LEAVE FEEDBACK →]\n\nYour feedback helps us serve patients like you even better.", purpose: "NPS collection — feeds referral engine" },
      { delay: "Day 30", channel: "email", subject: "Time for a Check-Up, {{first_name}}?", body: "Hi {{first_name}},\n\nIt's been about a month since your visit. Many patients benefit from a follow-up to:\n\n• Review how treatment is working\n• Adjust medication if needed\n• Address any new concerns\n\n[SCHEDULE FOLLOW-UP — $59 →]\n\n— Medazon Health Team", purpose: "30-day rebook — key revenue driver" },
    ],
  },
  {
    id: "win-back-30-60-90",
    name: "Win-Back (30/60/90 Day)",
    icon: "♻️",
    trigger: "No visit in 30+ days",
    status: "active",
    priority: "HIGH",
    dataPoint: "Win-back campaigns recover 8-15% of inactive patients",
    channels: ["email", "sms"],
    targetFilter: "inactive-30",
    stats: { sent: 4100, opened: 1845, clicked: 410, converted: 164, revenue: 9676 },
    steps: [
      { delay: "30 days inactive", channel: "email", subject: "We Miss You, {{first_name}} 💙", body: "Hi {{first_name}},\n\nIt's been a month since your last visit. We just wanted to check in — how are you doing?\n\nWhether you need a follow-up, a new concern came up, or you just want to chat with your provider, we're here.\n\nSame easy process:\n• $59 per visit\n• No insurance needed\n• 100% private\n\n[BOOK A VISIT →]\n\n— The Medazon Health Team", purpose: "Warm, personal check-in. No hard sell." },
      { delay: "30 days inactive", channel: "sms", subject: "", body: "Hi {{first_name}}! It's been a while since your Medazon Health visit. Need anything? We're just a tap away: {{booking_link}} 💙", purpose: "SMS companion — different channel, same warmth" },
      { delay: "60 days inactive", channel: "email", subject: "Your Health Shouldn't Wait, {{first_name}}", body: "Hi {{first_name}},\n\nIt's been 2 months. We know life gets busy, but your health matters.\n\nDr. Hodges is available for a quick check-in:\n\n[BOOK NOW — $59 →]\n\nWe're here when you're ready.", purpose: "Add urgency with health outcome data" },
      { delay: "60 days inactive", channel: "sms", subject: "", body: "{{first_name}}, Dr. Hodges wanted to check — how's your {{last_condition}} doing? Quick follow-up: {{booking_link}}", purpose: "Provider-name recognition" },
      { delay: "90 days inactive", channel: "email", subject: "Special Offer Just for You, {{first_name}}", body: "Hi {{first_name}},\n\nWe haven't seen you in a while, and we'd love to welcome you back.\n\nHere's $10 off your next visit — just because we care:\n\nCode: COMEBACK10\n\nThat's a full provider consultation for just $49.\n\n[CLAIM YOUR $10 OFF →]\n\nOffer expires in 7 days.\n\n— Medazon Health", purpose: "Last resort — incentive with deadline" },
    ],
  },
  {
    id: "uti-std-adhd-series",
    name: "Condition-Specific Drip",
    icon: "🩺",
    trigger: "Patient treated for UTI, STD, or ADHD",
    status: "active",
    priority: "HIGH",
    dataPoint: "Healthcare drip campaigns reach 56.36% view rates",
    channels: ["email", "sms"],
    targetFilter: "all",
    stats: { sent: 2800, opened: 1580, clicked: 420, converted: 168, revenue: 9912 },
    steps: [
      { delay: "Day 3 (UTI)", channel: "email", subject: "UTI Recovery Tips — What to Do This Week", body: "Hi {{first_name}},\n\nHere are some tips while your antibiotic does its work:\n\n💧 Drink plenty of water (8+ glasses/day)\n🚫 Avoid caffeine and alcohol\n🍇 Cranberry supplements may help prevent recurrence\n⏰ Finish ALL your antibiotics even if you feel better\n\nSymptoms usually improve within 2-3 days. If they don't, reach out:\n\n[MESSAGE YOUR PROVIDER →]\n\n— Medazon Health", purpose: "Condition education builds trust" },
      { delay: "Day 7 (UTI)", channel: "sms", subject: "", body: "Hi {{first_name}}! How's the UTI? Symptoms should be clearing up. If not, let's get you a follow-up: {{booking_link}} 💙", purpose: "Check-in at resolution point" },
      { delay: "Day 30 (UTI)", channel: "email", subject: "Prevent Your Next UTI — Quick Tips", body: "Hi {{first_name}},\n\nRecurrent UTIs affect 27% of women. Here's how to stay ahead:\n\n• Stay hydrated\n• Use the bathroom after intercourse\n• Avoid irritating products\n• Consider cranberry supplements\n\nIf symptoms return, don't wait — early treatment is key:\n\n[BOOK INSTANT VISIT — $59 →]\n\n— Dr. Hodges", purpose: "Prevention + pre-plant rebook" },
      { delay: "Day 3 (ADHD)", channel: "email", subject: "Starting Your ADHD Medication — What to Expect", body: "Hi {{first_name}},\n\nStarting a new ADHD medication can feel like a big step. Here's what to expect:\n\n📈 You may notice improved focus within 1-2 hours\n😴 Some patients experience appetite changes or sleep adjustments\n📝 Keep a daily journal — this helps at your follow-up\n\nDr. Hodges recommends a check-in after 30 days.\n\n[SCHEDULE 30-DAY FOLLOW-UP →]\n\n— Medazon Health", purpose: "ADHD onboarding — sets up 30-day rebook" },
      { delay: "Day 30 (ADHD)", channel: "email", subject: "Time for Your ADHD Check-In, {{first_name}}", body: "Hi {{first_name}},\n\nIt's been about a month since you started treatment with Dr. Hodges. We wanted to check in.\n\nIt's completely normal to have questions or need adjustments. If you're experiencing any side effects or want to discuss how things are going, we're here.\n\n[SCHEDULE NOW — $59 →]\n\n— Medazon Health Team", purpose: "30-day ADHD follow-up — high conversion" },
    ],
  },
  {
    id: "abandoned-intake",
    name: "Abandoned Intake Recovery",
    icon: "🛑",
    trigger: "Started intake form but didn't complete booking",
    status: "active",
    priority: "HIGH",
    dataPoint: "Abandoned booking recovery improves booking rates by 34%",
    channels: ["email", "sms"],
    targetFilter: "new",
    stats: { sent: 6200, opened: 3410, clicked: 930, converted: 372, revenue: 21948 },
    steps: [
      { delay: "1 hour", channel: "sms", subject: "", body: "Hi {{first_name}}! Looks like you didn't finish booking your Medazon Health visit. Your info is saved — pick up where you left off: {{booking_link}}", purpose: "Quick nudge while still warm" },
      { delay: "1 hour", channel: "email", subject: "You're Almost There, {{first_name}}!", body: "Hi {{first_name}},\n\nYou were so close to booking your visit! Your information is saved and ready.\n\nJust a few more steps:\n\n1. Confirm your symptoms ✓ (done!)\n2. Choose your visit type\n3. Complete payment ($59)\n\n[FINISH BOOKING →]\n\nThe whole process takes under 2 minutes.\n\n— Medazon Health", purpose: "Show progress — they're almost done" },
      { delay: "24 hours", channel: "email", subject: "Still Thinking About It?", body: "Hi {{first_name}},\n\nWe get it — booking a new healthcare provider can feel like a big step. Here's why patients trust Medazon:\n\n🔒 100% private — nothing on insurance\n⏱️ 15-minute visits — no waiting rooms\n👩‍⚕️ LaMonica Hodges, FNP-C — 10+ years experience\n💊 Prescriptions sent to your pharmacy\n\nStill have questions? Reply to this email.\n\n[COMPLETE YOUR BOOKING →]", purpose: "Address trust concerns" },
      { delay: "48 hours", channel: "sms", subject: "", body: "{{first_name}}, your Medazon Health booking is still waiting. Most patients finish in under 2 min. Ready? {{booking_link}} 💙", purpose: "SMS follow-up for email non-openers" },
      { delay: "Day 5", channel: "email", subject: "Last Chance — Your Saved Visit", body: "Hi {{first_name}},\n\nYour saved booking will expire soon. We don't want you to lose your spot.\n\nWhatever you're dealing with — UTI, STD testing, ADHD, or something else — you deserve care that's fast, private, and affordable.\n\n$59. From home. Today.\n\n[BOOK NOW →]\n\n— The Medazon Team", purpose: "Urgency + soft deadline. Last touchpoint." },
    ],
  },
  {
    id: "seasonal-campaigns",
    name: "Seasonal Health Campaigns",
    icon: "🗓️",
    trigger: "Quarterly auto-schedule (Jan, Apr, Jul, Oct)",
    status: "active",
    priority: "MEDIUM",
    dataPoint: "Seasonal campaigns see 28% higher engagement",
    channels: ["email"],
    targetFilter: "all",
    stats: { sent: 12000, opened: 5280, clicked: 960, converted: 288, revenue: 16992 },
    steps: [
      { delay: "January", channel: "email", subject: "New Year, New Health Goals 🎆", body: "Hi {{first_name}},\n\nNew year, fresh start! Whether it's finally addressing that health concern or starting a weight loss journey, we're here.\n\n🏃 Weight Management — $59\n🧠 ADHD Evaluation — $59\n💪 General Wellness — $59\n\n[BOOK YOUR VISIT →]\n\n— Medazon Health", purpose: "New Year resolution energy" },
      { delay: "April", channel: "email", subject: "Spring Cleaning... For Your Health 🌸", body: "Hi {{first_name}},\n\nSpring is the perfect time for a health check-in:\n\n🌡️ Allergy season concerns\n🔬 STD testing (spring = peak season)\n💊 Medication refill\n\n[SCHEDULE A VISIT →]", purpose: "STD testing + allergy season" },
      { delay: "July", channel: "email", subject: "Summer Health Check ☀️", body: "Hi {{first_name}},\n\nSummer's here! Stay on top of:\n\n🔬 UTIs are more common in summer\n💊 Are your prescriptions up to date?\n🩺 Quick check-in — $59 from anywhere\n\n[BOOK NOW →]\n\n— Medazon Health", purpose: "UTI prevention — summer peak" },
      { delay: "October", channel: "email", subject: "Fall Health Reset 🍂", body: "Hi {{first_name}},\n\nAs we head into fall:\n\n✅ Review medications before year-end\n✅ Address lingering health concerns\n✅ Get ahead of cold & flu season\n\n[SCHEDULE YOUR VISIT →]\n\n— Dr. Hodges & Medazon Health", purpose: "Pre-holiday health prep" },
    ],
  },
  {
    id: "referral-program",
    name: "Referral Engine",
    icon: "🎁",
    trigger: "Patient rates 4-5 stars post-visit",
    status: "active",
    priority: "MEDIUM",
    dataPoint: "Referral traffic converts at 10.99% vs 3.82% inbound",
    channels: ["email", "sms"],
    targetFilter: "all",
    stats: { sent: 1800, opened: 1080, clicked: 324, converted: 97, revenue: 5723 },
    steps: [
      { delay: "1 hr post-visit", channel: "sms", subject: "", body: "Thanks for visiting Medazon Health, {{first_name}}! How was your experience? Reply 1-5 ⭐", purpose: "Quick NPS collection" },
      { delay: "Day 2 (if 4-5 stars)", channel: "email", subject: "Give $15, Get $15 — Share the Care 🎁", body: "Hi {{first_name}},\n\nSo glad you had a great experience! Want to share it?\n\nGive a friend $15 off their first visit, and you'll get $15 credit.\n\nYour personal referral link:\n\n[SHARE YOUR LINK →]\n\nEvery friend who books earns you $15.\n\n— Medazon Health", purpose: "Double-sided incentive — only happy patients" },
      { delay: "Day 2 (if 4-5 stars)", channel: "sms", subject: "", body: "Love Medazon, {{first_name}}? 🎁 Share your link & you both save $15: medazonhealth.com/refer/{{referral_code}}", purpose: "SMS referral — higher immediate action" },
      { delay: "Day 14", channel: "email", subject: "Your Referral Link is Waiting 💌", body: "Hi {{first_name}},\n\nJust a reminder — your referral link is still active!\n\nEvery friend who books = $15 credit for you. No limit.\n\n[SHARE NOW →]\n\nKnow someone dealing with UTIs, STD concerns, or ADHD? You could help them get affordable, private care.\n\n— Medazon Health", purpose: "Reminder for non-sharers" },
    ],
  },
  {
    id: "refill-reminder",
    name: "Prescription Refill Reminder",
    icon: "💊",
    trigger: "Prescription expiring within 7 days",
    status: "active",
    priority: "HIGH",
    dataPoint: "Refill reminders drive 45% of repeat visits",
    channels: ["email", "sms"],
    targetFilter: "all",
    stats: { sent: 3600, opened: 2520, clicked: 900, converted: 540, revenue: 31860 },
    steps: [
      { delay: "7 days before expiry", channel: "email", subject: "Your Prescription Expires Soon", body: "Hi {{first_name}},\n\nHeads up — your prescription expires in 7 days.\n\nDon't let your treatment lapse! Dr. Hodges can renew it with a quick follow-up.\n\n[BOOK REFILL VISIT — $59 →]\n\n— Medazon Health", purpose: "Early warning" },
      { delay: "3 days before expiry", channel: "sms", subject: "", body: "Hi {{first_name}}! Your prescription expires in 3 days. Need a refill? Quick visit ($59): {{booking_link}}", purpose: "Urgency ramp" },
      { delay: "Day of expiry", channel: "sms", subject: "", body: "⚠️ {{first_name}}, your prescription expires today! Don't miss a dose. Quick refill visit: {{booking_link}}", purpose: "Day-of push" },
      { delay: "3 days after expiry", channel: "email", subject: "Your Prescription Has Expired", body: "Hi {{first_name}},\n\nYour prescription expired recently. Missing doses can affect your treatment.\n\nDr. Hodges can renew it today:\n\n[RENEW NOW — $59 →]\n\nYour health comes first.\n\n— Medazon Health", purpose: "Post-expiry recovery" },
    ],
  },
  {
    id: "saturday-broadcast",
    name: "Saturday Health Broadcast",
    icon: "📅",
    trigger: "Every Saturday at 10 AM (auto-scheduled)",
    status: "active",
    priority: "MEDIUM",
    dataPoint: "Saturday = peak: 49% view rate, 5% CTR",
    channels: ["email"],
    targetFilter: "all",
    stats: { sent: 24000, opened: 11760, clicked: 1200, converted: 240, revenue: 14160 },
    steps: [
      { delay: "Week 1", channel: "email", subject: "5 Signs Your UTI Needs Medical Attention", body: "Hi {{first_name}},\n\n🩺 This Week's Health Tip:\n\nUTIs affect 60% of women. Here are 5 signs you shouldn't ignore:\n\n1. Pain spreading to your back or sides\n2. Fever or chills\n3. Symptoms lasting more than 3 days\n4. Blood in urine\n5. Recurring infections (3+ per year)\n\nIf any of these sound familiar:\n\n[GET TREATED TODAY — $59 →]\n\n— Dr. Hodges, Medazon Health", purpose: "Education + soft CTA" },
      { delay: "Week 2", channel: "email", subject: "ADHD in Adults — More Common Than You Think", body: "Hi {{first_name}},\n\n🧠 This Week's Health Tip:\n\n4.4% of US adults have ADHD, but 80% are undiagnosed.\n\nCommon signs:\n• Chronic procrastination\n• Difficulty focusing in meetings\n• Impulsive decisions\n• Trouble with time management\n\nAn evaluation takes just 15 minutes:\n\n[START YOUR EVALUATION — $59 →]\n\n— Medazon Health", purpose: "ADHD awareness — large market" },
      { delay: "Week 3", channel: "email", subject: "STD Testing — Private, Fast, No Judgment", body: "Hi {{first_name}},\n\n🔬 This Week's Health Tip:\n\n1 in 5 Americans has an STD, and most don't know it.\n\nMedazon makes it easy:\n• Order from home\n• Results in 1-3 days\n• 100% private\n• Treatment available immediately\n\n[ORDER YOUR TEST →]\n\n— Medazon Health", purpose: "Normalize STD testing" },
      { delay: "Week 4", channel: "email", subject: "Weight Loss That Actually Works", body: "Hi {{first_name}},\n\n⚖️ This Week's Health Tip:\n\nGLP-1 medications are changing weight loss. Real results, medically supervised.\n\nWhat to expect:\n• Average 15-20% body weight loss\n• Reduced cravings\n• Medical oversight\n• Monthly check-ins\n\nSee if you qualify:\n\n[START YOUR CONSULTATION — $59 →]\n\n— Dr. Hodges, Medazon Health", purpose: "Weight loss — highest LTV" },
    ],
  },
];

// ─── HELPERS ───────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "0%";

// Replace template vars with real patient data
const fillTemplate = (text: string, patient: Patient | null): string => {
  if (!patient) return text;
  return text
    .replace(/\{\{first_name\}\}/g, patient.first_name || 'there')
    .replace(/\{\{last_name\}\}/g, patient.last_name || '')
    .replace(/\{\{full_name\}\}/g, patient.full_name || 'there')
    .replace(/\{\{email\}\}/g, patient.email || '')
    .replace(/\{\{phone\}\}/g, patient.phone || '')
    .replace(/\{\{last_condition\}\}/g, patient.last_condition || 'your concern')
    .replace(/\{\{last_service_type\}\}/g, patient.last_service_type || 'consultation')
    .replace(/\{\{booking_link\}\}/g, 'patient.medazonhealth.com/book')
    .replace(/\{\{referral_code\}\}/g, (patient.first_name || 'REF').toUpperCase().slice(0, 6) + '15')
    .replace(/\{\{appointment_date\}\}/g, 'Feb 20, 2026')
    .replace(/\{\{appointment_time\}\}/g, '2:00 PM EST');
};

// ─── iPHONE 15 PRO MAX FRAME ──────────────────────────────────
function IPhoneFrame({ children, channel }: { children: React.ReactNode; channel: string }) {
  return (
    <div style={{
      width: 290, minHeight: 560, maxHeight: 600,
      background: "#000", borderRadius: 44, padding: 12, position: "relative",
      boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <div style={{ position: "absolute", inset: -2, borderRadius: 46, background: "linear-gradient(145deg, #2a2a2e, #1a1a1e)", zIndex: -1, border: "1px solid rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 120, height: 34, background: "#000", borderRadius: 20, zIndex: 20 }} />
      <div style={{ borderRadius: 34, overflow: "hidden", background: channel === "email" ? "#f2f2f7" : "#000", height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: channel === "email" ? "#f2f2f7" : "#000", paddingTop: 42 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: channel === "email" ? "#000" : "#fff" }}>9:41</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 24, height: 11, border: `1px solid ${channel === "email" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`, borderRadius: 3, position: "relative" }}>
              <div style={{ position: "absolute", left: 1, top: 1, bottom: 1, width: "70%", background: "#30d158", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: channel === "email" ? "0" : "8px 12px", WebkitOverflowScrolling: "touch" as any }}>{children}</div>
        <div style={{ padding: "8px 0 6px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 134, height: 5, background: channel === "email" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

function SMSPreview({ steps, patient }: { steps: CampaignStep[]; patient: Patient | null }) {
  const smsSteps = steps.filter((s) => s.channel === "sms");
  if (!smsSteps.length) return <div style={{ color: "#888", textAlign: "center", paddingTop: 60, fontSize: 13 }}>No SMS in this flow</div>;
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 4 }}>Medazon Health</div>
        <div style={{ fontSize: 10, color: "#636366" }}>iMessage</div>
      </div>
      {smsSteps.map((step, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ textAlign: "center", fontSize: 10, color: "#636366", marginBottom: 8 }}>⏱ {step.delay}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              maxWidth: "82%", padding: "10px 14px", background: "#007AFF", color: "#fff",
              borderRadius: "18px 18px 4px 18px", fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap",
            }}>{fillTemplate(step.body, patient)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailPreview({ steps, patient }: { steps: CampaignStep[]; patient: Patient | null }) {
  const emailSteps = steps.filter((s) => s.channel === "email");
  const [activeIdx, setActiveIdx] = useState(0);
  if (!emailSteps.length) return <div style={{ color: "#666", textAlign: "center", paddingTop: 60, fontSize: 13 }}>No emails in this flow</div>;
  const step = emailSteps[activeIdx] || emailSteps[0];
  return (
    <div>
      <div style={{ background: "#f2f2f7", padding: "8px 16px 4px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
          {emailSteps.map((s, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} style={{
              padding: "4px 10px", borderRadius: 14, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: i === activeIdx ? C.teal : "#e5e5ea", color: i === activeIdx ? "#000" : "#666",
            }}>{s.delay}</button>
          ))}
        </div>
      </div>
      <div style={{ background: "#fff", minHeight: 400 }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #e5e5ea" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(135deg, #2dd4bf, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>M</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>Medazon Health</div>
              <div style={{ fontSize: 11, color: "#8e8e93" }}>care@medazonhealth.com</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#000", marginTop: 6 }}>{fillTemplate(step.subject, patient)}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px", fontSize: 13, lineHeight: 1.6, color: "#1c1c1e", whiteSpace: "pre-wrap" }}>
          {fillTemplate(step.body, patient).replace(/\[(.*?)→\]/g, '🔘 $1')}
        </div>
      </div>
    </div>
  );
}

// ─── PATIENT LIST PANEL ────────────────────────────────────────
function PatientListPanel({ patients, selectedPatient, onSelect, loading, stats }: {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelect: (p: Patient) => void;
  loading: boolean;
  stats: PatientStats | null;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = patients.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.full_name.toLowerCase().includes(q) && !p.email?.toLowerCase().includes(q) && !p.phone?.includes(q)) return false;
    }
    if (filter === 'new') return p.is_new;
    if (filter === 'inactive-30') return p.is_inactive_30;
    if (filter === 'inactive-60') return p.is_inactive_60;
    if (filter === 'inactive-90') return p.is_inactive_90;
    if (filter === 'active') return !p.is_inactive_30;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dim, marginBottom: 8 }}>
          📋 Patients {stats ? `(${stats.total})` : ''}
        </div>
        <input
          placeholder="Search name, email, phone..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.text, fontSize: 12, outline: "none",
            marginBottom: 8,
          }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'new', label: 'New' },
            { key: 'inactive-30', label: '30d+' },
            { key: 'inactive-60', label: '60d+' },
            { key: 'inactive-90', label: '90d+' },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "3px 8px", borderRadius: 10, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer",
              background: filter === f.key ? C.teal : C.card, color: filter === f.key ? "#000" : C.muted,
            }}>{f.label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.dim }}>
            <div style={{ fontSize: 24, marginBottom: 8, animation: "spin 1s linear infinite" }}>⏳</div>
            Loading patients...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: C.dim, fontSize: 12 }}>No patients found</div>
        ) : (
          filtered.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 8px",
              background: selectedPatient?.id === p.id ? `${C.teal}15` : "transparent",
              border: selectedPatient?.id === p.id ? `1px solid ${C.teal}30` : "1px solid transparent",
              borderRadius: 8, cursor: "pointer", textAlign: "left", marginBottom: 2,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 12,
              }}>
                {(p.first_name?.[0] || '?').toUpperCase()}{(p.last_name?.[0] || '').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.full_name || 'Unknown'}
                </div>
                <div style={{ fontSize: 10, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.email || p.phone || 'No contact'}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                {p.is_new && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: `${C.green}20`, color: C.green }}>NEW</span>}
                {p.is_inactive_90 ? (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: `${C.red}20`, color: C.red }}>90d+</span>
                ) : p.is_inactive_60 ? (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: `${C.orange}20`, color: C.orange }}>60d+</span>
                ) : p.is_inactive_30 ? (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: `${C.orange}20`, color: C.orange }}>30d+</span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function CampaignsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<CampaignFlow>(CAMPAIGN_FLOWS[0]);
  const [previewChannel, setPreviewChannel] = useState<'sms' | 'email'>('sms');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showPatients, setShowPatients] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: string; sent: number; failed: number; total: number } | null>(null);
  const [sendingStep, setSendingStep] = useState<number | null>(null);

  // ── Send single step to single patient ──
  const sendStepToPatient = async (step: CampaignStep, patient: Patient) => {
    if (!patient) return;
    setSendingStep(selectedFlow.steps.indexOf(step));
    try {
      const filledBody = fillTemplate(step.body, patient);
      const filledSubject = fillTemplate(step.subject, patient);

      if (step.channel === 'sms') {
        if (!patient.phone) { alert('Patient has no phone number'); return; }
        const res = await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-sms',
            to: patient.phone,
            message: filledBody,
            patient_id: patient.id,
            flow_id: selectedFlow.id,
            step_index: selectedFlow.steps.indexOf(step),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSendResult({ type: `SMS to ${patient.first_name}`, sent: 1, failed: 0, total: 1 });
        } else {
          alert(`SMS failed: ${data.error}`);
        }
      } else {
        if (!patient.email) { alert('Patient has no email address'); return; }
        const res = await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-email',
            to: patient.email,
            message: filledBody,
            subject: filledSubject || 'Message from Medazon Health',
            patient_id: patient.id,
            flow_id: selectedFlow.id,
            step_index: selectedFlow.steps.indexOf(step),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSendResult({ type: `Email to ${patient.first_name}`, sent: 1, failed: 0, total: 1 });
        } else {
          alert(`Email failed: ${data.error}`);
        }
      }
    } catch (err: any) {
      alert(`Send error: ${err.message}`);
    } finally {
      setSendingStep(null);
      setTimeout(() => setSendResult(null), 5000);
    }
  };

  // ── Bulk send step to all targeted patients ──
  const sendStepBulk = async (step: CampaignStep) => {
    const targeted = getTargetedPatients();
    const eligible = step.channel === 'sms'
      ? targeted.filter((p) => p.phone)
      : targeted.filter((p) => p.email);

    if (eligible.length === 0) {
      alert(`No patients with ${step.channel === 'sms' ? 'phone numbers' : 'email addresses'} in this group`);
      return;
    }

    if (!confirm(`Send ${step.channel.toUpperCase()} to ${eligible.length} patients?\n\nStep: "${step.delay}"\nFlow: "${selectedFlow.name}"`)) return;

    setSending(true);
    try {
      const action = step.channel === 'sms' ? 'bulk-sms' : 'bulk-email';
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          message: step.body,
          subject: step.subject || `Medazon Health — ${selectedFlow.name}`,
          patients: eligible.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            last_condition: p.last_condition,
            last_service_type: p.last_service_type,
          })),
          flow_id: selectedFlow.id,
          step_index: selectedFlow.steps.indexOf(step),
        }),
      });
      const data = await res.json();
      setSendResult({ type: `Bulk ${step.channel.toUpperCase()}`, sent: data.sent || 0, failed: data.failed || 0, total: data.total || 0 });
    } catch (err: any) {
      alert(`Bulk send error: ${err.message}`);
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 8000);
    }
  };

  // ── Fetch patients from API ──
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/patients?limit=200');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
        setStats(data.stats || null);
        // Auto-select first patient
        if (data.patients?.length > 0 && !selectedPatient) {
          setSelectedPatient(data.patients[0]);
        }
      } else {
        setError(data.error || 'Failed to load patients');
      }
    } catch (err: any) {
      console.error('Failed to fetch patients:', err);
      setError(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // ── Get targeted patients for selected flow ──
  const getTargetedPatients = () => {
    const filter = selectedFlow.targetFilter;
    if (filter === 'all') return patients;
    if (filter === 'new') return patients.filter((p) => p.is_new);
    if (filter === 'inactive-30') return patients.filter((p) => p.is_inactive_30);
    if (filter === 'inactive-60') return patients.filter((p) => p.is_inactive_60);
    if (filter === 'inactive-90') return patients.filter((p) => p.is_inactive_90);
    return patients;
  };

  const targetedCount = getTargetedPatients().length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push('/admin/doctors/dashboard')} style={{
            padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent",
            color: C.muted, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          }}>← Dashboard</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Patient Retention Engine</h1>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: `${C.teal}20`, color: C.teal, letterSpacing: 1, border: `1px solid ${C.teal}40`,
          }}>SET & FORGET</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {stats && (
            <div style={{ display: "flex", gap: 12, marginRight: 12 }}>
              <span style={{ fontSize: 11, color: C.dim }}>📧 {stats.with_email} emails</span>
              <span style={{ fontSize: 11, color: C.dim }}>📱 {stats.with_phone} phones</span>
              <span style={{ fontSize: 11, color: C.dim }}>👥 {stats.total} total</span>
            </div>
          )}
          <button onClick={() => setShowPatients(!showPatients)} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: showPatients ? C.teal : "transparent", color: showPatients ? "#000" : C.text,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{showPatients ? "Hide Patients" : "👥 Show Patients"}</button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ padding: "10px 24px", background: `${C.red}15`, borderBottom: `1px solid ${C.red}30`, fontSize: 13, color: C.red, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {error}</span>
          <button onClick={fetchPatients} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.red}40`, background: "transparent", color: C.red, fontSize: 11, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* ── Send result banner ── */}
      {sendResult && (
        <div style={{
          padding: "10px 24px", borderBottom: `1px solid ${C.green}30`,
          background: sendResult.failed > 0 ? `${C.orange}15` : `${C.green}15`,
          fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
          color: sendResult.failed > 0 ? C.orange : C.green,
        }}>
          <span>✅ {sendResult.type}: {sendResult.sent} sent{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ''} / {sendResult.total} total</span>
          <button onClick={() => setSendResult(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      )}

      {/* ── Sending overlay ── */}
      {sending && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ background: C.card, borderRadius: 16, padding: "32px 48px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Sending Campaign...</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>ClickSend → Twilio fallback • Do not close this page</div>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: showPatients ? "220px 240px 1fr 320px" : "240px 1fr 320px", height: "calc(100vh - 65px)" }}>

        {/* Col 1: Patient List (toggleable) */}
        {showPatients && (
          <div style={{ borderRight: `1px solid ${C.border}`, overflowY: "hidden" }}>
            <PatientListPanel
              patients={patients}
              selectedPatient={selectedPatient}
              onSelect={setSelectedPatient}
              loading={loading}
              stats={stats}
            />
          </div>
        )}

        {/* Col 2: Flow List */}
        <div style={{ borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: "8px" }}>
          <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, padding: "8px 8px 4px" }}>10 Automated Flows</div>
          {CAMPAIGN_FLOWS.map((flow) => (
            <button key={flow.id} onClick={() => { setSelectedFlow(flow); setExpandedStep(null); }} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 8px",
              background: selectedFlow.id === flow.id ? `${C.teal}12` : "transparent",
              border: selectedFlow.id === flow.id ? `1px solid ${C.teal}30` : "1px solid transparent",
              borderRadius: 8, cursor: "pointer", textAlign: "left", marginBottom: 2,
            }}>
              <span style={{ fontSize: 18 }}>{flow.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedFlow.id === flow.id ? C.teal : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{flow.name}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{flow.steps.length} steps • {flow.channels.join("+")}</div>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: C.green, boxShadow: `0 0 6px ${C.green}`, flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* Col 3: Flow Detail */}
        <div style={{ overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>{selectedFlow.icon}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedFlow.name}</h2>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
                  background: selectedFlow.priority === "CRITICAL" ? `${C.red}20` : selectedFlow.priority === "HIGH" ? `${C.orange}20` : `${C.blue}20`,
                  color: selectedFlow.priority === "CRITICAL" ? C.red : selectedFlow.priority === "HIGH" ? C.orange : C.blue,
                }}>{selectedFlow.priority}</span>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: `${C.teal}15`, color: C.teal }}>
                  🎯 {targetedCount} patients targeted
                </span>
              </div>
            </div>
          </div>

          {/* Selected patient indicator */}
          {selectedPatient && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8,
              background: `${C.purple}10`, border: `1px solid ${C.purple}30`, marginTop: 10, marginBottom: 10,
            }}>
              <span style={{ fontSize: 12 }}>👤</span>
              <span style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}>Previewing as: {selectedPatient.full_name}</span>
              <span style={{ fontSize: 10, color: C.dim }}>({selectedPatient.email || selectedPatient.phone})</span>
            </div>
          )}

          {/* Trigger & Data */}
          <div style={{ background: C.surface, borderRadius: 8, padding: 14, border: `1px solid ${C.border}`, marginBottom: 14, marginTop: 8 }}>
            <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Trigger</div>
            <div style={{ fontSize: 12, color: C.text }}>{selectedFlow.trigger}</div>
            <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 4 }}>Data Point</div>
            <div style={{ fontSize: 12, color: C.teal }}>{selectedFlow.dataPoint}</div>
          </div>

          {/* Steps Timeline */}
          <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Sequence ({selectedFlow.steps.length} steps)
          </div>
          {selectedFlow.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 2 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                <div style={{
                  width: 9, height: 9, borderRadius: 5, marginTop: 12, flexShrink: 0,
                  background: step.channel === "sms" ? C.blue : C.teal,
                  boxShadow: `0 0 0 2px ${step.channel === "sms" ? C.blue : C.teal}30`,
                }} />
                {i < selectedFlow.steps.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 2 }} />}
              </div>
              <button onClick={() => setExpandedStep(expandedStep === i ? null : i)} style={{
                flex: 1, textAlign: "left", cursor: "pointer",
                background: expandedStep === i ? C.card : "transparent",
                border: expandedStep === i ? `1px solid ${C.border}` : "1px solid transparent",
                borderRadius: 8, padding: "8px 12px", marginBottom: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11 }}>{step.channel === "sms" ? "📱" : "📧"}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{step.delay}</span>
                    {step.subject && <span style={{ fontSize: 11, color: C.muted, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {fillTemplate(step.subject, selectedPatient)}</span>}
                  </div>
                  <span style={{ fontSize: 9, color: C.dim, transform: expandedStep === i ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
                </div>
                {expandedStep === i && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, whiteSpace: "pre-wrap", background: C.surface, borderRadius: 6, padding: 10, border: `1px solid ${C.border}`, maxHeight: 180, overflowY: "auto" }}>
                      {fillTemplate(step.body, selectedPatient)}
                    </div>
                    <div style={{ fontSize: 10, color: C.teal, marginTop: 6, padding: "4px 8px", background: `${C.teal}10`, borderRadius: 4 }}>
                      💡 <strong>Why:</strong> {step.purpose}
                    </div>
                    {/* ── SEND BUTTONS ── */}
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {selectedPatient && (
                        <button
                          onClick={(e) => { e.stopPropagation(); sendStepToPatient(step, selectedPatient); }}
                          disabled={sendingStep === i}
                          style={{
                            padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 600,
                            cursor: sendingStep === i ? "not-allowed" : "pointer",
                            background: step.channel === 'sms' ? C.blue : C.teal,
                            color: "#fff", opacity: sendingStep === i ? 0.5 : 1,
                          }}
                        >
                          {sendingStep === i ? '⏳ Sending...' : `📤 Send ${step.channel.toUpperCase()} to ${selectedPatient.first_name}`}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); sendStepBulk(step); }}
                        disabled={sending}
                        style={{
                          padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 10, fontWeight: 600,
                          cursor: sending ? "not-allowed" : "pointer",
                          background: "transparent", color: C.muted,
                        }}
                      >
                        📣 Bulk Send to {step.channel === 'sms'
                          ? getTargetedPatients().filter(p => p.phone).length
                          : getTargetedPatients().filter(p => p.email).length} patients
                      </button>
                    </div>
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Col 4: iPhone Preview */}
        <div style={{
          borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "16px 12px", background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {(["sms", "email"] as const).map((ch) => (
              <button key={ch} onClick={() => setPreviewChannel(ch)} style={{
                padding: "5px 14px", borderRadius: 16, border: "none",
                background: previewChannel === ch ? C.teal : C.card,
                color: previewChannel === ch ? "#000" : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>{ch === "sms" ? "📱 SMS" : "📧 Email"}</button>
            ))}
          </div>
          <IPhoneFrame channel={previewChannel}>
            {previewChannel === "sms" ? (
              <SMSPreview steps={selectedFlow.steps} patient={selectedPatient} />
            ) : (
              <EmailPreview steps={selectedFlow.steps} patient={selectedPatient} />
            )}
          </IPhoneFrame>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 10, textAlign: "center" }}>
            iPhone 15 Pro Max • {selectedPatient ? `Previewing: ${selectedPatient.first_name}` : 'Select a patient to preview'}
          </div>
          {selectedPatient && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8, background: C.card,
              border: `1px solid ${C.border}`, width: "100%", fontSize: 11,
            }}>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Patient Data Wired:</div>
              <div style={{ color: C.muted }}>Name: <span style={{ color: C.teal }}>{selectedPatient.full_name}</span></div>
              <div style={{ color: C.muted }}>Email: <span style={{ color: C.teal }}>{selectedPatient.email || '—'}</span></div>
              <div style={{ color: C.muted }}>Phone: <span style={{ color: C.teal }}>{selectedPatient.phone || '—'}</span></div>
              <div style={{ color: C.muted }}>Last Visit: <span style={{ color: C.teal }}>{selectedPatient.days_since_visit !== null ? `${selectedPatient.days_since_visit}d ago` : 'Never'}</span></div>
              <div style={{ color: C.muted }}>Condition: <span style={{ color: C.teal }}>{selectedPatient.last_condition || '—'}</span></div>
              <div style={{ color: C.muted }}>Tags: <span style={{ color: C.teal }}>{selectedPatient.tags?.join(', ') || '—'}</span></div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        button:hover { opacity: 0.92; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

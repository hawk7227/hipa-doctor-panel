// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'

// ═══════════════════════════════════════════════════════════════
// Clinical Note PDF Generator — Medazon Health
// Generates HIPAA-compliant clinical documentation PDFs
// Uses pdf-lib (pure JS, serverless-safe, no native dependencies)
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────
export interface PracticeInfo {
  name: string
  subtitle: string
  address: string
  phone: string
  fax: string
  npi: string
  logo_url?: string
}

export interface PatientInfo {
  full_name: string
  date_of_birth: string
  email: string
  phone: string
  address: string
  gender?: string
  chart_id?: string
}

export interface ProviderInfo {
  full_name: string
  credentials: string
  email: string
  npi: string
  license_state: string
  license_number: string
}

export interface SOAPNotes {
  chief_complaint?: string
  history_present_illness?: string
  review_of_systems?: string
  past_medical_history?: string
  medications?: string
  allergies?: string
  physical_exam?: string
  assessment?: string
  plan?: string
  treatment?: string
  pharmacy?: string
  followup?: string
  [key: string]: string | undefined
}

export interface AddendumEntry {
  id: string
  addendum_type: 'addendum' | 'late_entry' | 'correction'
  text: string
  reason?: string | null
  created_by_name: string
  created_by_role: string
  cosigned_by_name?: string | null
  cosigned_at?: string | null
  created_at: string
}

export interface ClinicalNotePDFInput {
  practice: PracticeInfo
  patient: PatientInfo
  provider: ProviderInfo
  appointment: {
    id: string
    date_of_service: string
    visit_type: string
    signed_at: string
    closed_at: string
  }
  soap: SOAPNotes
  addendums: AddendumEntry[]
  doctor_notes?: string
}

// ─── Constants ─────────────────────────────────────────────────
const PAGE_WIDTH = 612   // US Letter
const PAGE_HEIGHT = 792
const MARGIN_LEFT = 50
const MARGIN_RIGHT = 50
const MARGIN_TOP = 50
const MARGIN_BOTTOM = 60
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const LINE_HEIGHT = 14
const SECTION_GAP = 8

const COLORS = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.25, 0.25, 0.25),
  medGray: rgb(0.45, 0.45, 0.45),
  lightGray: rgb(0.7, 0.7, 0.7),
  headerBg: rgb(0.07, 0.47, 0.67),  // Medazon teal
  headerText: rgb(1, 1, 1),
  sectionBg: rgb(0.95, 0.97, 0.98),
  border: rgb(0.82, 0.85, 0.88),
  accent: rgb(0.07, 0.47, 0.67),
  red: rgb(0.8, 0.15, 0.15),
}

// ─── Helper: Word-wrap text to fit width ──────────────────────
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text || text.trim() === '') return ['']
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
  }
  return lines.length > 0 ? lines : ['']
}

// ─── Helper: Draw text and return new Y position ──────────────
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  color = COLORS.black
): number {
  page.drawText(text, { x, y, size: fontSize, font, color })
  return y - LINE_HEIGHT
}

// ─── Helper: Draw wrapped text block ──────────────────────────
function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  color = COLORS.darkGray
): number {
  const lines = wrapText(text, font, fontSize, maxWidth)
  let currentY = y
  for (const line of lines) {
    if (currentY < MARGIN_BOTTOM + 20) break  // Stop before footer
    if (line === '') {
      currentY -= LINE_HEIGHT * 0.5
      continue
    }
    page.drawText(line, { x, y: currentY, size: fontSize, font, color })
    currentY -= LINE_HEIGHT
  }
  return currentY
}

// ─── Helper: Check if we need a new page ──────────────────────
function needsNewPage(y: number, linesNeeded: number = 3): boolean {
  return y < MARGIN_BOTTOM + (linesNeeded * LINE_HEIGHT) + 20
}

// ─── Draw Letterhead ──────────────────────────────────────────
function drawLetterhead(page: PDFPage, practice: PracticeInfo, fontBold: PDFFont, fontRegular: PDFFont): number {
  let y = PAGE_HEIGHT - MARGIN_TOP

  // Header bar
  page.drawRectangle({
    x: MARGIN_LEFT - 10,
    y: y - 45,
    width: CONTENT_WIDTH + 20,
    height: 55,
    color: COLORS.headerBg,
  })

  // Practice name
  page.drawText(practice.name.toUpperCase(), {
    x: MARGIN_LEFT,
    y: y - 12,
    size: 16,
    font: fontBold,
    color: COLORS.headerText,
  })

  // Subtitle
  page.drawText(practice.subtitle, {
    x: MARGIN_LEFT,
    y: y - 28,
    size: 9,
    font: fontRegular,
    color: rgb(0.85, 0.92, 0.96),
  })

  // Right-aligned contact info
  const contactLines = [
    practice.address,
    `Tel: ${practice.phone} | Fax: ${practice.fax}`,
    `NPI: ${practice.npi}`,
  ]
  let contactY = y - 10
  for (const line of contactLines) {
    const textWidth = fontRegular.widthOfTextAtSize(line, 8)
    page.drawText(line, {
      x: PAGE_WIDTH - MARGIN_RIGHT - textWidth,
      y: contactY,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.92, 0.96),
    })
    contactY -= 11
  }

  // Divider line below header
  y -= 55
  page.drawLine({
    start: { x: MARGIN_LEFT - 10, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT + 10, y },
    thickness: 1,
    color: COLORS.border,
  })

  return y - 15
}

// ─── Draw Section Header ──────────────────────────────────────
function drawSectionHeader(
  page: PDFPage,
  title: string,
  y: number,
  fontBold: PDFFont
): number {
  // Background bar
  page.drawRectangle({
    x: MARGIN_LEFT - 5,
    y: y - 3,
    width: CONTENT_WIDTH + 10,
    height: 16,
    color: COLORS.sectionBg,
  })

  page.drawText(title.toUpperCase(), {
    x: MARGIN_LEFT,
    y: y,
    size: 9,
    font: fontBold,
    color: COLORS.accent,
  })

  return y - LINE_HEIGHT - 4
}

// ─── Draw Footer ──────────────────────────────────────────────
function drawFooter(page: PDFPage, pageNum: number, totalPages: number, fontRegular: PDFFont): void {
  const y = MARGIN_BOTTOM - 25

  // Divider
  page.drawLine({
    start: { x: MARGIN_LEFT, y: y + 12 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y + 12 },
    thickness: 0.5,
    color: COLORS.lightGray,
  })

  // Confidentiality notice
  const notice = 'CONFIDENTIALITY: This document contains PHI protected under HIPAA (45 CFR §164). Unauthorized disclosure is prohibited.'
  page.drawText(notice, {
    x: MARGIN_LEFT,
    y,
    size: 6,
    font: fontRegular,
    color: COLORS.lightGray,
  })

  // Page number
  const pageText = `Page ${pageNum} of ${totalPages}`
  const pageTextWidth = fontRegular.widthOfTextAtSize(pageText, 8)
  page.drawText(pageText, {
    x: PAGE_WIDTH - MARGIN_RIGHT - pageTextWidth,
    y,
    size: 8,
    font: fontRegular,
    color: COLORS.medGray,
  })
}

// ─── Draw Patient Info Box ────────────────────────────────────
function drawPatientInfoBox(
  page: PDFPage,
  patient: PatientInfo,
  appointment: ClinicalNotePDFInput['appointment'],
  y: number,
  fontBold: PDFFont,
  fontRegular: PDFFont
): number {
  const boxHeight = 65
  const boxY = y - boxHeight

  // Box border
  page.drawRectangle({
    x: MARGIN_LEFT - 5,
    y: boxY,
    width: CONTENT_WIDTH + 10,
    height: boxHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  })

  let textY = y - 12

  // Row 1: Name, DOB, Gender
  page.drawText('Patient:', { x: MARGIN_LEFT, y: textY, size: 8, font: fontBold, color: COLORS.medGray })
  page.drawText(patient.full_name, { x: MARGIN_LEFT + 42, y: textY, size: 10, font: fontBold, color: COLORS.black })
  page.drawText(`DOB: ${patient.date_of_birth}`, { x: MARGIN_LEFT + 260, y: textY, size: 9, font: fontRegular, color: COLORS.darkGray })
  if (patient.gender) {
    page.drawText(`Gender: ${patient.gender}`, { x: MARGIN_LEFT + 380, y: textY, size: 9, font: fontRegular, color: COLORS.darkGray })
  }
  textY -= 14

  // Row 2: Contact
  page.drawText(`Email: ${patient.email}`, { x: MARGIN_LEFT, y: textY, size: 8, font: fontRegular, color: COLORS.darkGray })
  page.drawText(`Phone: ${patient.phone}`, { x: MARGIN_LEFT + 260, y: textY, size: 8, font: fontRegular, color: COLORS.darkGray })
  textY -= 14

  // Row 3: Address + Visit Info
  page.drawText(`Address: ${patient.address}`, { x: MARGIN_LEFT, y: textY, size: 8, font: fontRegular, color: COLORS.darkGray })
  textY -= 14

  // Row 4: Visit details
  page.drawText(`Date of Service: ${appointment.date_of_service}`, { x: MARGIN_LEFT, y: textY, size: 8, font: fontRegular, color: COLORS.darkGray })
  page.drawText(`Visit Type: ${appointment.visit_type}`, { x: MARGIN_LEFT + 260, y: textY, size: 8, font: fontRegular, color: COLORS.darkGray })

  return boxY - SECTION_GAP
}

// ═══════════════════════════════════════════════════════════════
// MAIN: Generate Clinical Note PDF
// ═══════════════════════════════════════════════════════════════
export async function generateClinicalNotePDF(input: ClinicalNotePDFInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Clinical Note - ${input.patient.full_name} - ${input.appointment.date_of_service}`)
  doc.setAuthor(input.provider.full_name)
  doc.setSubject('Clinical Note - Telehealth Visit')
  doc.setCreator('Medazon Health EHR System')
  doc.setProducer('Medazon Health')

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  // ─── Collect all pages we'll need ────────────────────────────
  const pages: PDFPage[] = []
  let currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(currentPage)

  // Helper to add a new page when needed
  const addNewPage = (): PDFPage => {
    currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(currentPage)
    return currentPage
  }

  // Helper to check and add page if needed, returns { page, y }
  const ensureSpace = (y: number, linesNeeded: number = 4): { page: PDFPage; y: number } => {
    if (needsNewPage(y, linesNeeded)) {
      const newPage = addNewPage()
      const newY = drawLetterhead(newPage, input.practice, fontBold, fontRegular)
      return { page: newPage, y: newY }
    }
    return { page: currentPage, y }
  }

  // ─── PAGE 1: Clinical Note ──────────────────────────────────
  let y = drawLetterhead(currentPage, input.practice, fontBold, fontRegular)

  // Title
  y = drawText(currentPage, 'CLINICAL NOTE — TELEHEALTH VISIT', MARGIN_LEFT, y, fontBold, 13, COLORS.accent)
  y -= 8

  // Patient info box
  y = drawPatientInfoBox(currentPage, input.patient, input.appointment, y, fontBold, fontRegular)
  y -= 4

  // ─── SOAP Sections ──────────────────────────────────────────
  const soapSections: Array<{ title: string; key: keyof SOAPNotes }> = [
    { title: 'Chief Complaint', key: 'chief_complaint' },
    { title: 'History of Present Illness', key: 'history_present_illness' },
    { title: 'Review of Systems', key: 'review_of_systems' },
    { title: 'Past Medical History', key: 'past_medical_history' },
    { title: 'Current Medications', key: 'medications' },
    { title: 'Allergies', key: 'allergies' },
    { title: 'Physical Exam / Telehealth Assessment', key: 'physical_exam' },
    { title: 'Assessment', key: 'assessment' },
    { title: 'Plan', key: 'plan' },
    { title: 'Treatment', key: 'treatment' },
    { title: 'Pharmacy', key: 'pharmacy' },
    { title: 'Follow-Up Instructions', key: 'followup' },
  ]

  for (const section of soapSections) {
    const content = input.soap[section.key]
    if (!content || content.trim() === '') continue

    const lines = wrapText(content, fontRegular, 9, CONTENT_WIDTH - 10)
    const spaceNeeded = lines.length + 2

    const result = ensureSpace(y, spaceNeeded)
    currentPage = result.page
    y = result.y

    y = drawSectionHeader(currentPage, section.title, y, fontBold)
    y = drawWrappedText(currentPage, content, MARGIN_LEFT + 5, y, fontRegular, 9, CONTENT_WIDTH - 10, COLORS.darkGray)
    y -= SECTION_GAP
  }

  // ─── Doctor's Notes (if provided) ───────────────────────────
  if (input.doctor_notes && input.doctor_notes.trim()) {
    const result = ensureSpace(y, 5)
    currentPage = result.page
    y = result.y

    y = drawSectionHeader(currentPage, "Provider's Notes", y, fontBold)
    y = drawWrappedText(currentPage, input.doctor_notes, MARGIN_LEFT + 5, y, fontItalic, 9, CONTENT_WIDTH - 10, COLORS.darkGray)
    y -= SECTION_GAP
  }

  // ─── Signature Block ────────────────────────────────────────
  const sigResult = ensureSpace(y, 10)
  currentPage = sigResult.page
  y = sigResult.y

  // Divider before signature
  y -= 10
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 1,
    color: COLORS.accent,
  })
  y -= 18

  y = drawText(currentPage, 'Electronically signed by:', MARGIN_LEFT, y, fontItalic, 9, COLORS.medGray)
  y = drawText(currentPage, `${input.provider.full_name}, ${input.provider.credentials}`, MARGIN_LEFT, y, fontBold, 11, COLORS.black)
  y = drawText(currentPage, `${input.provider.email} | NPI: ${input.provider.npi}`, MARGIN_LEFT, y, fontRegular, 8, COLORS.darkGray)
  y = drawText(currentPage, `${input.provider.license_state} License: ${input.provider.license_number}`, MARGIN_LEFT, y, fontRegular, 8, COLORS.darkGray)
  y -= 8
  y = drawText(currentPage, `Signed: ${input.appointment.signed_at}`, MARGIN_LEFT, y, fontRegular, 8, COLORS.darkGray)
  y = drawText(currentPage, `Closed: ${input.appointment.closed_at}`, MARGIN_LEFT, y, fontRegular, 8, COLORS.darkGray)
  y -= 12

  // Legal notice
  y = drawText(currentPage, 'This document was generated by Medazon Health EHR System.', MARGIN_LEFT, y, fontItalic, 7, COLORS.medGray)
  y = drawText(currentPage, 'This is a legal medical record. Unauthorized alteration is prohibited.', MARGIN_LEFT, y, fontItalic, 7, COLORS.medGray)

  // ─── ADDENDUM PAGES ─────────────────────────────────────────
  if (input.addendums.length > 0) {
    const addendumPage = addNewPage()
    let addY = drawLetterhead(addendumPage, input.practice, fontBold, fontRegular)

    addY = drawText(addendumPage, 'ADDENDUM TO CLINICAL NOTE', MARGIN_LEFT, addY, fontBold, 13, COLORS.accent)
    addY -= 4
    addY = drawText(addendumPage, `Original Note Date: ${input.appointment.date_of_service}`, MARGIN_LEFT, addY, fontRegular, 9, COLORS.darkGray)
    addY = drawText(addendumPage, `Patient: ${input.patient.full_name} (DOB: ${input.patient.date_of_birth})`, MARGIN_LEFT, addY, fontRegular, 9, COLORS.darkGray)
    addY = drawText(addendumPage, `Appointment ID: ${input.appointment.id}`, MARGIN_LEFT, addY, fontRegular, 8, COLORS.lightGray)
    addY -= 12

    for (let i = 0; i < input.addendums.length; i++) {
      const addendum = input.addendums[i]

      // Check space — each addendum needs ~8+ lines
      const addLines = wrapText(addendum.text, fontRegular, 9, CONTENT_WIDTH - 20)
      if (needsNewPage(addY, addLines.length + 8)) {
        const newPage = addNewPage()
        addY = drawLetterhead(newPage, input.practice, fontBold, fontRegular)
        currentPage = newPage
      }

      // Addendum box
      const boxStartY = addY
      addY -= 4

      // Type label
      const typeLabel = addendum.addendum_type === 'correction'
        ? 'CORRECTION'
        : addendum.addendum_type === 'late_entry'
        ? 'LATE ENTRY'
        : 'ADDENDUM'

      const typeColor = addendum.addendum_type === 'correction' ? COLORS.red : COLORS.accent

      addY = drawText(currentPage || addendumPage, `${typeLabel} #${i + 1}`, MARGIN_LEFT + 10, addY, fontBold, 10, typeColor)
      
      const dateStr = new Date(addendum.created_at).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      })
      addY = drawText(currentPage || addendumPage, `Date: ${dateStr}`, MARGIN_LEFT + 10, addY, fontRegular, 8, COLORS.darkGray)
      addY = drawText(currentPage || addendumPage, `Author: ${addendum.created_by_name} (${addendum.created_by_role})`, MARGIN_LEFT + 10, addY, fontRegular, 8, COLORS.darkGray)
      
      if (addendum.addendum_type === 'correction' && addendum.reason) {
        addY = drawText(currentPage || addendumPage, `Reason: ${addendum.reason}`, MARGIN_LEFT + 10, addY, fontItalic, 8, COLORS.red)
      }
      addY -= 4

      // Addendum text
      addY = drawWrappedText(currentPage || addendumPage, addendum.text, MARGIN_LEFT + 10, addY, fontRegular, 9, CONTENT_WIDTH - 20, COLORS.darkGray)

      // Co-signature
      if (addendum.cosigned_by_name) {
        addY -= 4
        const cosignDate = addendum.cosigned_at
          ? new Date(addendum.cosigned_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : 'Pending'
        addY = drawText(currentPage || addendumPage, `Co-signed by: ${addendum.cosigned_by_name} on ${cosignDate}`, MARGIN_LEFT + 10, addY, fontItalic, 8, COLORS.accent)
      }

      // Box border
      const targetPage = currentPage || addendumPage
      targetPage.drawRectangle({
        x: MARGIN_LEFT,
        y: addY - 4,
        width: CONTENT_WIDTH,
        height: boxStartY - addY + 8,
        borderColor: addendum.addendum_type === 'correction' ? COLORS.red : COLORS.border,
        borderWidth: 1,
      })

      addY -= 16
    }
  }

  // ─── Add page footers ──────────────────────────────────────
  const totalPages = pages.length
  for (let i = 0; i < pages.length; i++) {
    drawFooter(pages[i], i + 1, totalPages, fontRegular)
  }

  // ─── Serialize ──────────────────────────────────────────────
  return doc.save()
}

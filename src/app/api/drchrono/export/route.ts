import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {

    const { data, type, patientName } = await req.json()

    if (!data || !type) {
      return NextResponse.json({ error: 'data and type required' }, { status: 400 })
    }

    // Dynamic import to keep bundle small
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Medazon Health'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(type.charAt(0).toUpperCase() + type.slice(1))

    // Header styling
    const headerFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1A30' } }
    const headerFont: any = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

    if (type === 'medications') {
      sheet.columns = [
        { header: 'Medication', key: 'name', width: 30 },
        { header: 'Dosage', key: 'dosage', width: 15 },
        { header: 'Frequency', key: 'frequency', width: 15 },
        { header: 'Route', key: 'route', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Date Prescribed', key: 'date_prescribed', width: 18 },
        { header: 'Refills', key: 'refills', width: 10 },
      ]
      data.forEach((m: any) => {
        sheet.addRow({
          name: m.name || '',
          dosage: `${m.dosage_quantity || ''} ${m.dosage_unit || ''}`.trim(),
          frequency: m.frequency || '',
          route: m.route || '',
          status: m.status || '',
          date_prescribed: m.date_prescribed || '',
          refills: m.number_refills ?? '',
        })
      })
    } else if (type === 'allergies') {
      sheet.columns = [
        { header: 'Allergen', key: 'reaction', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Notes', key: 'notes', width: 40 },
      ]
      data.forEach((a: any) => {
        sheet.addRow({ reaction: a.reaction || '', status: a.status || '', notes: a.notes || '' })
      })
    } else if (type === 'problems') {
      sheet.columns = [
        { header: 'Problem', key: 'name', width: 30 },
        { header: 'ICD Code', key: 'icd_code', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Date Diagnosed', key: 'date_diagnosis', width: 18 },
        { header: 'Notes', key: 'notes', width: 40 },
      ]
      data.forEach((p: any) => {
        sheet.addRow({ name: p.name || '', icd_code: p.icd_code || '', status: p.status || '', date_diagnosis: p.date_diagnosis || '', notes: p.notes || '' })
      })
    } else if (type === 'appointments') {
      sheet.columns = [
        { header: 'Date/Time', key: 'scheduled_time', width: 22 },
        { header: 'Duration', key: 'duration', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Reason', key: 'reason', width: 30 },
        { header: 'Notes', key: 'notes', width: 40 },
      ]
      data.forEach((a: any) => {
        sheet.addRow({ scheduled_time: a.scheduled_time || '', duration: a.duration ? `${a.duration} min` : '', status: a.status || '', reason: a.reason || '', notes: a.notes || '' })
      })
    }

    // Style header row
    const headerRow = sheet.getRow(1)
    headerRow.eachCell((cell: any) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })
    headerRow.height = 28

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="drchrono-${type}-${patientName || 'patient'}-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('[DrChrono Export] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

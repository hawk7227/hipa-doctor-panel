// Utility functions for timezone conversions
// Extracted from AppointmentDetailModal for better performance and reusability

export function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  const hour = parseInt(getValue('hour'))
  const minute = parseInt(getValue('minute'))
  const second = parseInt(getValue('second'))
  
  return new Date(year, month, day, hour, minute, second)
}

export function formatDateForDateTimeLocal(dateString: string, timezone: string): string {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = getValue('year')
  const month = getValue('month').padStart(2, '0')
  const day = getValue('day').padStart(2, '0')
  const hour = getValue('hour').padStart(2, '0')
  const minute = getValue('minute').padStart(2, '0')
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function convertDateTimeLocalToUTC(dateTimeLocal: string, timezone: string): string {
  const [datePart, timePart] = dateTimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  let baseUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  
  const monthNum = month
  const isLikelyDST = (monthNum >= 4 && monthNum <= 10) || 
                      (monthNum === 3 && day >= 8) || 
                      (monthNum === 11 && day <= 7)
  const estimatedOffsetHours = isLikelyDST ? 4 : 5
  
  baseUTC = new Date(baseUTC.getTime() + estimatedOffsetHours * 60 * 60 * 1000)
  
  for (let adjust = -3; adjust <= 3; adjust++) {
    const testUTC = new Date(baseUTC.getTime() + adjust * 60 * 60 * 1000)
    const formatted = formatter.format(testUTC)
    const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/)
    if (match) {
      const [, m, d, y, h, min] = match.map(Number)
      if (m === month && d === day && y === year && h === hour && min === minute) {
        return testUTC.toISOString()
      }
    }
  }
  
  for (let adjust = -12; adjust <= 12; adjust++) {
    const testUTC = new Date(baseUTC.getTime() + adjust * 60 * 60 * 1000)
    const formatted = formatter.format(testUTC)
    const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/)
    if (match) {
      const [, m, d, y, h, min] = match.map(Number)
      if (m === month && d === day && y === year && h === hour && min === minute) {
        return testUTC.toISOString()
      }
    }
  }
  
  return baseUTC.toISOString()
}


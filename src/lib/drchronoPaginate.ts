import { drchronoFetch } from '@/lib/drchrono'

// DrChrono API returns paginated results: { results: [...], next: "url" }
// This helper follows all pages automatically.

export interface PaginatedResult<T> {
  records: T[]
  totalFetched: number
}

export async function drchronoFetchAll<T = Record<string, unknown>>(
  endpoint: string,
  maxPages: number = 100
): Promise<PaginatedResult<T>> {
  const allRecords: T[] = []
  let nextUrl: string | null = endpoint
  let pageCount = 0

  while (nextUrl && pageCount < maxPages) {
    const result = await drchronoFetch(nextUrl)

    if (!result.ok) {
      console.error(`[DrChrono Paginate] Failed at page ${pageCount + 1}:`, result.status, result.data)
      break
    }

    const data = result.data
    const records: T[] = data.results || (Array.isArray(data) ? data : [data])
    allRecords.push(...records)

    nextUrl = data.next || null
    pageCount++

    // Rate limit protection: small delay between pages
    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return { records: allRecords, totalFetched: allRecords.length }
}

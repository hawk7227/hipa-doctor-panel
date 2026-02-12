import { NextRequest, NextResponse } from 'next/server'
import { drchronoFetch } from '@/lib/drchrono'

export async function GET(req: NextRequest) {
  const result = await drchronoFetch('users/current')

  if (!result.ok) {
    return NextResponse.json({ connected: false, error: result.data?.error || 'Not connected' }, { status: result.status })
  }

  return NextResponse.json({
    connected: true,
    doctor: {
      id: result.data.id,
      username: result.data.username,
      practice_group: result.data.practice_group,
    }
  })
}

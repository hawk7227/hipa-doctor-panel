import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — ROUTE PROTECTION MIDDLEWARE
// Ensures all /doctor/* routes require authentication
// ═══════════════════════════════════════════════════════════════

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /doctor/* routes
  if (!pathname.startsWith('/doctor')) {
    return NextResponse.next()
  }

  // Check for Supabase auth cookie
  // Supabase stores auth tokens in cookies named sb-*-auth-token
  const cookies = request.cookies
  const authCookie = cookies.getAll().find(c => c.name.includes('auth-token'))

  if (!authCookie) {
    // No auth cookie — redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Validate the cookie has a token (basic check — full validation in API routes)
  try {
    const parsed = JSON.parse(decodeURIComponent(authCookie.value))
    const token = parsed?.access_token || parsed?.[0]?.access_token
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  } catch {
    // Cookie exists but can't parse — might be valid raw token, let through
    // Full auth verification happens in AuthWrapper component
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/doctor/:path*'],
}

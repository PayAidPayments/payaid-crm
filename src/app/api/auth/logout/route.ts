import { NextRequest, NextResponse } from 'next/server'
import { clearTokenCookie } from '@payaid/oauth-client'

/**
 * POST /api/auth/logout
 * Logout endpoint for CRM module
 * 
 * Clears the authentication token and redirects to core logout
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Clear token cookie
  clearTokenCookie(response)
  
  // Redirect to core logout (optional)
  const coreLogoutUrl = process.env.CORE_AUTH_URL || 'https://payaid.io'
  const logoutUrl = new URL('/logout', coreLogoutUrl)
  logoutUrl.searchParams.set('redirect', request.headers.get('referer') || '/')
  
  return NextResponse.redirect(logoutUrl.toString())
}

/**
 * GET /api/auth/logout
 * Logout endpoint (GET method for convenience)
 */
export async function GET(request: NextRequest) {
  return POST(request)
}


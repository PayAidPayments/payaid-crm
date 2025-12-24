import { NextRequest, NextResponse } from 'next/server'
import { verifyRequestToken, redirectToAuth } from '@payaid/oauth-client'

/**
 * Next.js Middleware for CRM Module
 * 
 * Handles authentication for all routes in the CRM module.
 * Redirects to core OAuth2 provider if not authenticated.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip authentication for public routes
  const publicRoutes = [
    '/api/oauth/callback',
    '/login',
    '/_next',
    '/favicon.ico',
  ]

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check for authentication token
  const payload = verifyRequestToken(request)

  if (!payload) {
    // No token found - redirect to core for authentication
    const returnUrl = request.url
    return redirectToAuth(returnUrl)
  }

  // Check if CRM module is licensed
  const licensedModules = payload.licensedModules || []
  if (!licensedModules.includes('crm')) {
    // Module not licensed - redirect to upgrade page or show error
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'CRM module not licensed for this tenant' },
        { status: 403 }
      )
    }
    
    // For frontend routes, redirect to upgrade page
    return NextResponse.redirect(new URL('/upgrade?module=crm', request.url))
  }

  // Token valid and module licensed - allow request
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
}


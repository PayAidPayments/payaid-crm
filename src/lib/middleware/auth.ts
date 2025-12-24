/**
 * CRM Module - Authentication Middleware
 * 
 * Wrapper around @payaid/oauth-client middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, optionalAuth, AuthMiddlewareResult } from '@payaid/oauth-client'

/**
 * Require authentication for CRM module routes
 * Redirects to core login if not authenticated
 */
export function requireCRMAuth(
  request: NextRequest,
  returnUrl?: string
): AuthMiddlewareResult {
  return requireAuth(request, returnUrl)
}

/**
 * Optional authentication for CRM module routes
 * Returns auth status without redirecting
 */
export function optionalCRMAuth(request: NextRequest): AuthMiddlewareResult {
  return optionalAuth(request)
}

/**
 * Check if user has CRM module access
 */
export function requireCRMAccess(request: NextRequest): {
  authenticated: boolean
  payload: any
  response: NextResponse | null
} {
  const auth = requireCRMAuth(request)
  
  if (!auth.authenticated) {
    return auth
  }

  // Check if CRM module is licensed
  const licensedModules = auth.payload?.licensedModules || []
  if (!licensedModules.includes('crm')) {
    return {
      authenticated: false,
      payload: null,
      response: NextResponse.json(
        { error: 'CRM module not licensed for this tenant' },
        { status: 403 }
      ),
    }
  }

  return auth
}


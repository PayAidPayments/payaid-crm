import { NextRequest, NextResponse } from 'next/server'
import { redirectToAuth, exchangeCodeForTokens, setTokenCookie, setRefreshTokenCookie } from '@payaid/oauth-client'

/**
 * GET /api/oauth/callback
 * OAuth2 Callback Endpoint for CRM Module
 * 
 * Handles the OAuth2 callback from the core module.
 * Exchanges the authorization code for an access token.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      const errorDescription = searchParams.get('error_description') || 'Authentication failed'
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url)
      )
    }

    // Validate authorization code
    if (!code) {
      // No code provided, redirect to auth
      const returnUrl = new URL('/api/oauth/callback', request.url).toString()
      return redirectToAuth(returnUrl)
    }

    // Exchange code for tokens
    const redirectUri = new URL('/api/oauth/callback', request.url).toString()
    let tokens: { access_token: string; refresh_token?: string }

    try {
      tokens = await exchangeCodeForTokens(code, redirectUri)
    } catch (error) {
      console.error('Token exchange error:', error)
      return NextResponse.redirect(
        new URL('/login?error=token_exchange_failed', request.url)
      )
    }

    // Create response and set token cookies
    const response = NextResponse.redirect(new URL('/', request.url))
    setTokenCookie(response, tokens.access_token)
    if (tokens.refresh_token) {
      setRefreshTokenCookie(response, tokens.refresh_token)
    }

    // Redirect to original destination or home
    const returnTo = state ? decodeURIComponent(state) : '/'
    return NextResponse.redirect(new URL(returnTo, request.url))
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=authentication_failed', request.url)
    )
  }
}


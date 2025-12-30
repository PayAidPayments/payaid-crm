import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// GET /api/social-media/accounts - List all connected social media accounts
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const accounts = await prisma.socialMediaAccount.findMany({
      where: {
        tenantId: tenantId,
        isConnected: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Don't return sensitive tokens
    const safeAccounts = accounts.map(account => ({
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountId: account.accountId,
      isConnected: account.isConnected,
      followerCount: account.followerCount,
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }))

    return NextResponse.json({ accounts: safeAccounts })
  } catch (error) {
    console.error('Get social media accounts error:', error)
    return NextResponse.json(
      { error: 'Failed to get social media accounts' },
      { status: 500 }
    )
  }
}

// POST /api/social-media/accounts - Connect a social media account (OAuth callback)
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const { platform, accountName, accountId, accessToken, refreshToken, expiresAt } = body

    if (!platform || !accessToken) {
      return NextResponse.json(
        { error: 'Platform and access token are required' },
        { status: 400 }
      )
    }

    // Upsert account connection
    const account = await prisma.socialMediaAccount.upsert({
      where: {
        tenantId_platform_accountId: {
          tenantId: tenantId,
          platform,
          accountId: accountId || platform,
        },
      },
      update: {
        accessToken, // In production, encrypt this
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isConnected: true,
        lastSyncAt: new Date(),
      },
      create: {
        tenantId: tenantId,
        platform,
        accountName: accountName || `${platform} Account`,
        accountId: accountId || platform,
        accessToken, // In production, encrypt this
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isConnected: true,
        lastSyncAt: new Date(),
      },
    })

    // Don't return sensitive tokens
    const safeAccount = {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountId: account.accountId,
      isConnected: account.isConnected,
      followerCount: account.followerCount,
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }

    return NextResponse.json(safeAccount, { status: 201 })
  } catch (error) {
    console.error('Connect social media account error:', error)
    return NextResponse.json(
      { error: 'Failed to connect social media account' },
      { status: 500 }
    )
  }
}

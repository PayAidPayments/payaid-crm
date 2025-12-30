import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// GET /api/social-media/scheduled - List all scheduled posts
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get('platform')
    const accountId = searchParams.get('accountId')

    const where: any = {
      tenantId: tenantId,
      status: 'SCHEDULED',
    }

    if (platform) where.platform = platform
    if (accountId) where.accountId = accountId

    const scheduledPosts = await prisma.scheduledPost.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            platform: true,
            accountName: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return NextResponse.json({ scheduledPosts })
  } catch (error) {
    console.error('Get scheduled posts error:', error)
    return NextResponse.json(
      { error: 'Failed to get scheduled posts' },
      { status: 500 }
    )
  }
}

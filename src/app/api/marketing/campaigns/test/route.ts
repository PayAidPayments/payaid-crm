import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// GET /api/marketing/campaigns/test - Test campaign database access
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (marketing campaigns are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    // Test if Campaign model exists in Prisma client
    const hasCampaignModel = 'campaign' in prisma
    
    // Try to query the database directly
    let tableExists = false
    let rowCount = 0
    let error: string | null = null
    
    try {
      // Use raw query to check table
      const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Campaign" WHERE "tenantId" = ${tenantId}`
      tableExists = true
      rowCount = (result as any)[0]?.count || 0
    } catch (dbError) {
      error = dbError instanceof Error ? dbError.message : String(dbError)
    }

    // Try Prisma model access
    let prismaModelWorks = false
    let prismaError: string | null = null
    
    try {
      await prisma.campaign.findFirst({
        where: { tenantId: tenantId },
        take: 1,
      })
      prismaModelWorks = true
    } catch (prismaErr) {
      prismaError = prismaErr instanceof Error ? prismaErr.message : String(prismaErr)
    }

    return NextResponse.json({
      hasCampaignModel,
      tableExists,
      rowCount,
      prismaModelWorks,
      error,
      prismaError,
      tenantId: tenantId,
      recommendation: !hasCampaignModel || !prismaModelWorks 
        ? 'Run: npx prisma generate (then restart dev server)'
        : 'Database connection is working',
    })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

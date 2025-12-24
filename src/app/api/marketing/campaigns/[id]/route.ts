import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// GET /api/marketing/campaigns/[id] - Get a single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (marketing campaigns are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Format analytics
    const analytics = campaign.status === 'sent' && campaign.sent > 0 ? {
      sent: campaign.sent,
      delivered: campaign.delivered,
      opened: campaign.opened,
      clicked: campaign.clicked,
      bounced: campaign.bounced,
      unsubscribed: campaign.unsubscribed,
      openRate: campaign.delivered > 0 ? (campaign.opened / campaign.delivered) * 100 : 0,
      clickRate: campaign.delivered > 0 ? (campaign.clicked / campaign.delivered) * 100 : 0,
      clickThroughRate: campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0,
    } : null

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      subject: campaign.subject,
      content: campaign.content,
      recipientCount: campaign.recipientCount,
      contactIds: campaign.contactIds,
      createdAt: campaign.createdAt.toISOString(),
      sentAt: campaign.sentAt?.toISOString(),
      scheduledFor: campaign.scheduledFor?.toISOString(),
      analytics,
    })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get campaign error:', error)
    return NextResponse.json(
      { error: 'Failed to get campaign' },
      { status: 500 }
    )
  }
}

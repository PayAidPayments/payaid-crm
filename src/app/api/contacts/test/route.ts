import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

/**
 * GET /api/contacts/test - Test endpoint to verify database connection and basic query
 */
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    // Test 1: Basic database connection
    let connectionTest
    try {
      await prisma.$queryRaw`SELECT 1`
      connectionTest = { status: 'success', message: 'Database connection OK' }
    } catch (error: any) {
      connectionTest = { 
        status: 'failed', 
        message: error?.message || 'Database connection failed',
        code: error?.code,
      }
    }

    // Test 2: Simple contact count
    let countTest
    try {
      const count = await prisma.contact.count({
        where: { tenantId: tenantId },
      })
      countTest = { status: 'success', count }
    } catch (error: any) {
      countTest = { 
        status: 'failed', 
        message: error?.message || 'Count query failed',
        code: error?.code,
        meta: error?.meta,
      }
    }

    // Test 3: Simple contact query (minimal fields)
    let queryTest
    try {
      const contacts = await prisma.contact.findMany({
        where: { tenantId: tenantId },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
      queryTest = { status: 'success', count: contacts.length, sample: contacts[0] || null }
    } catch (error: any) {
      queryTest = { 
        status: 'failed', 
        message: error?.message || 'Query failed',
        code: error?.code,
        meta: error?.meta,
      }
    }

    // Test 4: Full contact query with all fields
    let fullQueryTest
    try {
      const contacts = await prisma.contact.findMany({
        where: { tenantId: tenantId },
        take: 1,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          type: true,
          status: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          gstin: true,
          createdAt: true,
          lastContactedAt: true,
          leadScore: true,
          scoreUpdatedAt: true,
        },
      })
      fullQueryTest = { status: 'success', count: contacts.length }
    } catch (error: any) {
      fullQueryTest = { 
        status: 'failed', 
        message: error?.message || 'Full query failed',
        code: error?.code,
        meta: error?.meta,
      }
    }

    // Test 5: _count query
    let countQueryTest
    try {
      const contacts = await prisma.contact.findMany({
        where: { tenantId: tenantId },
        take: 1,
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              interactions: true,
              deals: true,
              tasks: true,
            },
          },
        },
      })
      countQueryTest = { status: 'success', count: contacts.length }
    } catch (error: any) {
      countQueryTest = { 
        status: 'failed', 
        message: error?.message || '_count query failed',
        code: error?.code,
        meta: error?.meta,
      }
    }

    return NextResponse.json({
      tenantId: tenantId,
      tests: {
        connection: connectionTest,
        count: countTest,
        simpleQuery: queryTest,
        fullQuery: fullQueryTest,
        countQuery: countQueryTest,
      },
    })
  } catch (error: any) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      {
        error: 'Test endpoint failed',
        message: error?.message || 'Unknown error',
        code: error?.code,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}



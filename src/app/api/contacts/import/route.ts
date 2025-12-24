import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { checkTenantLimits } from '@/lib/middleware/tenant'
import { prisma } from '@payaid/db'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

const contactRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  type: z.enum(['customer', 'lead', 'vendor', 'employee']).optional(),
  status: z.enum(['active', 'inactive', 'lost']).optional(),
  source: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  tags: z.string().optional().or(z.literal('')), // Comma-separated tags
  notes: z.string().optional().or(z.literal('')),
})

// POST /api/contacts/import - Import contacts from CSV/XLSX file
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const formData = await request.formData()
    const file = formData.get('file') as File
    const segmentIds = formData.get('segmentIds') as string | null
    const tags = formData.get('tags') as string | null // Additional tags to add

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Parse segment IDs
    const segmentIdArray = segmentIds ? segmentIds.split(',').filter(Boolean) : []
    
    // Parse additional tags
    const additionalTags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

    // Get segment names for tagging
    let segmentNames: string[] = []
    if (segmentIdArray.length > 0) {
      const segments = await prisma.segment.findMany({
        where: {
          id: { in: segmentIdArray },
          tenantId: tenantId,
        },
        select: { name: true },
      })
      segmentNames = segments.map(s => s.name)
    }

    // Read file based on extension
    const fileName = file.name.toLowerCase()
    let rows: any[] = []

    if (fileName.endsWith('.csv')) {
      // Parse CSV
      const text = await file.text()
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      })
      rows = result.data as any[]
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse XLSX
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      }) as any[]
      
      // Normalize headers (lowercase, trim)
      rows = rows.map((row: any) => {
        const normalized: any = {}
        for (const key in row) {
          normalized[key.trim().toLowerCase()] = row[key]
        }
        return normalized
      })
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload CSV or XLSX file.' },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or has no valid data' },
        { status: 400 }
      )
    }

    // Validate and process rows
    const contactsToCreate: any[] = []
    const errors: string[] = []
    const skipped: number[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Normalize the row data
        const normalizedRow: any = {
          name: row.name || row['contact name'] || row['full name'] || '',
          email: row.email || row['email address'] || '',
          phone: row.phone || row['phone number'] || row.mobile || row['mobile number'] || '',
          company: row.company || row['company name'] || row.organization || '',
          type: row.type || row['contact type'] || 'lead',
          status: row.status || row['contact status'] || 'active',
          source: row.source || row['lead source'] || '',
          address: row.address || row['street address'] || '',
          city: row.city || '',
          state: row.state || row['state/province'] || '',
          postalCode: row.postalcode || row['postal code'] || row.zip || row['zip code'] || '',
          country: row.country || 'India',
          tags: [],
          notes: row.notes || row.note || row.comments || '',
        }

        // Parse tags from row (comma-separated)
        if (row.tags || row.tag) {
          const rowTags = (row.tags || row.tag || '').toString().split(',').map((t: string) => t.trim()).filter(Boolean)
          normalizedRow.tags = [...rowTags, ...segmentNames, ...additionalTags]
        } else {
          normalizedRow.tags = [...segmentNames, ...additionalTags]
        }

        // Validate row
        const validated = contactRowSchema.parse(normalizedRow)

        // Check for duplicate email (if provided)
        if (validated.email) {
          const existing = await prisma.contact.findFirst({
            where: {
              tenantId: tenantId,
              email: validated.email,
            },
          })

          if (existing) {
            skipped.push(rowNumber)
            continue
          }
        }

        contactsToCreate.push({
          ...validated,
          tenantId: tenantId,
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Row ${rowNumber}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`)
        } else {
          errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Check tenant limits
    const canCreate = await checkTenantLimits(tenantId, 'contacts', contactsToCreate.length)
    if (!canCreate) {
      return NextResponse.json(
        {
          error: 'Contact limit would be exceeded. Please upgrade your plan.',
          imported: 0,
          skipped: skipped.length,
          errors: errors.length,
        },
        { status: 403 }
      )
    }

    // Create contacts in batches
    let imported = 0
    const batchSize = 50

    for (let i = 0; i < contactsToCreate.length; i += batchSize) {
      const batch = contactsToCreate.slice(i, i + batchSize)
      await prisma.contact.createMany({
        data: batch,
        skipDuplicates: true,
      })
      imported += batch.length
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped: skipped.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10), // Return first 10 errors
      totalRows: rows.length,
    })
  } catch (error) {
    console.error('Import contacts error:', error)
    return NextResponse.json(
      {
        error: 'Failed to import contacts',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

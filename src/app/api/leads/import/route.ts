import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

const leadRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
  value: z.number().optional(),
  notes: z.string().optional().or(z.literal('')),
})

// POST /api/leads/import - Bulk import leads from CSV/XLSX
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const formData = await request.formData()
    const file = formData.get('file') as File
    const sourceId = formData.get('sourceId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file
    const fileName = file.name.toLowerCase()
    let rows: any[] = []

    if (fileName.endsWith('.csv')) {
      const text = await file.text()
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      })
      rows = result.data as any[]
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      }) as any[]

      // Normalize headers
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

    // Get or create lead source
    let leadSourceId = sourceId
    if (!leadSourceId) {
      const defaultSource = await prisma.leadSource.findFirst({
        where: {
          tenantId: tenantId,
          name: 'Bulk Import',
        },
      })

      if (defaultSource) {
        leadSourceId = defaultSource.id
      } else {
        const newSource = await prisma.leadSource.create({
          data: {
            name: 'Bulk Import',
            tenantId: tenantId,
          },
        })
        leadSourceId = newSource.id
      }
    }

    // Validate and process rows
    const leadsToCreate: any[] = []
    const errors: Array<{ row: number; error: string }> = []
    const skipped: number[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const validated = leadRowSchema.parse({
          name: row.name || row['full name'] || row['contact name'] || 'Unknown',
          email: row.email || '',
          phone: row.phone || row.mobile || '',
          company: row.company || row['company name'] || '',
          source: row.source || '',
          value: row.value || row.amount || row['deal value'] || undefined,
          notes: row.notes || row.description || '',
        })

        // Check for duplicates (by email or phone)
        if (validated.email || validated.phone) {
          const existing = await prisma.contact.findFirst({
            where: {
              tenantId: tenantId,
              OR: [
                validated.email ? { email: validated.email } : {},
                validated.phone ? { phone: validated.phone } : {},
              ],
            },
          })

          if (existing) {
            skipped.push(i + 1)
            continue
          }
        }

        leadsToCreate.push({
          name: validated.name,
          email: validated.email || null,
          phone: validated.phone || null,
          company: validated.company || null,
          type: 'lead',
          status: 'active',
          source: validated.source || 'Bulk Import',
          notes: validated.notes || null,
          tenantId: tenantId,
          // Create deal if value provided
          deals: validated.value
            ? {
                create: {
                  title: `Deal for ${validated.name}`,
                  valueInr: validated.value,
                  stage: 'prospecting',
                  probability: 10,
                  tenantId: tenantId,
                  leadSourceId,
                },
              }
            : undefined,
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({
            row: i + 1,
            error: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          })
        } else {
          errors.push({ row: i + 1, error: 'Unknown error' })
        }
      }
    }

    // Create leads in batches
    const created = []
    for (const leadData of leadsToCreate) {
      try {
        const { deals, ...contactData } = leadData
        const contact = await prisma.contact.create({
          data: {
            ...contactData,
            deals: deals,
          },
          include: {
            deals: true,
          },
        })
        created.push(contact)
      } catch (error: any) {
        errors.push({
          row: leadsToCreate.indexOf(leadData) + 1,
          error: error.message || 'Failed to create lead',
        })
      }
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      skipped: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      totalRows: rows.length,
    })
  } catch (error) {
    console.error('Bulk import leads error:', error)
    return NextResponse.json(
      { error: 'Failed to import leads' },
      { status: 500 }
    )
  }
}

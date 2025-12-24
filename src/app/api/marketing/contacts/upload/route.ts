import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// POST /api/marketing/contacts/upload - Upload and parse CSV file
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (marketing contacts are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()
    
    // Parse CSV
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have at least a header row and one data row' },
        { status: 400 }
      )
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const emailIndex = header.findIndex(h => h.includes('email'))
    const nameIndex = header.findIndex(h => h.includes('name'))
    const phoneIndex = header.findIndex(h => h.includes('phone') || h.includes('mobile'))

    if (emailIndex === -1 && phoneIndex === -1) {
      return NextResponse.json(
        { error: 'CSV must contain either email or phone column' },
        { status: 400 }
      )
    }

    // Parse rows
    const contacts: Array<{ email?: string; phone?: string; name?: string }> = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      
      const email = emailIndex >= 0 ? values[emailIndex] : undefined
      const phone = phoneIndex >= 0 ? values[phoneIndex] : undefined
      const name = nameIndex >= 0 ? values[nameIndex] : undefined

      if (!email && !phone) {
        errors.push(`Row ${i + 1}: Missing email and phone`)
        continue
      }

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Row ${i + 1}: Invalid email format: ${email}`)
        continue
      }

      contacts.push({ email, phone, name: name || email || phone || 'Unknown' })
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found in the file' },
        { status: 400 }
      )
    }

    // Find or create contacts
    const contactIds: string[] = []
    const skipped: string[] = []

    for (const contactData of contacts) {
      try {
        // Check if contact exists
        let contact = null
        
        if (contactData.email) {
          contact = await prisma.contact.findFirst({
            where: {
              tenantId: tenantId,
              email: contactData.email,
            },
          })
        } else if (contactData.phone) {
          contact = await prisma.contact.findFirst({
            where: {
              tenantId: tenantId,
              phone: contactData.phone,
            },
          })
        }

        if (contact) {
          contactIds.push(contact.id)
        } else {
          // Create new contact
          const newContact = await prisma.contact.create({
            data: {
              tenantId: tenantId,
              name: contactData.name || 'Unknown',
              email: contactData.email || null,
              phone: contactData.phone || null,
              type: 'lead',
              status: 'active',
            },
          })
          contactIds.push(newContact.id)
        }
      } catch (error) {
        skipped.push(contactData.email || contactData.phone || 'Unknown')
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: contacts.length,
      contactsAdded: contactIds.length,
      contactIds,
      errors: errors.length > 0 ? errors : undefined,
      skipped: skipped.length > 0 ? skipped : undefined,
    })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Upload contacts error:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}

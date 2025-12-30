import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  dueDate: z.string().datetime().optional(),
  contactId: z.string().optional(),
  assignedToId: z.string().optional(),
})

// GET /api/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (tasks are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json(
      { error: 'Failed to get task' },
      { status: 500 }
    )
  }
}

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (tasks are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = updateTaskSchema.parse(body)

    // Check if task exists and belongs to tenant
    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (validated.title) updateData.title = validated.title
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.priority) updateData.priority = validated.priority
    if (validated.status) {
      updateData.status = validated.status
      if (validated.status === 'completed') {
        updateData.completedAt = new Date()
      }
    }
    if (validated.dueDate) {
      updateData.dueDate = new Date(validated.dueDate)
    }
    if (validated.contactId) updateData.contactId = validated.contactId
    if (validated.assignedToId) updateData.assignedToId = validated.assignedToId

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update task error:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (tasks are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    // Check if task exists and belongs to tenant
    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    await prisma.task.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Delete task error:', error)
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}


'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTask, useUpdateTask, useDeleteTask } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export default function TaskDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { data: task, isLoading } = useTask(id)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id, data: { status: newStatus } })
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update task')
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask.mutateAsync(id)
        router.push('/dashboard/tasks')
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete task')
      }
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Task not found</p>
        <Link href="/dashboard/tasks">
          <Button>Back to Tasks</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
          <p className="mt-2 text-gray-600">
            {task.status === 'completed' ? 'Completed' : 'Active Task'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/tasks">
            <Button variant="outline">Back</Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Description</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{task.description}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Priority</div>
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                    task.priority === 'high' ? 'bg-red-100 text-red-800' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.priority}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    task.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                {task.dueDate && (
                  <div>
                    <div className="text-sm text-gray-500">Due Date</div>
                    <div className="font-medium">
                      {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                    </div>
                  </div>
                )}
                {task.completedAt && (
                  <div>
                    <div className="text-sm text-gray-500">Completed At</div>
                    <div className="font-medium">
                      {format(new Date(task.completedAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {task.status !== 'completed' && (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange('completed')}
                  disabled={updateTask.isPending}
                >
                  Mark as Completed
                </Button>
              )}
              {task.status === 'pending' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={updateTask.isPending}
                >
                  Start Task
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusChange('pending')}
                  disabled={updateTask.isPending}
                >
                  Mark as Pending
                </Button>
              )}
            </CardContent>
          </Card>

          {task.contact && (
            <Card>
              <CardHeader>
                <CardTitle>Related Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/contacts/${task.contact.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {task.contact.name}
                </Link>
              </CardContent>
            </Card>
          )}

          {task.assignedTo && (
            <Card>
              <CardHeader>
                <CardTitle>Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium">{task.assignedTo.name}</div>
                {task.assignedTo.email && (
                  <div className="text-sm text-gray-500">{task.assignedTo.email}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

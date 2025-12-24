'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewEventPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: 'Asia/Kolkata',
    locationType: 'PHYSICAL' as 'PHYSICAL' | 'VIRTUAL' | 'HYBRID',
    address: '',
    city: '',
    state: '',
    virtualUrl: '',
    registrationEnabled: true,
    maxAttendees: '',
    registrationDeadline: '',
    priceInr: '',
    streamingEnabled: false,
    streamingUrl: '',
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          description: data.description || undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          virtualUrl: data.virtualUrl || undefined,
          maxAttendees: data.maxAttendees ? parseInt(data.maxAttendees) : undefined,
          registrationDeadline: data.registrationDeadline || undefined,
          priceInr: data.priceInr ? parseFloat(data.priceInr) : undefined,
          streamingUrl: data.streamingUrl || undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create event')
      }
      return response.json()
    },
    onSuccess: (data) => {
      router.push(`/dashboard/events/${data.id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    createMutation.mutate(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Event</h1>
          <p className="mt-2 text-gray-600">Create a new event</p>
        </div>
        <Link href="/dashboard/events">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Enter your event information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="title" className="text-sm font-medium text-gray-700">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Annual Conference 2025"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium text-gray-700">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <Input
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  required
                  placeholder="annual-conference-2025"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="locationType" className="text-sm font-medium text-gray-700">
                  Location Type
                </label>
                <select
                  id="locationType"
                  name="locationType"
                  value={formData.locationType}
                  onChange={(e) => setFormData({ ...formData, locationType: e.target.value as any })}
                  className="w-full h-10 rounded-md border border-gray-300 px-3"
                >
                  <option value="PHYSICAL">Physical</option>
                  <option value="VIRTUAL">Virtual</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="startDate" className="text-sm font-medium text-gray-700">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="endDate" className="text-sm font-medium text-gray-700">
                  End Date & Time <span className="text-red-500">*</span>
                </label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>

              {formData.locationType !== 'VIRTUAL' && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="address" className="text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="city" className="text-sm font-medium text-gray-700">
                      City
                    </label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="state" className="text-sm font-medium text-gray-700">
                      State
                    </label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                </>
              )}

              {(formData.locationType === 'VIRTUAL' || formData.locationType === 'HYBRID') && (
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="virtualUrl" className="text-sm font-medium text-gray-700">
                    Virtual URL
                  </label>
                  <Input
                    id="virtualUrl"
                    name="virtualUrl"
                    type="url"
                    value={formData.virtualUrl}
                    onChange={(e) => setFormData({ ...formData, virtualUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Event description..."
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.registrationEnabled}
                    onChange={(e) => setFormData({ ...formData, registrationEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Registration</span>
                </label>
              </div>

              {formData.registrationEnabled && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="maxAttendees" className="text-sm font-medium text-gray-700">
                      Max Attendees
                    </label>
                    <Input
                      id="maxAttendees"
                      name="maxAttendees"
                      type="number"
                      value={formData.maxAttendees}
                      onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="registrationDeadline" className="text-sm font-medium text-gray-700">
                      Registration Deadline
                    </label>
                    <Input
                      id="registrationDeadline"
                      name="registrationDeadline"
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="priceInr" className="text-sm font-medium text-gray-700">
                      Price (₹)
                    </label>
                    <Input
                      id="priceInr"
                      name="priceInr"
                      type="number"
                      step="0.01"
                      value={formData.priceInr}
                      onChange={(e) => setFormData({ ...formData, priceInr: e.target.value })}
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.streamingEnabled}
                    onChange={(e) => setFormData({ ...formData, streamingEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Streaming</span>
                </label>
              </div>

              {formData.streamingEnabled && (
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="streamingUrl" className="text-sm font-medium text-gray-700">
                    Streaming URL
                  </label>
                  <Input
                    id="streamingUrl"
                    name="streamingUrl"
                    type="url"
                    value={formData.streamingUrl}
                    onChange={(e) => setFormData({ ...formData, streamingUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/dashboard/events">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

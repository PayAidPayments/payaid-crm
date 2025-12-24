'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface EventRegistration {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  status: string
  registeredAt: string
}

interface Event {
  id: string
  title: string
  slug: string
  description?: string
  startDate: string
  endDate: string
  locationType: string
  address?: string
  city?: string
  state?: string
  virtualUrl?: string
  registrationEnabled: boolean
  maxAttendees?: number
  priceInr?: number
  status: string
  registrations: EventRegistration[]
  _count: {
    registrations: number
  }
}

export default function EventDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await fetch(`/api/events/${id}`)
      if (!response.ok) throw new Error('Failed to fetch event')
      return response.json()
    },
  })

  if (isLoading || !event) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          <p className="mt-2 text-gray-600">
            {format(new Date(event.startDate), 'PPp')} - {format(new Date(event.endDate), 'PPp')}
          </p>
        </div>
        <Link href="/dashboard/events">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  event.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                  event.status === 'LIVE' ? 'bg-blue-100 text-blue-800' :
                  event.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {event.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Location Type</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{event.locationType.toLowerCase()}</dd>
            </div>
            {event.address && (
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {event.address}
                  {event.city && `, ${event.city}`}
                  {event.state && `, ${event.state}`}
                </dd>
              </div>
            )}
            {event.virtualUrl && (
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Virtual URL</dt>
                <dd className="mt-1">
                  <a href={event.virtualUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {event.virtualUrl}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Registrations</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {event._count.registrations}
                {event.maxAttendees && ` / ${event.maxAttendees}`}
              </dd>
            </div>
            {event.priceInr && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Price</dt>
                <dd className="mt-1 text-sm text-gray-900">₹{Number(event.priceInr).toLocaleString('en-IN')}</dd>
              </div>
            )}
            {event.description && (
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{event.description}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {event.registrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations ({event.registrations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {event.registrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{reg.name}</div>
                    <div className="text-sm text-gray-500">{reg.email}</div>
                    {reg.company && <div className="text-sm text-gray-500">{reg.company}</div>}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      reg.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                      reg.status === 'ATTENDED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {reg.status}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(reg.registeredAt), 'PPp')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link href={`/dashboard/events/${id}/registrations`}>
              <Button variant="outline" className="w-full mt-4">
                View All Registrations
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { ModuleGate } from '@/components/modules/ModuleGate'
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

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
  _count: {
    registrations: number
  }
}

function EventsPage() {
  const [upcomingOnly, setUpcomingOnly] = useState(true)

  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ['events', upcomingOnly],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (upcomingOnly) params.append('upcoming', 'true')

      const response = await fetch(`/api/events?${params}`)
      if (!response.ok) throw new Error('Failed to fetch events')
      return response.json()
    },
  })

  const events = data?.events || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="mt-2 text-gray-600">Manage events, registrations, and virtual streaming</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={upcomingOnly ? 'default' : 'outline'}
            onClick={() => setUpcomingOnly(true)}
          >
            Upcoming
          </Button>
          <Button
            variant={!upcomingOnly ? 'default' : 'outline'}
            onClick={() => setUpcomingOnly(false)}
          >
            All Events
          </Button>
          <Link href="/dashboard/events/new">
            <Button>Create Event</Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">Loading...</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No events found</p>
              <Link href="/dashboard/events/new">
                <Button>Create Your First Event</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.title}</CardTitle>
                <CardDescription>
                  {format(new Date(event.startDate), 'PPp')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Location:</span>
                    <span className="capitalize">{event.locationType.toLowerCase()}</span>
                  </div>
                  {event.address && (
                    <div className="text-sm text-gray-600">{event.address}</div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Registrations:</span>
                    <span className="font-semibold">
                      {event._count.registrations}
                      {event.maxAttendees && ` / ${event.maxAttendees}`}
                    </span>
                  </div>
                  {event.priceInr && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-semibold">₹{Number(event.priceInr).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      event.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                      event.status === 'LIVE' ? 'bg-blue-100 text-blue-800' :
                      event.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      View
                    </Button>
                  </Link>
                  <Link href={`/dashboard/events/${event.id}/registrations`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Registrations
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


export default function Page() {
  return (
    <ModuleGate module="crm">
      <EventsPage />
    </ModuleGate>
  )
}

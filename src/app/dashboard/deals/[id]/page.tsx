'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useDeal, useUpdateDeal } from '@/lib/hooks/use-api'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export default function DealDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: deal, isLoading } = useDeal(id)
  const updateDeal = useUpdateDeal()

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Deal not found</p>
        <Link href="/dashboard/deals">
          <Button>Back to Deals</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{deal.name}</h1>
          <p className="mt-2 text-gray-600">
            {deal.contact?.name || 'No contact'}
          </p>
        </div>
        <div className="flex gap-2">
          {deal.contact && (
            <Link href={`/dashboard/invoices/new?customerId=${deal.contact.id}`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                🧾 Create Invoice
              </Button>
            </Link>
          )}
          <Link href="/dashboard/deals">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/dashboard/deals/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Deal Value</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ₹{deal.value.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Probability</div>
                  <div className="text-2xl font-bold">{deal.probability}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Stage</div>
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 capitalize">
                    {deal.stage}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Expected Value</div>
                  <div className="text-lg font-semibold">
                    ₹{((deal.value * deal.probability) / 100).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {deal.expectedCloseDate && (
                <div>
                  <div className="text-sm text-gray-500">Expected Close Date</div>
                  <div className="font-medium">
                    {format(new Date(deal.expectedCloseDate), 'MMMM dd, yyyy')}
                  </div>
                </div>
              )}

              {deal.contact && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Contact</div>
                  <Link
                    href={`/dashboard/contacts/${deal.contact.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {deal.contact.name}
                  </Link>
                  {deal.contact.email && (
                    <div className="text-sm text-gray-600">{deal.contact.email}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  if (confirm('Mark this deal as won?')) {
                    try {
                      await updateDeal.mutateAsync({ id, data: { stage: 'won', actualCloseDate: new Date().toISOString() } })
                      queryClient.invalidateQueries({ queryKey: ['deal', id] })
                      queryClient.invalidateQueries({ queryKey: ['deals'] })
                    } catch (error) {
                      alert('Failed to update deal')
                    }
                  }
                }}
              >
                Mark as Won
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  if (confirm('Mark this deal as lost?')) {
                    try {
                      await updateDeal.mutateAsync({ id, data: { stage: 'lost' } })
                      queryClient.invalidateQueries({ queryKey: ['deal', id] })
                      queryClient.invalidateQueries({ queryKey: ['deals'] })
                    } catch (error) {
                      alert('Failed to update deal')
                    }
                  }
                }}
              >
                Mark as Lost
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

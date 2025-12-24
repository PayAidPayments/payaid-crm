'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useContact, useUpdateContact, useDeleteContact } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { LeadAllocationDialog } from '@/components/LeadAllocationDialog'
import { LeadScoringBadge } from '@/components/LeadScoringBadge'
import { NurtureSequenceApplier } from '@/components/NurtureSequenceApplier'
import { useQueryClient } from '@tanstack/react-query'

export default function ContactDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: contact, isLoading } = useContact(id)
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const [showAllocationDialog, setShowAllocationDialog] = useState(false)
  const [showNurtureDialog, setShowNurtureDialog] = useState(false)
  const [sequences, setSequences] = useState<any[]>([])

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      try {
        await deleteContact.mutateAsync(id)
        router.push('/dashboard/contacts')
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete contact')
      }
    }
  }

  // Load sequences for leads
  useEffect(() => {
    if (contact?.type === 'lead') {
      fetch(`/api/leads/${id}/sequences`)
        .then((res) => res.json())
        .then((data) => setSequences(data.sequences || []))
        .catch(console.error)
    }
  }, [contact?.type, id])

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Contact not found</p>
        <Link href="/dashboard/contacts">
          <Button>Back to Contacts</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{contact.name}</h1>
          <p className="mt-2 text-gray-600">{contact.company || 'No company'}</p>
        </div>
        <div className="flex gap-2">
          {contact.type === 'lead' && (
            <>
              <Button
                onClick={() => setShowAllocationDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                {contact.assignedTo ? '🔄 Reassign Lead' : '👤 Assign Lead'}
              </Button>
              <Button
                onClick={() => setShowNurtureDialog(true)}
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                📧 Nurture Sequence
              </Button>
            </>
          )}
          {(contact.type === 'customer' || contact.type === 'lead') && (
            <Link href={`/dashboard/invoices/new?customerId=${id}`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                🧾 Create Invoice
              </Button>
            </Link>
          )}
          <Link href="/dashboard/contacts">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/dashboard/contacts/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteContact.isPending}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-medium">{contact.email || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Phone</div>
                  <div className="font-medium">{contact.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Type</div>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">
                    {contact.type}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                    contact.status === 'active' ? 'bg-green-100 text-green-800' :
                    contact.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {contact.status}
                  </span>
                </div>
                {contact.type === 'lead' && contact.leadScore !== undefined && contact.leadScore !== null && (
                  <div>
                    <div className="text-sm text-gray-500">Lead Score</div>
                    <LeadScoringBadge score={contact.leadScore} />
                  </div>
                )}
              </div>

              {contact.address && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Address</div>
                  <div className="font-medium">
                    {contact.address}
                    {contact.city && `, ${contact.city}`}
                    {contact.state && `, ${contact.state}`}
                    {contact.postalCode && ` ${contact.postalCode}`}
                    {contact.country && `, ${contact.country}`}
                  </div>
                </div>
              )}

              {contact.notes && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Notes</div>
                  <div className="text-sm">{contact.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          {contact.deals && contact.deals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Deals</CardTitle>
                <CardDescription>{contact.deals.length} active deals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contact.deals.map((deal: any) => (
                    <Link
                      key={deal.id}
                      href={`/dashboard/deals/${deal.id}`}
                      className="block p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{deal.name}</div>
                          <div className="text-sm text-gray-500">
                            ₹{deal.value.toLocaleString('en-IN')} • {deal.probability}% probability
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">
                          {deal.stage}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Nurture Sequences */}
          {contact.type === 'lead' && sequences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Nurture Sequences</CardTitle>
                <CardDescription>Automated email sequences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sequences.map((sequence) => (
                    <div
                      key={sequence.id}
                      className="border-l-2 border-purple-500 pl-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{sequence.template.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Progress: {sequence.completedSteps}/{sequence.totalSteps} emails
                            {' '}
                            ({sequence.progress}%)
                          </div>
                          <div className="mt-2">
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all"
                                style={{ width: `${sequence.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              sequence.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : sequence.status === 'PAUSED'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {sequence.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactions */}
          {contact.interactions && contact.interactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Interactions</CardTitle>
                <CardDescription>Communication history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contact.interactions.map((interaction: any) => (
                    <div key={interaction.id} className="border-l-2 border-blue-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium capitalize">{interaction.type}</div>
                          {interaction.subject && (
                            <div className="text-sm text-gray-600">{interaction.subject}</div>
                          )}
                          {interaction.notes && (
                            <div className="text-sm text-gray-500 mt-1">{interaction.notes}</div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(interaction.createdAt), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/dashboard/deals/new?contactId=${id}`}>
                <Button className="w-full" variant="outline">Create Deal</Button>
              </Link>
              <Link href={`/dashboard/invoices/new?customerId=${id}`}>
                <Button className="w-full" variant="outline">Create Invoice</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contact.type === 'lead' && contact.assignedTo && (
                <div>
                  <div className="text-gray-500">Assigned To</div>
                  <div className="font-medium">
                    {contact.assignedTo.name || contact.assignedTo.user?.name || 'Unknown'}
                  </div>
                  {contact.assignedTo.specialization && (
                    <div className="text-xs text-gray-500 mt-1">
                      Specialization: {contact.assignedTo.specialization}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-gray-500">Created</div>
                <div className="font-medium">
                  {contact.createdAt ? format(new Date(contact.createdAt), 'MMM dd, yyyy') : '-'}
                </div>
              </div>
              {contact.lastContactedAt && (
                <div>
                  <div className="text-gray-500">Last Contacted</div>
                  <div className="font-medium">
                    {format(new Date(contact.lastContactedAt), 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
              {contact.source && (
                <div>
                  <div className="text-gray-500">Source</div>
                  <div className="font-medium capitalize">{contact.source}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lead Allocation Dialog */}
      {showAllocationDialog && contact.type === 'lead' && (
        <LeadAllocationDialog
          contactId={id}
          contactName={contact.name}
          currentRep={contact.assignedTo ? {
            id: contact.assignedTo.id,
            name: contact.assignedTo.name || contact.assignedTo.user?.name || 'Unknown'
          } : null}
          onAssign={(repId) => {
            queryClient.invalidateQueries({ queryKey: ['contacts', id] })
            setShowAllocationDialog(false)
          }}
          onClose={() => setShowAllocationDialog(false)}
        />
      )}

      {/* Nurture Sequence Dialog */}
      {showNurtureDialog && contact.type === 'lead' && (
        <NurtureSequenceApplier
          contactId={id}
          contactName={contact.name}
          onEnroll={() => {
            queryClient.invalidateQueries({ queryKey: ['contacts', id] })
            fetch(`/api/leads/${id}/sequences`)
              .then((res) => res.json())
              .then((data) => setSequences(data.sequences || []))
              .catch(console.error)
          }}
          onClose={() => setShowNurtureDialog(false)}
        />
      )}
    </div>
  )
}

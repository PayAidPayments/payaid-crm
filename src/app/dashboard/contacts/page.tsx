'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useContacts, useDeleteContact } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import ContactImportDialog from '@/components/contacts/contact-import-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { LeadScoringBadge } from '@/components/LeadScoringBadge'
import { ModuleGate } from '@/components/modules/ModuleGate'

function ContactsPageContent() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [scoreFilter, setScoreFilter] = useState<string>('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const { data, isLoading, error } = useContacts({ page, limit: 20, search, type: typeFilter || undefined })
  const deleteContact = useDeleteContact()
  const queryClient = useQueryClient()

  const handleRecalculateScores = async () => {
    setIsRecalculating(true)
    try {
      const response = await fetch('/api/leads/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true }),
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['contacts'] })
        alert('Lead scores recalculated successfully!')
      } else {
        throw new Error('Failed to recalculate scores')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to recalculate scores')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteContact.mutateAsync(id)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete contact')
      }
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (error) {
    return <div className="text-red-600">Error loading contacts</div>
  }

  let contacts = data?.contacts || []
  const pagination = data?.pagination

  // Filter by score if selected
  if (typeFilter === 'lead' && scoreFilter) {
    contacts = contacts.filter((contact: any) => {
      const score = contact.leadScore || 0
      if (scoreFilter === 'hot') return score >= 70
      if (scoreFilter === 'warm') return score >= 40 && score < 70
      if (scoreFilter === 'cold') return score < 40
      return true
    })
  }

  // Sort leads by score (highest first)
  if (typeFilter === 'lead') {
    contacts = [...contacts].sort((a: any, b: any) => {
      const scoreA = a.leadScore || 0
      const scoreB = b.leadScore || 0
      return scoreB - scoreA
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-2 text-gray-600">Manage your customers, leads, and vendors</p>
        </div>
        <div className="flex gap-3">
          {typeFilter === 'lead' && (
            <Button
              variant="outline"
              onClick={handleRecalculateScores}
              disabled={isRecalculating}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              {isRecalculating ? 'Recalculating...' : '🔄 Recalculate Scores'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            📥 Import Contacts
          </Button>
          <Link href="/dashboard/contacts/new">
            <Button>Add Contact</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3"
            >
              <option value="">All Types</option>
              <option value="customer">Customer</option>
              <option value="lead">Lead</option>
              <option value="vendor">Vendor</option>
              <option value="employee">Employee</option>
            </select>
            {typeFilter === 'lead' && (
              <select
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value)}
                className="h-10 rounded-md border border-gray-300 px-3"
              >
                <option value="">All Scores</option>
                <option value="hot">🔥 Hot (70+)</option>
                <option value="warm">⚠️ Warm (40-69)</option>
                <option value="cold">❄️ Cold (0-39)</option>
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts</CardTitle>
          <CardDescription>
            {pagination?.total || 0} total contacts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No contacts found</p>
              <Link href="/dashboard/contacts/new">
                <Button variant="outline">Create your first contact</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {typeFilter === 'lead' && <TableHead>Lead Score</TableHead>}
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact: any) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/contacts/${contact.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.name}
                        </Link>
                      </TableCell>
                      {typeFilter === 'lead' && (
                        <TableCell>
                          {contact.leadScore !== undefined && contact.leadScore !== null ? (
                            <LeadScoringBadge score={contact.leadScore} />
                          ) : (
                            <span className="text-gray-400 text-sm">Not scored</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">
                          {contact.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                          contact.status === 'active' ? 'bg-green-100 text-green-800' :
                          contact.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {contact.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {contact.createdAt ? format(new Date(contact.createdAt), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/contacts/${contact.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contact.id)}
                            disabled={deleteContact.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      {showImportDialog && (
        <ContactImportDialog
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            // Refresh contacts list
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            setPage(1) // Reset to first page
          }}
        />
      )}
    </div>
  )
}

export default function ContactsPage() {
  return (
    <ModuleGate module="crm">
      <ContactsPageContent />
    </ModuleGate>
  )
}

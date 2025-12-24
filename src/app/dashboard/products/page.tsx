import { ModuleGate } from '@/components/modules/ModuleGate'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProducts } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function ProductsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useProducts({ page, limit: 20, search })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  const products = data?.products || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="mt-2 text-gray-600">Manage your product catalog</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>Add Product</Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search products by name, SKU, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            {pagination?.total || 0} total products
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No products found</p>
              <Link href="/dashboard/products/new">
                <Button variant="outline">Add your first product</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>₹{product.salePrice.toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <span className={product.quantity <= product.reorderLevel ? 'text-red-600 font-semibold' : ''}>
                          {product.quantity}
                        </span>
                        {product.quantity <= product.reorderLevel && (
                          <span className="ml-2 text-xs text-red-600">(Low Stock)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.quantity > 0 ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            In Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                            Out of Stock
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/products/${product.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
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
    </div>
  )
}


export default function Page() {
  return (
    <ModuleGate module="crm">
      <ProductsPage />
    </ModuleGate>
  )
}

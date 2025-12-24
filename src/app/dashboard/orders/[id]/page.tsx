'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrder } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

export default function OrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: order, isLoading } = useOrder(id)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Order not found</p>
        <Link href="/dashboard/orders">
          <Button>Back to Orders</Button>
        </Link>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order {order.orderNumber}</h1>
          <p className="mt-2 text-gray-600">
            {order.customer?.name || 'Guest Customer'}
          </p>
        </div>
        <Link href="/dashboard/orders">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.price.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{item.total.toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="font-medium">{order.shippingAddress}</div>
                <div className="text-gray-600">
                  {order.shippingCity}, {order.shippingPostal}
                </div>
                <div className="text-gray-600">{order.shippingCountry}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span>₹{order.tax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span>₹{order.shipping.toLocaleString('en-IN')}</span>
              </div>
              {order.discountAmount && order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-₹{order.discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`px-3 py-1 text-sm rounded-full capitalize ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="text-gray-500">Created</div>
                <div className="font-medium">
                  {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : '-'}
                </div>
              </div>
              {order.paidAt && (
                <div>
                  <div className="text-gray-500">Paid</div>
                  <div className="font-medium">
                    {format(new Date(order.paidAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              )}
              {order.shippedAt && (
                <div>
                  <div className="text-gray-500">Shipped</div>
                  <div className="font-medium">
                    {format(new Date(order.shippedAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div>
                  <div className="text-gray-500">Delivered</div>
                  <div className="font-medium">
                    {format(new Date(order.deliveredAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {order.trackingUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Track Order →
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

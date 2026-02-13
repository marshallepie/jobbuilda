'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import ProtectedLayout from '@/components/ProtectedLayout';
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/utils';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  status: string;
  invoice_date: string;
  due_date: string;
  payment_terms_days: number;
  subtotal_ex_vat: string;
  vat_amount: string;
  total_inc_vat: string;
  amount_paid: string;
  amount_due: string;
  notes: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: string;
  line_total_ex_vat: string;
  vat_rate: string;
  line_vat: string;
  line_total_inc_vat: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const [invoiceData, transactionsData] = await Promise.all([
          api.getInvoice(invoiceId) as Promise<Invoice>,
          api.getInvoiceTransactions(invoiceId).catch(() => []) as Promise<any[]>,
        ]);

        setInvoice(invoiceData);
        setItems(invoiceData.items || []);
        setTransactions(transactionsData || []);
      } catch (err) {
        console.error('Failed to load invoice:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !invoice) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12 text-red-600">
          {error || 'Invoice not found'}
        </div>
      </ProtectedLayout>
    );
  }

  const canPay = invoice.status === 'sent' && parseFloat(invoice.amount_due) > 0;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{invoice.invoice_number}</h1>
              <p className="mt-2 text-gray-600">
                Invoice Date: {formatDate(invoice.invoice_date)}
              </p>
              {invoice.due_date && (
                <p className="text-gray-600">
                  Due Date: {formatDate(invoice.due_date)}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
              {canPay && (
                <Link
                  href={`/payment/${invoice.id}`}
                  className="mt-4 block bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium"
                >
                  Pay Now
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.description}</div>
                    <div className="text-xs text-gray-500 capitalize">{item.item_type}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    {formatCurrency(item.unit_price_ex_vat)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    {formatCurrency(item.line_vat)}
                    <div className="text-xs text-gray-500">{item.vat_rate}%</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(item.line_total_inc_vat)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                  Subtotal (ex VAT):
                </td>
                <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(invoice.subtotal_ex_vat)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                  VAT:
                </td>
                <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(invoice.vat_amount)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-6 py-3 text-right text-lg font-bold text-gray-900">
                  Total:
                </td>
                <td className="px-6 py-3 text-right text-lg font-bold text-gray-900">
                  {formatCurrency(invoice.total_inc_vat)}
                </td>
              </tr>
              {parseFloat(invoice.amount_paid) > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-green-700">
                      Amount Paid:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-green-700">
                      {formatCurrency(invoice.amount_paid)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-red-700">
                      Amount Due:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-red-700">
                      {formatCurrency(invoice.amount_due)}
                    </td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>

        {/* Payment History */}
        {transactions.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(transaction.amount)} paid
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatDate(transaction.created_at)}
                      {transaction.payment_method_brand && ` • ${transaction.payment_method_brand.toUpperCase()} ending in ${transaction.payment_method_last4}`}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {transaction.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}

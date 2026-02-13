import { AuthContext } from '@jobbuilda/contracts';
import { createSupplier, CreateSupplierInput, CreateSupplierOutput } from './create-supplier.js';
import { createProduct, CreateProductInput, CreateProductOutput } from './create-product.js';
import { updatePrice, UpdatePriceInput, UpdatePriceOutput } from './update-price.js';

export const tools = [
  {
    name: 'create_supplier',
    description: 'Create a new supplier (tenant-isolated)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Supplier name' },
        contact_name: { type: 'string', description: 'Contact person name' },
        email: { type: 'string', description: 'Contact email' },
        phone: { type: 'string', description: 'Contact phone' },
        website: { type: 'string', description: 'Supplier website' },
        account_number: { type: 'string', description: 'Account reference number' },
        payment_terms: { type: 'string', description: 'Payment terms (e.g., "30 days")' },
        notes: { type: 'string', description: 'Additional notes' },
        is_active: { type: 'boolean', description: 'Active status', default: true }
      },
      required: ['name']
    }
  },
  {
    name: 'create_product',
    description: 'Add a product to supplier catalog (tenant-isolated)',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'Supplier UUID' },
        sku: { type: 'string', description: 'Product SKU (unique per supplier)' },
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        category: { type: 'string', description: 'Product category' },
        unit: { type: 'string', description: 'Unit of measure', default: 'unit' },
        price_ex_vat: { type: 'number', description: 'Price excluding VAT' },
        vat_rate: { type: 'number', description: 'VAT rate percentage', default: 20.0 },
        is_available: { type: 'boolean', description: 'Availability status', default: true },
        lead_time_days: { type: 'integer', description: 'Lead time in days' },
        minimum_order_quantity: { type: 'integer', description: 'Minimum order quantity', default: 1 }
      },
      required: ['supplier_id', 'sku', 'name', 'price_ex_vat']
    }
  },
  {
    name: 'update_price',
    description: 'Update product price (logged to price history)',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        new_price_ex_vat: { type: 'number', description: 'New price excluding VAT' },
        vat_rate: { type: 'number', description: 'New VAT rate (optional)' },
        reason: { type: 'string', description: 'Reason for price change' }
      },
      required: ['product_id', 'new_price_ex_vat']
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in tool call');
  }

  switch (name) {
    case 'create_supplier':
      return await createSupplier(args as CreateSupplierInput, context);

    case 'create_product':
      return await createProduct(args as CreateProductInput, context);

    case 'update_price':
      return await updatePrice(args as UpdatePriceInput, context);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

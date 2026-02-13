import { AuthContext } from '@jobbuilda/contracts';
import { getSupplier, listSuppliers } from './supplier.js';
import { getProduct, getProductBySKU, listProductsBySupplier, searchProducts } from './product.js';

export const resources = [
  {
    uri: 'res://suppliers/suppliers/{id}',
    name: 'Supplier',
    description: 'Get supplier by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://suppliers/suppliers',
    name: 'Suppliers List',
    description: 'List all suppliers for tenant',
    mimeType: 'application/json'
  },
  {
    uri: 'res://suppliers/products/{id}',
    name: 'Product',
    description: 'Get product by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://suppliers/products/by-supplier/{supplier_id}',
    name: 'Products by Supplier',
    description: 'List all products for a supplier',
    mimeType: 'application/json'
  },
  {
    uri: 'res://suppliers/products/by-sku/{supplier_id}/{sku}',
    name: 'Product by SKU',
    description: 'Get product by SKU and supplier',
    mimeType: 'application/json'
  },
  {
    uri: 'res://suppliers/products/search/{term}',
    name: 'Search Products',
    description: 'Search products by name, SKU, or description',
    mimeType: 'application/json'
  }
];

export async function handleResourceRead(uri: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in resource read');
  }

  // Parse URI patterns
  const supplierMatch = uri.match(/^res:\/\/suppliers\/suppliers\/([a-f0-9-]+)$/);
  const suppliersListMatch = uri.match(/^res:\/\/suppliers\/suppliers$/);
  const productMatch = uri.match(/^res:\/\/suppliers\/products\/([a-f0-9-]+)$/);
  const productsBySupplierMatch = uri.match(/^res:\/\/suppliers\/products\/by-supplier\/([a-f0-9-]+)$/);
  const productBySKUMatch = uri.match(/^res:\/\/suppliers\/products\/by-sku\/([a-f0-9-]+)\/(.+)$/);
  const searchMatch = uri.match(/^res:\/\/suppliers\/products\/search\/(.+)$/);

  if (supplierMatch) {
    const [, supplierId] = supplierMatch;
    const supplier = await getSupplier(supplierId, context.tenant_id);
    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }
    return supplier;
  }

  if (suppliersListMatch) {
    return await listSuppliers(context.tenant_id);
  }

  if (productMatch) {
    const [, productId] = productMatch;
    const product = await getProduct(productId, context.tenant_id);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }
    return product;
  }

  if (productsBySupplierMatch) {
    const [, supplierId] = productsBySupplierMatch;
    return await listProductsBySupplier(supplierId, context.tenant_id);
  }

  if (productBySKUMatch) {
    const [, supplierId, sku] = productBySKUMatch;
    const product = await getProductBySKU(sku, supplierId, context.tenant_id);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }
    return product;
  }

  if (searchMatch) {
    const [, searchTerm] = searchMatch;
    return await searchProducts(decodeURIComponent(searchTerm), context.tenant_id);
  }

  throw new Error(`Invalid resource URI: ${uri}`);
}

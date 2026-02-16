'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Material {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unit_cost: number;
  current_stock: number;
  min_stock_level?: number;
  supplier_name?: string;
  created_at: string;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [materialForm, setMaterialForm] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: 'units',
    unit_cost: '',
    initial_stock: '',
    min_stock_level: '',
    reorder_quantity: '',
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.getMaterials() as any;
      const materialList = Array.isArray(data) ? data : (data.data || []);
      setMaterials(materialList);
    } catch (err) {
      console.error('Failed to load materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialForm.sku || !materialForm.name || !materialForm.unit || !materialForm.unit_cost) {
      alert('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.request('/api/materials', {
        method: 'POST',
        body: JSON.stringify({
          sku: materialForm.sku,
          name: materialForm.name,
          description: materialForm.description || undefined,
          category: materialForm.category || undefined,
          unit: materialForm.unit,
          unit_cost: parseFloat(materialForm.unit_cost),
          initial_stock: materialForm.initial_stock ? parseFloat(materialForm.initial_stock) : undefined,
          min_stock_level: materialForm.min_stock_level ? parseFloat(materialForm.min_stock_level) : undefined,
          reorder_quantity: materialForm.reorder_quantity ? parseFloat(materialForm.reorder_quantity) : undefined,
        }),
      });

      setMaterialForm({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: 'units',
        unit_cost: '',
        initial_stock: '',
        min_stock_level: '',
        reorder_quantity: '',
      });
      setShowAddForm(false);
      await loadMaterials();
      alert('Material added successfully!');
    } catch (err: any) {
      console.error('Failed to add material:', err);
      alert(err.message || 'Failed to add material. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const categories = Array.from(new Set(materials.map(m => m.category).filter(Boolean))) as string[];

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const lowStockMaterials = materials.filter(
    m => m.min_stock_level && m.current_stock < m.min_stock_level
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Materials Catalog</h1>
            <p className="mt-2 text-gray-600">Manage your materials inventory</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            {showAddForm ? '✕ Cancel' : '+ Add Material'}
          </button>
        </div>

        {/* Low Stock Alert */}
        {lowStockMaterials.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800 mb-2">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold">Low Stock Alert</span>
            </div>
            <p className="text-sm text-yellow-700">
              {lowStockMaterials.length} {lowStockMaterials.length === 1 ? 'item is' : 'items are'} below minimum stock level
            </p>
            <div className="mt-2 space-y-1">
              {lowStockMaterials.slice(0, 3).map((material) => (
                <div key={material.id} className="text-sm text-yellow-700">
                  • {material.name} (SKU: {material.sku}) - {material.current_stock} {material.unit} remaining
                </div>
              ))}
              {lowStockMaterials.length > 3 && (
                <div className="text-sm text-yellow-700">
                  ...and {lowStockMaterials.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Material Form */}
        {showAddForm && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Material</h2>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={materialForm.sku}
                    onChange={(e) => setMaterialForm({ ...materialForm, sku: e.target.value })}
                    required
                    placeholder="e.g., CABLE-25-TE"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                    required
                    placeholder="e.g., 2.5mm T&E Cable"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                  placeholder="e.g., 2.5mm Twin & Earth Cable, 100m roll"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={materialForm.category}
                    onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    placeholder="e.g., Cables, Lighting, Switches"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="units">units</option>
                    <option value="meters">meters</option>
                    <option value="feet">feet</option>
                    <option value="boxes">boxes</option>
                    <option value="rolls">rolls</option>
                    <option value="pieces">pieces</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Cost (£) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.unit_cost}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                    required
                    placeholder="5.50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.initial_stock}
                    onChange={(e) => setMaterialForm({ ...materialForm, initial_stock: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stock Level
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.min_stock_level}
                    onChange={(e) => setMaterialForm({ ...materialForm, min_stock_level: e.target.value })}
                    placeholder="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? 'Adding...' : 'Add Material'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials by name, SKU, or description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:w-48">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Total Materials</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {materials.length}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Categories</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {categories.length}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Low Stock Items</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {lowStockMaterials.length}
            </div>
          </div>
        </div>

        {/* Materials Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Materials ({filteredMaterials.length})
            </h2>
          </div>
          {filteredMaterials.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {searchQuery || categoryFilter !== 'all'
                ? 'No materials found matching your filters'
                : 'No materials in catalog. Add your first material to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMaterials.map((material) => {
                    const isLowStock = material.min_stock_level && material.current_stock < material.min_stock_level;
                    return (
                      <tr key={material.id} className={isLowStock ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {material.sku}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{material.name}</div>
                          {material.description && (
                            <div className="text-xs text-gray-500">{material.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {material.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={isLowStock ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                            {material.current_stock}
                          </span>
                          {material.min_stock_level && (
                            <span className="text-gray-500 text-xs ml-1">
                              (min: {material.min_stock_level})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(material.unit_cost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {material.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

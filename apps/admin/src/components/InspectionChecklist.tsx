'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface InspectionItem {
  item_code: string;
  category: string;
  item: string;
  result?: 'pass' | 'fail' | 'n/a' | 'limitation';
  notes?: string;
}

interface InspectionChecklistProps {
  testId: string;
  testType: 'eic' | 'minor_works' | 'eicr';
  existingItems?: InspectionItem[];
  onSaveSuccess?: () => void;
}

// Inspection templates based on BS 7671 Schedule of Inspections
const INSPECTION_TEMPLATES: Record<string, InspectionItem[]> = {
  eic: [
    // Protection against electric shock (BS 7671 Section 4)
    { item_code: 'EIC-01', category: 'Protection against electric shock', item: 'Presence of earthing conductor' },
    { item_code: 'EIC-02', category: 'Protection against electric shock', item: 'Presence and condition of main protective bonding conductors' },
    { item_code: 'EIC-03', category: 'Protection against electric shock', item: 'Presence and condition of supplementary bonding conductors' },
    { item_code: 'EIC-04', category: 'Protection against electric shock', item: 'SELV/PELV source voltages' },
    { item_code: 'EIC-05', category: 'Protection against electric shock', item: 'Choice and setting of protective devices for fault protection' },

    // Prevention of mutual detrimental influence
    { item_code: 'EIC-06', category: 'Prevention of mutual detrimental influence', item: 'Proximity to non-electrical services' },
    { item_code: 'EIC-07', category: 'Prevention of mutual detrimental influence', item: 'Segregation of safety circuits' },

    // Identification (BS 7671 Section 5)
    { item_code: 'EIC-08', category: 'Identification', item: 'Presence of diagrams, instructions and similar information' },
    { item_code: 'EIC-09', category: 'Identification', item: 'Presence of danger notices and warning labels' },
    { item_code: 'EIC-10', category: 'Identification', item: 'Labelling of protective devices, switches and terminals' },
    { item_code: 'EIC-11', category: 'Identification', item: 'Identification of conductors' },

    // Cables and conductors (BS 7671 Section 5)
    { item_code: 'EIC-12', category: 'Cables and conductors', item: 'Routing of cables in prescribed zones or mechanically protected' },
    { item_code: 'EIC-13', category: 'Cables and conductors', item: 'Connection of conductors' },
    { item_code: 'EIC-14', category: 'Cables and conductors', item: 'Presence of fire barriers, sealing arrangements' },
    { item_code: 'EIC-15', category: 'Cables and conductors', item: 'Protection against thermal effects' },
    { item_code: 'EIC-16', category: 'Cables and conductors', item: 'Selection of conductors for current-carrying capacity and voltage drop' },

    // General (BS 7671 Section 1-7)
    { item_code: 'EIC-17', category: 'General', item: 'Presence and adequacy of earthing and bonding arrangements' },
    { item_code: 'EIC-18', category: 'General', item: 'Adequacy of access to switchgear and equipment' },
    { item_code: 'EIC-19', category: 'General', item: 'Particular protective measures for special installations/locations' },
    { item_code: 'EIC-20', category: 'General', item: 'Connection of single-pole devices in phase conductors only' },
    { item_code: 'EIC-21', category: 'General', item: 'Correct connection of socket-outlets, switches and lampholders' },
    { item_code: 'EIC-22', category: 'General', item: 'Presence of undervoltage protection where required' },
    { item_code: 'EIC-23', category: 'General', item: 'Choice and setting of protective and monitoring devices' },
    { item_code: 'EIC-24', category: 'General', item: 'Presence of RCD protection for socket-outlets' },
    { item_code: 'EIC-25', category: 'General', item: 'Presence of supplementary protection (30mA RCD) where required' },
  ],

  minor_works: [
    { item_code: 'MW-01', category: 'Earthing and bonding', item: 'Earthing and bonding arrangements are satisfactory' },
    { item_code: 'MW-02', category: 'Protective device', item: 'Overcurrent protective device is suitable and correctly rated' },
    { item_code: 'MW-03', category: 'Protective device', item: 'RCD protection is provided where required' },
    { item_code: 'MW-04', category: 'Cable installation', item: 'Cables are correctly routed and protected' },
    { item_code: 'MW-05', category: 'Cable installation', item: 'Connections are electrically and mechanically sound' },
    { item_code: 'MW-06', category: 'Accessories', item: 'Accessories are correctly connected and secured' },
    { item_code: 'MW-07', category: 'Identification', item: 'Circuit identification and labelling is satisfactory' },
    { item_code: 'MW-08', category: 'Safety', item: 'No danger from shock or fire risk identified' },
    { item_code: 'MW-09', category: 'Compliance', item: 'Work complies with BS 7671 requirements' },
    { item_code: 'MW-10', category: 'Special locations', item: 'Special location requirements met (if applicable)' },
    { item_code: 'MW-11', category: 'Documentation', item: 'Diagrams and instructions provided where required' },
  ],

  eicr: [
    { item_code: 'EICR-01', category: 'Overall condition', item: 'Earthing and bonding arrangements' },
    { item_code: 'EICR-02', category: 'Overall condition', item: 'Condition of cables, accessories and equipment' },
    { item_code: 'EICR-03', category: 'Overall condition', item: 'Adequacy of protective devices' },
    { item_code: 'EICR-04', category: 'Overall condition', item: 'Suitability of accessories and protective devices for present conditions' },
    { item_code: 'EICR-05', category: 'Consumer unit', item: 'Consumer unit/distribution board condition' },
    { item_code: 'EICR-06', category: 'Consumer unit', item: 'Presence of RCD protection' },
    { item_code: 'EICR-07', category: 'Circuits', item: 'Circuit identification and labelling' },
    { item_code: 'EICR-08', category: 'Circuits', item: 'Condition of wiring systems' },
    { item_code: 'EICR-09', category: 'Safety', item: 'Presence of danger notices' },
    { item_code: 'EICR-10', category: 'Safety', item: 'Fire barriers and sealing' },
    { item_code: 'EICR-11', category: 'Special locations', item: 'Special location requirements (bathroom, outdoor, etc.)' },
    { item_code: 'EICR-12', category: 'Documentation', item: 'Presence of circuit diagrams and schedules' },
    { item_code: 'EICR-13', category: 'Assessment', item: 'Evidence of alterations or additions' },
    { item_code: 'EICR-14', category: 'Assessment', item: 'Assessment of deterioration' },
    { item_code: 'EICR-15', category: 'Assessment', item: 'Assessment of damage or dangerous conditions' },
    { item_code: 'EICR-16', category: 'Overall', item: 'Overall condition of installation' },
  ],
};

export default function InspectionChecklist({
  testId,
  testType,
  existingItems = [],
  onSaveSuccess,
}: InspectionChecklistProps) {
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load template or existing items
    const template = INSPECTION_TEMPLATES[testType] || [];

    if (existingItems.length > 0) {
      // Merge existing items with template
      const merged = template.map(templateItem => {
        const existing = existingItems.find(e => e.item_code === templateItem.item_code);
        return existing || templateItem;
      });
      setItems(merged);
    } else {
      setItems(template);
    }
  }, [testType, existingItems]);

  const handleResultChange = (itemCode: string, result: 'pass' | 'fail' | 'n/a' | 'limitation') => {
    setItems(prev => prev.map(item =>
      item.item_code === itemCode
        ? { ...item, result }
        : item
    ));
  };

  const handleNotesChange = (itemCode: string, notes: string) => {
    setItems(prev => prev.map(item =>
      item.item_code === itemCode
        ? { ...item, notes }
        : item
    ));
  };

  const handleSaveItem = async (item: InspectionItem) => {
    if (!item.result) {
      setError('Please select a result before saving');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveStatus(prev => ({ ...prev, [item.item_code]: false }));

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.post(`/api/tests/${testId}/inspections`, {
        item_code: item.item_code,
        result: item.result,
        notes: item.notes || '',
      });

      setSaveStatus(prev => ({ ...prev, [item.item_code]: true }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [item.item_code]: false }));
      }, 2000);

      onSaveSuccess?.();
    } catch (err: any) {
      console.error('Failed to save inspection item:', err);
      setError(`Failed to save ${item.item}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Save all items with results
      const itemsToSave = items.filter(item => item.result);

      for (const item of itemsToSave) {
        await api.post(`/api/tests/${testId}/inspections`, {
          item_code: item.item_code,
          result: item.result,
          notes: item.notes || '',
        });
      }

      alert(`Saved ${itemsToSave.length} inspection items`);
      onSaveSuccess?.();
    } catch (err: any) {
      console.error('Failed to bulk save:', err);
      setError(err.message || 'Failed to save inspection items');
    } finally {
      setSaving(false);
    }
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InspectionItem[]>);

  // Calculate progress
  const totalItems = items.length;
  const completedItems = items.filter(item => item.result).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const getResultColor = (result?: string) => {
    if (result === 'pass') return 'bg-green-100 text-green-800 border-green-300';
    if (result === 'fail') return 'bg-red-100 text-red-800 border-red-300';
    if (result === 'n/a') return 'bg-gray-100 text-gray-800 border-gray-300';
    if (result === 'limitation') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-white text-gray-700 border-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Inspection Progress</h3>
          <span className="text-sm font-medium text-gray-700">
            {completedItems} of {totalItems} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-primary-600 h-4 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Inspection Items by Category */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">{category}</h4>
              <p className="text-xs text-gray-600 mt-1">
                {categoryItems.filter(i => i.result).length} of {categoryItems.length} completed
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {categoryItems.map((item) => (
                <div key={item.item_code} className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Item Description */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-2">{item.item}</div>

                      {/* Result Radio Buttons */}
                      <div className="flex gap-2 mb-2">
                        {(['pass', 'fail', 'n/a', 'limitation'] as const).map((resultOption) => (
                          <button
                            key={resultOption}
                            onClick={() => handleResultChange(item.item_code, resultOption)}
                            className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                              item.result === resultOption
                                ? getResultColor(resultOption)
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {resultOption === 'n/a' ? 'N/A' : resultOption.charAt(0).toUpperCase() + resultOption.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Notes (required for fail results) */}
                      {(item.result === 'fail' || item.result === 'limitation' || item.notes) && (
                        <textarea
                          value={item.notes || ''}
                          onChange={(e) => handleNotesChange(item.item_code, e.target.value)}
                          placeholder={item.result === 'fail' ? 'Notes required for failed items' : 'Optional notes'}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-primary-500 focus:border-primary-500 ${
                            item.result === 'fail' && !item.notes ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          rows={2}
                        />
                      )}
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={() => handleSaveItem(item)}
                      disabled={saving || !item.result || (item.result === 'fail' && !item.notes)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                    >
                      {saveStatus[item.item_code] ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleBulkSave}
          disabled={saving || completedItems === 0}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving All...' : `Save All (${completedItems} items)`}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export interface CircuitDetail {
  circuit_reference: string;
  location: string;
  overcurrent_device_type: string;
  overcurrent_device_rating: string;
}

interface CircuitDetailsFormProps {
  circuits: CircuitDetail[];
  onChange: (circuits: CircuitDetail[]) => void;
}

export default function CircuitDetailsForm({ circuits, onChange }: CircuitDetailsFormProps) {
  const addCircuit = () => {
    onChange([
      ...circuits,
      {
        circuit_reference: '',
        location: '',
        overcurrent_device_type: 'MCB Type B',
        overcurrent_device_rating: '32A',
      },
    ]);
  };

  const removeCircuit = (index: number) => {
    onChange(circuits.filter((_, i) => i !== index));
  };

  const updateCircuit = (index: number, field: keyof CircuitDetail, value: string) => {
    const updated = circuits.map((circuit, i) =>
      i === index ? { ...circuit, [field]: value } : circuit
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Circuit Details</h4>
        <button
          type="button"
          onClick={addCircuit}
          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          + Add Circuit
        </button>
      </div>

      {circuits.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600">
            No circuits added yet. Click &quot;Add Circuit&quot; to begin.
          </p>
        </div>
      )}

      {circuits.map((circuit, index) => (
        <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-gray-900">Circuit {index + 1}</h5>
            <button
              type="button"
              onClick={() => removeCircuit(index)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Circuit Reference */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Circuit Reference <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={circuit.circuit_reference}
                onChange={(e) => updateCircuit(index, 'circuit_reference', e.target.value)}
                placeholder="e.g., Ring Final 1"
                required
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={circuit.location}
                onChange={(e) => updateCircuit(index, 'location', e.target.value)}
                placeholder="e.g., Ground floor sockets"
                required
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Overcurrent Device Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Overcurrent Device Type <span className="text-red-500">*</span>
              </label>
              <select
                value={circuit.overcurrent_device_type}
                onChange={(e) => updateCircuit(index, 'overcurrent_device_type', e.target.value)}
                required
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="MCB Type B">MCB Type B</option>
                <option value="MCB Type C">MCB Type C</option>
                <option value="MCB Type D">MCB Type D</option>
                <option value="RCBO Type B">RCBO Type B</option>
                <option value="RCBO Type C">RCBO Type C</option>
                <option value="Fuse BS88">Fuse BS88</option>
                <option value="Fuse BS1361">Fuse BS1361</option>
              </select>
            </div>

            {/* Overcurrent Device Rating */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rating <span className="text-red-500">*</span>
              </label>
              <select
                value={circuit.overcurrent_device_rating}
                onChange={(e) => updateCircuit(index, 'overcurrent_device_rating', e.target.value)}
                required
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="6A">6A</option>
                <option value="10A">10A</option>
                <option value="16A">16A</option>
                <option value="20A">20A</option>
                <option value="25A">25A</option>
                <option value="32A">32A (Common for sockets)</option>
                <option value="40A">40A</option>
                <option value="45A">45A</option>
                <option value="50A">50A</option>
                <option value="63A">63A</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

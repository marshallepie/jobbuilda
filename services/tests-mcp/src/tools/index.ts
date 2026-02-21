import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createTest } from './create-test.js';
import { addMeasurement } from './add-measurement.js';
import { completeTest } from './complete-test.js';
import { generateCertificate } from './generate-certificate.js';
import { createCircuit } from './create-circuit.js';
import { updateCircuitMeasurements } from './update-circuit-measurements.js';
import { bulkCreateCircuitsFromJob } from './bulk-create-circuits-from-job.js';
import { addInspectionItem } from './add-inspection-item.js';
import { getMeasurementStandards } from './get-measurement-standards.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerTools(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_test',
        description: 'Create a new compliance test',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job UUID' },
            client_id: { type: 'string', description: 'Client UUID' },
            site_id: { type: 'string', description: 'Site UUID' },
            test_type: {
              type: 'string',
              enum: ['eicr', 'pat', 'initial_verification', 'periodic_inspection', 'minor_works'],
              description: 'Type of test',
            },
            title: { type: 'string', description: 'Test title' },
            description: { type: 'string', description: 'Test description' },
            test_date: { type: 'string', description: 'Test date (ISO 8601)' },
            next_inspection_date: { type: 'string', description: 'Next inspection due date' },
            notes: { type: 'string', description: 'Test notes' },
          },
          required: ['job_id', 'client_id', 'site_id', 'test_type', 'title'],
        },
      },
      {
        name: 'add_measurement',
        description: 'Add a test measurement or reading',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            circuit_ref: { type: 'string', description: 'Circuit reference' },
            measurement_type: {
              type: 'string',
              enum: ['continuity', 'insulation', 'earth_loop', 'rcd', 'polarity', 'voltage'],
              description: 'Type of measurement',
            },
            measurement_name: { type: 'string', description: 'Measurement name' },
            value: { type: 'number', description: 'Measurement value' },
            unit: { type: 'string', description: 'Unit of measure (ohm, mohm, ms, v, a)' },
            min_acceptable: { type: 'number', description: 'Minimum acceptable value' },
            max_acceptable: { type: 'number', description: 'Maximum acceptable value' },
            notes: { type: 'string', description: 'Measurement notes' },
          },
          required: ['test_id', 'measurement_type', 'measurement_name', 'value', 'unit'],
        },
      },
      {
        name: 'complete_test',
        description: 'Mark a test as completed with outcome',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            outcome: {
              type: 'string',
              enum: ['satisfactory', 'unsatisfactory', 'requires_improvement'],
              description: 'Test outcome',
            },
            completion_date: { type: 'string', description: 'Completion date (ISO 8601)' },
            notes: { type: 'string', description: 'Completion notes' },
          },
          required: ['test_id', 'outcome'],
        },
      },
      {
        name: 'generate_certificate',
        description: 'Generate a test certificate',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            certificate_type: {
              type: 'string',
              enum: ['eicr', 'eic', 'pat', 'minor_works'],
              description: 'Certificate type',
            },
            issue_date: { type: 'string', description: 'Issue date (ISO 8601)' },
            expiry_date: { type: 'string', description: 'Expiry date (ISO 8601)' },
          },
          required: ['test_id', 'certificate_type'],
        },
      },
      {
        name: 'create_circuit',
        description: 'Create a new circuit record for a test',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            circuit_reference: { type: 'string', description: 'Circuit reference (e.g., "Ring Final 1")' },
            circuit_description: { type: 'string', description: 'Circuit description' },
            location: { type: 'string', description: 'Circuit location' },
            circuit_type: {
              type: 'string',
              enum: ['ring_final', 'radial', 'lighting', 'cooker', 'shower', 'immersion', 'ev_charger', 'other'],
              description: 'Type of circuit',
            },
            conductor_csa: { type: 'string', description: 'Conductor cross-sectional area (e.g., "2.5mm²")' },
            cpc_csa: { type: 'string', description: 'Protective conductor CSA (e.g., "1.5mm²")' },
            overcurrent_device_type: { type: 'string', description: 'Overcurrent protection device type' },
            overcurrent_device_rating: { type: 'string', description: 'Device rating (e.g., "32A")' },
            overcurrent_device_location: { type: 'string', description: 'Device location' },
            rcd_protected: { type: 'boolean', description: 'RCD protected' },
            rcd_rating: { type: 'string', description: 'RCD rating (e.g., "30mA")' },
            rcd_type: { type: 'string', description: 'RCD type (e.g., "Type A")' },
            max_demand_amps: { type: 'number', description: 'Maximum demand in amps' },
            circuit_length_meters: { type: 'number', description: 'Circuit length in meters' },
          },
          required: ['test_id', 'circuit_reference'],
        },
      },
      {
        name: 'update_circuit_measurements',
        description: 'Update circuit measurements with BS 7671 validation',
        inputSchema: {
          type: 'object',
          properties: {
            circuit_id: { type: 'string', description: 'Circuit UUID' },
            measurements: {
              type: 'object',
              properties: {
                continuity_r1_r2: { type: 'number', description: 'Continuity R1+R2 (Ohms)' },
                insulation_resistance: { type: 'number', description: 'Insulation resistance (MegaOhms)' },
                earth_loop_impedance: { type: 'number', description: 'Earth loop impedance Zs (Ohms)' },
                polarity_correct: { type: 'boolean', description: 'Polarity correct' },
              },
              description: 'Circuit measurements',
            },
            notes: { type: 'string', description: 'Measurement notes' },
          },
          required: ['circuit_id', 'measurements'],
        },
      },
      {
        name: 'bulk_create_circuits_from_job',
        description: 'Create multiple circuits from job circuit details',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            job_id: { type: 'string', description: 'Job UUID' },
          },
          required: ['test_id', 'job_id'],
        },
      },
      {
        name: 'add_inspection_item',
        description: 'Add or update an inspection checklist item',
        inputSchema: {
          type: 'object',
          properties: {
            test_id: { type: 'string', description: 'Test UUID' },
            item_code: { type: 'string', description: 'Inspection item code' },
            result: {
              type: 'string',
              enum: ['pass', 'fail', 'n/a', 'limitation'],
              description: 'Inspection result',
            },
            notes: { type: 'string', description: 'Item notes' },
          },
          required: ['test_id', 'item_code', 'result'],
        },
      },
      {
        name: 'get_measurement_standards',
        description: 'Get BS 7671 measurement standards for validation',
        inputSchema: {
          type: 'object',
          properties: {
            measurement_type: { type: 'string', description: 'Measurement type (e.g., "insulation", "earth_loop")' },
            circuit_type: { type: 'string', description: 'Circuit type (optional)' },
            circuit_rating: { type: 'string', description: 'Circuit rating (optional, e.g., "32A")' },
          },
          required: ['measurement_type'],
        },
      },
    ],
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const context = (args as any)?._meta?.context as AuthContext;

    if (!context?.tenant_id) {
      throw new Error('Missing authentication context');
    }

    let result: any;

    switch (name) {
      case 'create_test':
        result = await createTest(args as any, context);
        break;
      case 'add_measurement':
        result = await addMeasurement(args as any, context);
        break;
      case 'complete_test':
        result = await completeTest(args as any, context);
        break;
      case 'generate_certificate':
        result = await generateCertificate(args as any, context);
        break;
      case 'create_circuit':
        result = await createCircuit(args as any, context);
        break;
      case 'update_circuit_measurements':
        result = await updateCircuitMeasurements(args as any, context);
        break;
      case 'bulk_create_circuits_from_job':
        result = await bulkCreateCircuitsFromJob(args as any, context);
        break;
      case 'add_inspection_item':
        result = await addInspectionItem(args as any, context);
        break;
      case 'get_measurement_standards':
        result = await getMeasurementStandards(args as any, context);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });
}

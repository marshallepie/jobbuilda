import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createTest } from './create-test.js';
import { addMeasurement } from './add-measurement.js';
import { completeTest } from './complete-test.js';
import { generateCertificate } from './generate-certificate.js';
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

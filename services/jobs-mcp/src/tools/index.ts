import { AuthContext } from '@jobbuilda/contracts';
import { createJobFromQuote, CreateJobFromQuoteInput, CreateJobFromQuoteOutput } from './create-job-from-quote.js';
import { startJob, StartJobInput, StartJobOutput } from './start-job.js';
import { completeJob, CompleteJobInput, CompleteJobOutput } from './complete-job.js';
import { logTime, LogTimeInput, LogTimeOutput } from './log-time.js';

export const tools = [
  {
    name: 'create_job_from_quote',
    description: 'Create a job from an approved quote',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote UUID' },
        client_id: { type: 'string', description: 'Client UUID' },
        site_id: { type: 'string', description: 'Site UUID' },
        title: { type: 'string', description: 'Job title' },
        description: { type: 'string', description: 'Job description' },
        scheduled_start: { type: 'string', description: 'Scheduled start date (ISO 8601)' },
        scheduled_end: { type: 'string', description: 'Scheduled end date (ISO 8601)' },
        assigned_to: { type: 'string', description: 'User UUID to assign to' },
        estimated_hours: { type: 'number', description: 'Estimated hours to complete' },
        notes: { type: 'string', description: 'Job notes' },
        quote_items: {
          type: 'array',
          description: 'Items from quote to add to job',
          items: {
            type: 'object',
            properties: {
              quote_item_id: { type: 'string', description: 'Quote item UUID' },
              item_type: { type: 'string', enum: ['material', 'labor', 'other'] },
              description: { type: 'string', description: 'Item description' },
              quantity_planned: { type: 'number', description: 'Planned quantity' },
              unit: { type: 'string', description: 'Unit of measure', default: 'unit' }
            },
            required: ['item_type', 'description', 'quantity_planned']
          }
        }
      },
      required: ['quote_id', 'client_id', 'site_id', 'title']
    }
  },
  {
    name: 'start_job',
    description: 'Start a scheduled job (changes status to in_progress)',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job UUID' }
      },
      required: ['job_id']
    }
  },
  {
    name: 'complete_job',
    description: 'Complete a job (changes status to completed)',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job UUID' },
        notes: { type: 'string', description: 'Completion notes' }
      },
      required: ['job_id']
    }
  },
  {
    name: 'log_time',
    description: 'Log time entry for a job (updates actual_hours)',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job UUID' },
        date: { type: 'string', description: 'Date of work (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Start time (ISO 8601)' },
        end_time: { type: 'string', description: 'End time (ISO 8601)' },
        hours: { type: 'number', description: 'Hours worked (alternative to start/end time)' },
        break_minutes: { type: 'integer', description: 'Break time in minutes', default: 0 },
        description: { type: 'string', description: 'Work description' },
        is_overtime: { type: 'boolean', description: 'Is this overtime?', default: false },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['job_id', 'date']
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in tool call');
  }

  switch (name) {
    case 'create_job_from_quote':
      return await createJobFromQuote(args as CreateJobFromQuoteInput, context);

    case 'start_job':
      return await startJob(args as StartJobInput, context);

    case 'complete_job':
      return await completeJob(args as CompleteJobInput, context);

    case 'log_time':
      return await logTime(args as LogTimeInput, context);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

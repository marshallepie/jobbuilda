import { AuthContext } from '@jobbuilda/contracts';
import { getJob, listJobs, listJobsByClient } from './job.js';

export const resources = [
  {
    uri: 'res://jobs/jobs/{id}',
    name: 'Job',
    description: 'Get job by ID with items and time entries (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://jobs/jobs',
    name: 'Jobs List',
    description: 'List all jobs for tenant',
    mimeType: 'application/json'
  },
  {
    uri: 'res://jobs/jobs/by-client/{client_id}',
    name: 'Jobs by Client',
    description: 'List all jobs for a specific client',
    mimeType: 'application/json'
  }
];

export async function handleResourceRead(uri: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in resource read');
  }

  // Parse URI patterns
  const jobMatch = uri.match(/^res:\/\/jobs\/jobs\/([a-f0-9-]+)$/);
  const jobsListMatch = uri.match(/^res:\/\/jobs\/jobs$/);
  const jobsByClientMatch = uri.match(/^res:\/\/jobs\/jobs\/by-client\/([a-f0-9-]+)$/);

  if (jobMatch) {
    const [, jobId] = jobMatch;
    const job = await getJob(jobId, context.tenant_id, true);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  if (jobsListMatch) {
    return await listJobs(context.tenant_id);
  }

  if (jobsByClientMatch) {
    const [, clientId] = jobsByClientMatch;
    return await listJobsByClient(clientId, context.tenant_id);
  }

  throw new Error(`Invalid resource URI: ${uri}`);
}

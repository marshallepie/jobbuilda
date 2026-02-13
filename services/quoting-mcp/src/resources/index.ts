import { AuthContext } from '@jobbuilda/contracts';
import { getLead, listLeads } from './lead.js';
import { getQuote, listQuotesByClient, listQuotes } from './quote.js';

export const resources = [
  {
    uri: 'res://quoting/leads/{id}',
    name: 'Lead',
    description: 'Get lead by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://quoting/leads',
    name: 'Leads List',
    description: 'List all leads for tenant',
    mimeType: 'application/json'
  },
  {
    uri: 'res://quoting/quotes/{id}',
    name: 'Quote',
    description: 'Get quote by ID with line items (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://quoting/quotes',
    name: 'Quotes List',
    description: 'List all quotes for tenant',
    mimeType: 'application/json'
  },
  {
    uri: 'res://quoting/quotes/by-client/{client_id}',
    name: 'Quotes by Client',
    description: 'List all quotes for a specific client',
    mimeType: 'application/json'
  }
];

export async function handleResourceRead(uri: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in resource read');
  }

  // Parse URI patterns
  const leadMatch = uri.match(/^res:\/\/quoting\/leads\/([a-f0-9-]+)$/);
  const leadsListMatch = uri.match(/^res:\/\/quoting\/leads$/);
  const quoteMatch = uri.match(/^res:\/\/quoting\/quotes\/([a-f0-9-]+)$/);
  const quotesListMatch = uri.match(/^res:\/\/quoting\/quotes$/);
  const quotesByClientMatch = uri.match(/^res:\/\/quoting\/quotes\/by-client\/([a-f0-9-]+)$/);

  if (leadMatch) {
    const [, leadId] = leadMatch;
    const lead = await getLead(leadId, context.tenant_id);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    return lead;
  }

  if (leadsListMatch) {
    return await listLeads(context.tenant_id);
  }

  if (quoteMatch) {
    const [, quoteId] = quoteMatch;
    const quote = await getQuote(quoteId, context.tenant_id, true);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }
    return quote;
  }

  if (quotesListMatch) {
    return await listQuotes(context.tenant_id);
  }

  if (quotesByClientMatch) {
    const [, clientId] = quotesByClientMatch;
    return await listQuotesByClient(clientId, context.tenant_id);
  }

  throw new Error(`Invalid resource URI: ${uri}`);
}

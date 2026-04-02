import Anthropic from '@anthropic-ai/sdk';
import { FastifyInstance } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

const RECEIPT_EXTRACTION_PROMPT = `You are a UK receipt data extractor. Return ONLY a JSON object — no markdown, no explanation.

Rules:
- All monetary values are numbers in GBP (no currency symbols).
- UK standard VAT rate is 20%. If only a total is shown with no VAT breakdown, back-calculate: unit_price_ex_vat = total / 1.20.
- If the receipt lists individual line items, return each as a separate entry in "items".
- If the receipt shows only a single total (e.g. a fuel receipt), return one item using the supplier name as the description.
- quantity defaults to 1 if not stated.
- date must be ISO 8601 format (YYYY-MM-DD) or null.
- Return null for any field you cannot determine with reasonable confidence.

Return this exact JSON schema:
{
  "supplier_name": string | null,
  "date": string | null,
  "items": [
    {
      "description": string,
      "quantity": number,
      "unit_price_ex_vat": number,
      "vat_rate": number
    }
  ],
  "subtotal_ex_vat": number | null,
  "vat_amount": number | null,
  "total_inc_vat": number | null
}`;

interface ScanReceiptBody {
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

export async function receiptsRoutes(fastify: FastifyInstance) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  fastify.post<{ Body: ScanReceiptBody }>(
    '/api/receipts/scan',
    {
      config: { rawBody: false },
      bodyLimit: 10 * 1024 * 1024, // 10 MB — base64 of a 5 MB image is ~7 MB
    },
    async (request, reply) => {
      extractAuthContext(request);

      const { imageBase64, mimeType } = request.body;

      if (!imageBase64 || !mimeType) {
        return reply.status(400).send({ error: 'imageBase64 and mimeType are required' });
      }

      try {
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: imageBase64,
                  },
                },
                { type: 'text', text: RECEIPT_EXTRACTION_PROMPT },
              ],
            },
          ],
        });

        const raw =
          message.content[0]?.type === 'text' ? message.content[0].text : '{}';

        // Strip markdown code fences if the model wraps the JSON
        const jsonStr = raw
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();

        try {
          const parsed = JSON.parse(jsonStr);
          return reply.send(parsed);
        } catch {
          fastify.log.warn({ raw }, 'Receipt scan returned non-JSON response');
          return reply.status(422).send({
            error: 'Could not extract receipt data — please try a clearer photo',
            raw,
          });
        }
      } catch (error: any) {
        fastify.log.error({ error }, 'Receipt scan failed');
        return reply.status(500).send({
          error: 'Receipt scan failed',
          message: error.message,
        });
      }
    }
  );
}

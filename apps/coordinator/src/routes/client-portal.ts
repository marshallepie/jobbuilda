import { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getPool } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';

const COOKIE = 'jobbuilda_portal';
const HASH = (value: string) => createHash('sha256').update(value).digest('hex');
const opaque = () => randomBytes(32).toString('base64url');
const cookie = (value: string, maxAge: number) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const readCookie = (request: FastifyRequest) => Object.fromEntries((request.headers.cookie || '').split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2))[COOKIE];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function verifiedLegacy(token: string) {
  const [head, body, signature] = token.split('.');
  if (!head || !body || !signature || !process.env.JWT_SECRET) return null;
  const expected = createHmac('sha256', process.env.JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const header = JSON.parse(Buffer.from(head, 'base64url').toString());
    const claim = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (header.alg !== 'HS256' || claim.iss !== 'jobbuilda-identity-mcp' || claim.purpose !== 'invoice_payment' || !uuid.test(claim.resource_id) || !claim.exp || claim.exp <= Math.floor(Date.now()/1000)) return null;
    return claim as { resource_id: string };
  } catch { return null; }
}

export async function clientPortalRoutes(fastify: FastifyInstance) {
  async function principal(request: FastifyRequest) {
    const token = readCookie(request); if (!token) return null;
    const result = await getPool().query(`SELECT s.id, s.principal_id, s.selected_membership_id, m.tenant_id, m.client_id
      FROM portal_sessions s JOIN portal_memberships m ON m.id=s.selected_membership_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [HASH(token)]);
    return result.rows[0] || null;
  }
  async function invoiceFor(p: any, id: string) {
    if (!uuid.test(id)) return null;
    const result = await getPool().query(`SELECT id, invoice_number, invoice_date, due_date, status, total_inc_vat, amount_paid, amount_due
      FROM invoices WHERE id=$1 AND tenant_id=$2 AND client_id=$3 AND status NOT IN ('draft','void')`, [id,p.tenant_id,p.client_id]);
    return result.rows[0] || null;
  }
  fastify.post('/api/client-portal/request-access', async (request, reply) => {
    const email = String((request.body as any)?.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return reply.status(400).send({ error: 'Enter a valid email address' });
    // Always return the same response; challenges are hashed and one-time. Email dispatch is deliberately externalised.
    const db=getPool(); const p=await db.query('SELECT id FROM portal_principals WHERE email=$1',[email]);
    if (p.rows[0]) { const token=opaque(); await db.query(`INSERT INTO portal_magic_links(id,principal_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')`,[randomUUID(),p.rows[0].id,HASH(token)]); }
    return reply.status(202).send({ message: 'If this email has portal access, a sign-in link will be sent.' });
  });
  fastify.post('/api/client-portal/exchange', async (request, reply) => {
    const token=String((request.body as any)?.token || ''); const legacy=verifiedLegacy(token); if (!legacy) return reply.status(401).send({error:'This link is invalid or expired. Request fresh access.'});
    const db=getPool(); const inv=await db.query('SELECT tenant_id,client_id FROM invoices WHERE id=$1 AND status NOT IN (\'draft\',\'void\')',[legacy.resource_id]);
    if (!inv.rows[0]) return reply.status(401).send({error:'This link is no longer available. Request fresh access.'});
    const {tenant_id,client_id}=inv.rows[0]; const client=await db.query('SELECT email FROM clients WHERE id=$1',[client_id]); const email=client.rows[0]?.email?.trim().toLowerCase();
    if (!email) return reply.status(401).send({error:'This invoice has no verified client email. Request fresh access.'});
    await db.query('BEGIN'); try {
      let p=await db.query('SELECT id FROM portal_principals WHERE email=$1 FOR UPDATE',[email]); const principalId=p.rows[0]?.id || randomUUID();
      if (!p.rows[0]) await db.query('INSERT INTO portal_principals(id,email) VALUES($1,$2)',[principalId,email]);
      let m=await db.query('SELECT id FROM portal_memberships WHERE principal_id=$1 AND tenant_id=$2 AND client_id=$3',[principalId,tenant_id,client_id]); const membershipId=m.rows[0]?.id || randomUUID();
      if (!m.rows[0]) await db.query('INSERT INTO portal_memberships(id,principal_id,tenant_id,client_id) VALUES($1,$2,$3,$4)',[membershipId,principalId,tenant_id,client_id]);
      const session=opaque(); await db.query(`INSERT INTO portal_sessions(id,principal_id,selected_membership_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days')`,[randomUUID(),principalId,membershipId,HASH(session)]); await db.query('COMMIT');
      reply.header('Set-Cookie',cookie(session,60*60*24*30)); return reply.send({ok:true});
    } catch(e) { await db.query('ROLLBACK'); throw e; }
  });
  fastify.get('/api/client-portal/session', async (request, reply) => { const p=await principal(request); return p ? {authenticated:true} : reply.status(401).send({authenticated:false}); });
  fastify.post('/api/client-portal/logout', async (request, reply) => { const t=readCookie(request); if(t) await getPool().query('UPDATE portal_sessions SET revoked_at=now() WHERE token_hash=$1',[HASH(t)]); reply.header('Set-Cookie',cookie('',0)); return {ok:true}; });
  fastify.get('/api/client-portal/invoices', async (request, reply) => { const p=await principal(request); if(!p)return reply.status(401).send({error:'Sign in required'}); const q=request.query as any; const search=String(q.search||'').slice(0,100); const status=String(q.status||''); const page=Math.max(1,Number(q.page)||1); const r=await getPool().query(`SELECT id,invoice_number,invoice_date,due_date,status,total_inc_vat,amount_paid,amount_due FROM invoices WHERE tenant_id=$1 AND client_id=$2 AND status NOT IN ('draft','void') AND ($3='' OR invoice_number ILIKE '%'||$3||'%' OR CAST(invoice_date AS text) ILIKE '%'||$3||'%') AND ($4='' OR status=$4) ORDER BY invoice_date DESC,created_at DESC LIMIT 50 OFFSET $5`,[p.tenant_id,p.client_id,search,status,(page-1)*50]); return {invoices:r.rows,page}; });
  fastify.get('/api/client-portal/invoices/:id', async (request, reply) => { const p=await principal(request); if(!p)return reply.status(401).send({error:'Sign in required'}); const i=await invoiceFor(p,(request.params as any).id); return i ? i : reply.status(404).send({error:'Invoice not found'}); });
  fastify.post('/api/client-portal/invoices/:id/checkout', async (request, reply) => { const p=await principal(request); if(!p)return reply.status(401).send({error:'Sign in required'}); const i=await invoiceFor(p,(request.params as any).id); if(!i)return reply.status(404).send({error:'Invoice not found'}); if(Number(i.amount_due)<=0)return reply.status(400).send({error:'This invoice has no outstanding balance'}); if(!process.env.STRIPE_SECRET_KEY)return reply.status(503).send({error:'Payments not configured'}); const origin=process.env.PORTAL_URL || 'http://localhost:3001'; const session=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price_data:{currency:'gbp',product_data:{name:`Invoice ${i.invoice_number}`},unit_amount:Math.round(Number(i.amount_due)*100)},quantity:1}],success_url:`${origin}/payment/success?invoice_id=${i.id}`,cancel_url:`${origin}/invoices/${i.id}`,metadata:{tenant_id:p.tenant_id,invoice_id:i.id,portal_session_id:p.id}}); return {checkout_url:session.url}; });
  fastify.get('/api/client-portal/invoices/:id/pdf', async (request, reply) => { const p=await principal(request); if(!p)return reply.status(401).send({error:'Sign in required'}); const i=await invoiceFor(p,(request.params as any).id); if(!i)return reply.status(404).send({error:'Invoice not found'}); return reply.status(501).send({error:'PDF download is unavailable until the portal PDF renderer is configured'}); });
}
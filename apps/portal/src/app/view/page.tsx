'use client';
import {useEffect} from 'react'; import {useRouter,useSearchParams} from 'next/navigation';
export default function LegacyInvoiceLink(){const r=useRouter(),q=useSearchParams();useEffect(()=>{const t=q.get('token');r.replace(t?`/auth?token=${encodeURIComponent(t)}`:'/auth')},[q,r]);return <p className="p-8">Opening secure access…</p>}

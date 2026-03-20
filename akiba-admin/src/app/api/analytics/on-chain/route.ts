import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = getSupabaseAdmin()

  const [burnedRes, refundRes, pendingRes] = await Promise.all([
    supabase
      .from('passport_ops')
      .select('amount')
      .eq('type', 'burn')
      .eq('status', 'completed'),
    supabase
      .from('passport_ops')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'refund')
      .eq('status', 'completed'),
    supabase
      .from('mint_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const totalBurned = (burnedRes.data ?? []).reduce((sum, r) => sum + (r.amount as number), 0)

  return NextResponse.json({
    totalBurned,
    refundCount: refundRes.count ?? 0,
    pendingQueue: pendingRes.count ?? 0,
  })
}

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.data.session.user.id;

    const { data: positions, error } = await supabase
      .from('positions')
      .select('*, instruments(*)')
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Calculate P&L for each position
    const enrichedPositions = positions.map((pos: any) => ({
      ...pos,
      pnl: (pos.current_price - pos.average_price) * pos.quantity,
      pnl_percentage: ((pos.current_price - pos.average_price) / pos.average_price) * 100,
    }));

    return NextResponse.json(enrichedPositions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

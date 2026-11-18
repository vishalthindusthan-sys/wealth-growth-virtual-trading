import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { TABLES } from '@/lib/tables';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.data.session.user.id;
    const { instrumentId, orderType, side, quantity, price, triggerPrice } = body;

    // Fetch instrument details
    const { data: instrument } = await supabase.from(TABLES.instruments).select('*').eq('id', instrumentId).single();

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
    }

    // Fetch user's virtual balance
    const { data: user } = await supabase.from(TABLES.users).select('virtual_balance').eq('id', userId).single();

    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Calculate order cost
    const executionPrice = orderType === 'market' ? instrument.current_price : price;
    const orderCost = quantity * executionPrice;
    const brokerage = orderCost * 0.001; // 0.1% brokerage

    if (side === 'buy' && user.virtual_balance < orderCost + brokerage) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from(TABLES.orders)
      .insert({
        user_id: userId,
        instrument_id: instrumentId,
        order_type: orderType,
        side,
        quantity,
        price: orderType === 'market' ? executionPrice : price,
        trigger_price: triggerPrice,
        status: 'executed',
        executed_price: executionPrice,
        executed_quantity: quantity,
        brokerage,
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    // Update virtual balance
    if (side === 'buy') {
      await supabase.from(TABLES.users).update({ virtual_balance: user.virtual_balance - orderCost - brokerage }).eq('id', userId);
    } else {
      await supabase.from(TABLES.users).update({ virtual_balance: user.virtual_balance + orderCost - brokerage }).eq('id', userId);
    }

    // Create or update position
    const { data: existingPosition } = await supabase
      .from(TABLES.positions)
      .select('*')
      .eq('user_id', userId)
      .eq('instrument_id', instrumentId)
      .single();

    if (existingPosition) {
      // Update position
      if (side === 'buy') {
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = (existingPosition.average_price * existingPosition.quantity + executionPrice * quantity) / newQuantity;
        await supabase
          .from(TABLES.positions)
          .update({
            quantity: newQuantity,
            average_price: newAveragePrice,
            current_price: executionPrice,
          })
          .eq('id', existingPosition.id);
      } else {
        const newQuantity = existingPosition.quantity - quantity;
        if (newQuantity > 0) {
          await supabase
            .from(TABLES.positions)
            .update({
              quantity: newQuantity,
              current_price: executionPrice,
            })
            .eq('id', existingPosition.id);
        } else {
          await supabase.from(TABLES.positions).delete().eq('id', existingPosition.id);
        }
      }
    } else if (side === 'buy') {
      // Create new position
      await supabase.from(TABLES.positions).insert({
        user_id: userId,
        instrument_id: instrumentId,
        quantity,
        average_price: executionPrice,
        current_price: executionPrice,
      });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.data.session.user.id;

    const { data: orders, error } = await supabase
      .from(TABLES.orders)
      .select('*, instruments(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

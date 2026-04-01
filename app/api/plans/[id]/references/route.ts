import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: planId } = await params;

    const { data: references, error } = await supabase
      .from('plan_references')
      .select('*')
      .eq('plan_id', planId)
      .order('order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ 
      references: references.map(ref => ({
        id: ref.id,
        planId: ref.plan_id,
        title: ref.title,
        content: ref.content,
        order: ref.order,
        createdAt: ref.created_at,
        updatedAt: ref.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching references:', error);
    return NextResponse.json(
      { error: 'Failed to fetch references' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: planId } = await params;
    const body = await request.json();

    const { data: reference, error } = await supabase
      .from('plan_references')
      .insert({
        plan_id: planId,
        title: body.title,
        content: body.content,
        order: body.order || 0
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      reference: {
        id: reference.id,
        planId: reference.plan_id,
        title: reference.title,
        content: reference.content,
        order: reference.order,
        createdAt: reference.created_at,
        updatedAt: reference.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating reference:', error);
    return NextResponse.json(
      { error: 'Failed to create reference' },
      { status: 500 }
    );
  }
}

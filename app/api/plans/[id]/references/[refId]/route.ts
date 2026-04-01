import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { refId } = await params;
    const body = await request.json();

    const { data: reference, error } = await supabase
      .from('plan_references')
      .update({
        title: body.title,
        content: body.content,
        updated_at: new Date().toISOString()
      })
      .eq('id', refId)
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
    console.error('Error updating reference:', error);
    return NextResponse.json(
      { error: 'Failed to update reference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { refId } = await params;

    const { error } = await supabase
      .from('plan_references')
      .delete()
      .eq('id', refId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reference:', error);
    return NextResponse.json(
      { error: 'Failed to delete reference' },
      { status: 500 }
    );
  }
}

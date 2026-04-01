import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    await params; // Await params even if not used to satisfy Next.js 16
    const body = await request.json();
    const { references } = body;

    for (const ref of references) {
      await supabase
        .from('plan_references')
        .update({ order: ref.order })
        .eq('id', ref.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering references:', error);
    return NextResponse.json(
      { error: 'Failed to reorder references' },
      { status: 500 }
    );
  }
}

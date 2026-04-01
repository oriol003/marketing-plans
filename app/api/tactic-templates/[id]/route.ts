import { NextRequest, NextResponse } from 'next/server';
import { updateTacticTemplate, deleteTacticTemplate } from '@/lib/db/tactic-templates';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const template = await updateTacticTemplate(id, body);
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating tactic template:', error);
    return NextResponse.json(
      { error: 'Failed to update tactic template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTacticTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tactic template:', error);
    return NextResponse.json(
      { error: 'Failed to delete tactic template' },
      { status: 500 }
    );
  }
}

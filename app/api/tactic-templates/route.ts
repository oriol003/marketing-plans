import { NextRequest, NextResponse } from 'next/server';
import { getTacticTemplates, createTacticTemplate } from '@/lib/db/tactic-templates';

export async function GET() {
  try {
    const templates = await getTacticTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching tactic templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tactic templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const template = await createTacticTemplate(body);
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error creating tactic template:', error);
    return NextResponse.json(
      { error: 'Failed to create tactic template' },
      { status: 500 }
    );
  }
}

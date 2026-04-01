import { getPlan } from '@/lib/db/plans';
import { PlanEditorWrapper } from '@/components/plan-editor-wrapper';
import { notFound } from 'next/navigation';

export default async function PlanPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  try {
    const { id } = await params;
    const plan = await getPlan(id);

    if (!plan) {
      notFound();
    }

    return <PlanEditorWrapper plan={plan} />;
  } catch (error) {
    console.error('[v0] Error loading plan page:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Plan</h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <a href="/plans" className="text-primary hover:underline">
            Return to Plans
          </a>
        </div>
      </div>
    );
  }
}

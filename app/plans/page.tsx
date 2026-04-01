import { getPlans } from '@/lib/db/plans';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Plus, FileText, Calendar, User, Blocks } from 'lucide-react';
import { PlanCard } from '@/components/plan-card';

export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Marketing Plans</h1>
            <p className="mt-2 text-lg text-slate-600">
              Manage and create professional marketing proposals
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/templates">
              <Button size="lg" variant="outline" className="gap-2">
                <Blocks className="h-5 w-5" />
                Manage Templates
              </Button>
            </Link>
            <Link href="/plans/create">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                New Plan
              </Button>
            </Link>
          </div>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">
              No marketing plans yet
            </h2>
            <p className="text-slate-500 mb-6 max-w-md">
              Get started by creating your first marketing plan. Use our AI-powered wizard to generate professional proposals in minutes.
            </p>
            <Link href="/plans/create">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Create Your First Plan
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

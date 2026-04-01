"use client"

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { FileText, Calendar, User, MoreVertical, Trash2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { MarketingPlan } from '@/lib/types';

interface PlanCardProps {
  plan: MarketingPlan;
}

export function PlanCard({ plan }: PlanCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete plan');

      toast({
        title: 'Plan deleted',
        description: 'The marketing plan has been deleted successfully.'
      });

      router.refresh();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete the plan. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card className="group h-full relative overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.02] duration-300">
        {/* Decorative gradient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#FF6B35]/20 to-[#FF8C5E]/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#00A7B5]/20 to-[#00C7D9]/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />
        
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#00A7B5] via-[#FF6B35] to-[#FF6B35]" />

        {/* Three dots menu */}
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/plans/${plan.id}`} className="cursor-pointer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Plan
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link href={`/plans/${plan.id}`}>
          <div className="relative flex flex-col h-full p-6 bg-gradient-to-br from-white via-orange-50/30 to-teal-50/30">
            {/* Badge */}
            <div className="mb-4">
              <div className="inline-block px-3 py-1.5 bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-md">
                <span className="text-xs font-bold tracking-widest uppercase text-[#FF6B35]">
                  Marketing Plan
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="mb-3">
              <h3 className="text-2xl font-bold text-slate-900 group-hover:text-[#FF6B35] transition-colors line-clamp-2 pr-8 leading-tight">
                {plan.title}
              </h3>
              <div className="w-16 h-1 bg-[#00A7B5] rounded-full mt-3" />
            </div>

            {/* Primary goals */}
            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-6">
              {plan.objective}
            </p>

            {/* Metadata */}
            <div className="mt-auto space-y-3 pt-6 border-t border-slate-200/60">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-full bg-[#00A7B5]/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-[#00A7B5]" />
                </div>
                <span className="font-medium">{plan.clientName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-full bg-[#FF6B35]/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-[#FF6B35]" />
                </div>
                <span>{plan.blocks.length} blocks</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-slate-600" />
                </div>
                <span>
                  {new Date(plan.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Bottom color bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
          <div className="flex-1 bg-[#00A7B5]" />
          <div className="flex-[1.5] bg-[#FF6B35]" />
          <div className="flex-1 bg-gray-900" />
        </div>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Marketing Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{plan.title}"? This action cannot be undone and will permanently remove the plan and all its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

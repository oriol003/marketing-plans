"use client"

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { usePlanStore } from '@/lib/store';
import { TextBlock } from './blocks/text-block';
import { TacticBlock } from './blocks/tactic-block';
import { TableBlock } from './blocks/table-block';
import { TimelineBlock } from './blocks/timeline-block';
import { SectionBlock } from './blocks/section-block';
import { CoverBlock } from './blocks/cover-block';
import { AudienceBlock } from './blocks/audience-block';
import { BudgetSummaryBlock } from './blocks/budget-summary-block';
import { ReferencesPanel } from './references-panel';
import { BlocksSidebar } from './blocks-sidebar';
import { Button } from '@/components/ui/button';
import { Download, Save, Sparkles, TableIcon, Calendar, FileText, Plus, Folder, Users, BookOpen, DollarSign, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Block, TacticTemplate } from '@/lib/types';
import { tacticCategories } from '@/lib/tactic-templates';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import * as LucideIcons from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PlanEditor() {
  const { currentPlan, reorderBlocks, addBlock, insertBlockAfter, updateBlock, removeBlock, updatePlan } = usePlanStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState<'text' | 'tactic' | 'table' | 'timeline' | 'section' | 'cover' | 'audience' | null>(null);
  const [addingToParentId, setAddingToParentId] = useState<string | undefined>();
  const [tacticTemplates, setTacticTemplates] = useState<TacticTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TacticTemplate | null>(null);
  const [customTacticName, setCustomTacticName] = useState('');
  const [customTacticDescription, setCustomTacticDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | undefined>();
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const router = useRouter();
  const { toast } = useToast();
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | undefined>();
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [templateSearch, setTemplateSearch] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const blocks = currentPlan?.blocks || [];

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    reorderBlocks(result.source.index, result.destination.index);
  };

  const handleBlockClick = (blockId: string) => {
    const element = blockRefs.current[blockId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveBlockId(blockId);
    }
  };

  const handleAddTextBlock = (overrideParentId?: string, overrideAfterBlockId?: string) => {
    const parentId = overrideParentId !== undefined ? overrideParentId : addingToParentId;
    const afterId = overrideAfterBlockId !== undefined ? overrideAfterBlockId : insertAfterBlockId;
    const newBlock = {
      id: crypto.randomUUID(),
      type: 'text' as const,
      title: 'New Section',
      content: 'Add your content here...',
      order: blocks.length,
      parentId
    };

    insertBlockAfter(newBlock, afterId);

    setIsAddDialogOpen(false);
    setSelectedBlockType(null);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);
  };

  const handleAddSectionBlock = (overrideAfterBlockId?: string) => {
    const afterId = overrideAfterBlockId !== undefined ? overrideAfterBlockId : insertAfterBlockId;
    const newBlock = {
      id: crypto.randomUUID(),
      type: 'section' as const,
      title: 'New Section',
      description: '',
      icon: 'Folder',
      order: blocks.length,
      children: []
    };

    insertBlockAfter(newBlock, afterId);

    setIsAddDialogOpen(false);
    setSelectedBlockType(null);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);
  };

  const handleAddTacticBlock = async () => {
    if (!currentPlan) return;
    
    const tacticName = selectedTemplate?.name || customTacticName;
    const tacticDescription = selectedTemplate?.description || customTacticDescription;
    
    if (!tacticName || !tacticDescription) {
      toast({
        title: 'Missing information',
        description: 'Please select a tactic or fill in custom tactic details.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);

    const newBlockId = crypto.randomUUID();
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const placeholderBlock: Block = {
      id: newBlockId,
      type: 'tactic',
      tacticId: selectedTemplate?.id || '',
      title: tacticName,
      description: tacticDescription,
      content: 'Generating content...',
      hours: selectedTemplate?.defaultHours || 5,
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      icon: selectedTemplate?.icon || 'Package',
      order: blocks.length,
      parentId: addingToParentId
    };

    console.log('[v0] Adding tactic block after:', insertAfterBlockId, 'parentId:', addingToParentId);
    insertBlockAfter(placeholderBlock, insertAfterBlockId);
    
    setIsAddDialogOpen(false);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);

    try {
      const response = await fetch(`/api/plans/${currentPlan.id}/generate-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tacticId: selectedTemplate?.id || '',
          tacticName,
          tacticDescription,
          tacticWhat: selectedTemplate?.what || '',
          tacticWhy: selectedTemplate?.why || '',
          tacticHow: selectedTemplate?.how || '',
          clientName: currentPlan.clientName,
          objective: currentPlan.objective
        })
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const { content } = await response.json();
      
      updateBlock(newBlockId, { content });

      toast({
        title: 'Tactic added',
        description: 'Content has been generated successfully.'
      });
    } catch (error) {
      console.error('Error generating content:', error);
      updateBlock(newBlockId, { 
        content: 'Failed to generate content. Please edit manually.' 
      });
      toast({
        title: 'Generation error',
        description: 'Content generation failed. You can edit the block manually.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTableBlock = () => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: 'table' as const,
      title: 'Production Hours Summary',
      order: blocks.length,
      parentId: addingToParentId
    };
    
    console.log('[v0] Adding table block after:', insertAfterBlockId, 'parentId:', addingToParentId);
    insertBlockAfter(newBlock, insertAfterBlockId);
    
    setIsAddDialogOpen(false);
    setSelectedBlockType(null);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);
  };

  const handleAddTimelineBlock = () => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: 'timeline' as const,
      title: 'Project Timeline',
      order: blocks.length,
      parentId: addingToParentId
    };
    
    console.log('[v0] Adding timeline block after:', insertAfterBlockId, 'parentId:', addingToParentId);
    insertBlockAfter(newBlock, insertAfterBlockId);
    
    setIsAddDialogOpen(false);
    setSelectedBlockType(null);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);
  };

  const handleAddBudgetSummaryBlock = () => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: 'budget-summary' as const,
      title: 'Budget Overview',
      order: blocks.length,
      parentId: addingToParentId
    };
    insertBlockAfter(newBlock, insertAfterBlockId);
    setIsAddDialogOpen(false);
    setSelectedBlockType(null);
    setAddingToParentId(undefined);
    setInsertAfterBlockId(undefined);
  };

  const handleOpenDialog = async (parentId?: string, afterBlockId?: string) => {
    setAddingToParentId(parentId);
    setInsertAfterBlockId(afterBlockId);
    setIsAddDialogOpen(true);
    setSelectedBlockType(null);
    setSelectedTemplate(null);
    setCustomTacticName('');
    setCustomTacticDescription('');
    setTemplateCategory('All');
    setTemplateSearch('');

    console.log('[v0] Opening dialog - parentId:', parentId, 'afterBlockId:', afterBlockId);
    
    try {
      const response = await fetch('/api/tactic-templates');
      if (response.ok) {
        const { templates } = await response.json();
        setTacticTemplates(templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleSavePlan = async (silent = false) => {
    if (!currentPlan) {
      console.log('[v0] Cannot save - no current plan');
      return;
    }
    
    console.log('[v0] handleSavePlan called - silent:', silent);
    console.log('[v0] Saving plan:', currentPlan.id, 'version:', currentPlan.version);
    console.log('[v0] Total blocks to save:', blocks.length);
    
    setIsSaving(true);
    
    try {
      const savePayload = {
        title: currentPlan.title,
        objective: currentPlan.objective,
        clientName: currentPlan.clientName,
        logo: currentPlan.logo,
        version: currentPlan.version,
        blocks: blocks
      };
      
      console.log('[v0] Sending save request...');
      
      const response = await fetch(`/api/plans/${currentPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload)
      });

      console.log('[v0] Save response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[v0] Save failed with error:', errorData);
        
        if (errorData.error?.includes('CONFLICT')) {
          toast({
            title: 'Conflict Detected',
            description: 'This plan was modified in another tab. Refreshing to get the latest version...',
            variant: 'destructive'
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to save plan');
      }

      const result = await response.json();
      console.log('[v0] Save successful, returned plan has', result.plan?.blocks?.length || 0, 'blocks');
      console.log('[v0] New version:', result.plan?.version);

      updatePlan({ version: result.plan.version });

      if (!silent) {
        toast({
          title: 'Plan saved',
          description: 'Your changes have been saved successfully.'
        });
      }
      
      router.refresh();
    } catch (error) {
      console.error('[v0] Error saving plan:', error);
      
      if (error instanceof Error && !error.message.includes('CONFLICT')) {
        toast({
          title: 'Save failed',
          description: error.message || 'Failed to save your changes. Please try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsSaving(false);
      console.log('[v0] Save operation completed');
    }
  };

  // Block types available when adding INSIDE a section
  const sectionChildBlockTypes = [
    {
      id: 'text',
      title: 'Text Block',
      description: 'Content, descriptions, summaries, or any written information',
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      action: () => handleAddTextBlock(),
    },
    {
      id: 'tactic',
      title: 'Marketing Tactic',
      description: 'AI-powered tactic with hours, dates, and auto-generated strategy',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500',
      action: () => setSelectedBlockType('tactic'),
    },
    {
      id: 'audience',
      title: 'Target Audience',
      description: 'Define strategic personas with demographics and motivations',
      icon: Users,
      color: 'from-teal-500 to-cyan-500',
      action: () => {
        const newBlock = {
          id: crypto.randomUUID(),
          type: 'audience' as const,
          title: 'Target Audience',
          description: 'Strategic personas defining the ideal high-net-worth buyer.',
          audiences: [],
          order: blocks.length,
          parentId: addingToParentId,
        };
        insertBlockAfter(newBlock, insertAfterBlockId);
        setIsAddDialogOpen(false);
        setSelectedBlockType(null);
        setAddingToParentId(undefined);
        setInsertAfterBlockId(undefined);
      },
    },
    {
      id: 'table',
      title: 'Hours Summary',
      description: 'Automatically calculated table of production hours by tactic',
      icon: TableIcon,
      color: 'from-green-500 to-emerald-500',
      action: () => handleAddTableBlock(),
    },
    {
      id: 'timeline',
      title: 'Timeline Chart',
      description: 'Gantt-style visualization of your project schedule',
      icon: Calendar,
      color: 'from-orange-500 to-red-500',
      action: () => handleAddTimelineBlock(),
    },
    {
      id: 'budget-summary',
      title: 'Budget Overview',
      description: 'Aggregated view of all monthly budgets and scenario tiers',
      icon: DollarSign,
      color: 'from-amber-500 to-orange-500',
      action: () => handleAddBudgetSummaryBlock(),
    },
  ];

  // Block types available at the TOP LEVEL of the plan
  const topLevelBlockTypes = [
    {
      id: 'cover',
      title: 'Cover Page',
      description: 'Professional cover page with branding and project details',
      icon: FileText,
      color: 'from-slate-500 to-gray-500',
      action: () => {
        const newBlock = {
          id: crypto.randomUUID(),
          type: 'cover' as const,
          title: currentPlan!.title,
          subtitle: currentPlan!.objective,
          clientName: currentPlan!.clientName,
          executionPeriod: 'Q4 2025 — 2026',
          order: blocks.length,
          parentId: addingToParentId,
        };
        insertBlockAfter(newBlock, insertAfterBlockId);
        setIsAddDialogOpen(false);
        setSelectedBlockType(null);
        setAddingToParentId(undefined);
        setInsertAfterBlockId(undefined);
      },
    },
    {
      id: 'section',
      title: 'Section',
      description: 'Group related blocks — tactics, text, audience, tables, and more',
      icon: Folder,
      color: 'from-indigo-500 to-purple-500',
      action: () => handleAddSectionBlock(),
    },
    // Plan-wide summary blocks also allowed at top level
    {
      id: 'table',
      title: 'Hours Summary',
      description: 'Automatically calculated table of production hours by tactic',
      icon: TableIcon,
      color: 'from-green-500 to-emerald-500',
      action: () => handleAddTableBlock(),
    },
    {
      id: 'timeline',
      title: 'Timeline Chart',
      description: 'Gantt-style visualization of your project schedule',
      icon: Calendar,
      color: 'from-orange-500 to-red-500',
      action: () => handleAddTimelineBlock(),
    },
    {
      id: 'budget-summary',
      title: 'Budget Overview',
      description: 'Aggregated view of all monthly budgets and scenario tiers',
      icon: DollarSign,
      color: 'from-amber-500 to-orange-500',
      action: () => handleAddBudgetSummaryBlock(),
    },
  ];

  // Pick the right list based on context
  const blockTypes = addingToParentId ? sectionChildBlockTypes : topLevelBlockTypes;

  const renderBlock = (block: Block, index: number, parentIndex?: string, parentColor?: string, groupPosition?: 'first' | 'middle' | 'last' | 'solo') => {
    const draggableId = parentIndex ? `${parentIndex}-${block.id}` : block.id;
    
    let sectionNumber = '';
    let sectionColor = parentColor || '#1DB5C4'; // Strategic Teal
    if (block.type === 'section') {
      sectionColor = block.color || '#00A7B5';
      if (!block.parentId) {
        const sectionIndex = blocks.filter(b => b.type === 'section' && !b.parentId).indexOf(block);
        sectionNumber = String(sectionIndex + 1).padStart(2, '0');
      }
    }
    
    // Consistent paper system:
    // - Top-level blocks: wrapped in a white paper container with shadow
    // - Child blocks (inside sections): no paper, they inherit the section's paper
    // - Top-level text blocks adjacent to other text blocks: grouped into one paper (handled externally)
    const isTopLevel = !parentIndex;
    const isCoverBlock = block.type === 'cover';
    // Text blocks that are children of a section don't need their own paper
    const isChildTextBlock = !isTopLevel && block.type === 'text';

    const paperShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)';

    // Render the actual block content (no wrapper)
    const renderBlockContent = (dragHandleProps: any) => {
      switch (block.type) {
        case 'cover':
          return <CoverBlock block={block} dragHandleProps={dragHandleProps} logo={currentPlan?.logo} />;
        case 'section':
          const isFirstSection = !parentIndex && blocks.filter(b => b.type === 'section').indexOf(block) === 0;
          return (
            <SectionBlock
              block={{ ...block, sectionNumber }}
              dragHandleProps={dragHandleProps}
              onUpdate={updateBlock}
              onDelete={removeBlock}
              onAddChild={(parentId) => handleOpenDialog(parentId)}
              isFirst={isFirstSection}
            >
              {block.children && block.children.length > 0 && (
                <div className="space-y-0">
                  {block.children.map((child, childIndex) =>
                    renderBlock(child, childIndex, block.id, sectionColor)
                  )}
                </div>
              )}
            </SectionBlock>
          );
        case 'audience':
          return <AudienceBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
        case 'text':
          return <TextBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
        case 'table':
          return <TableBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
        case 'timeline':
          return <TimelineBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
        case 'budget-summary':
          return <BudgetSummaryBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
        default:
          return <TacticBlock block={block} dragHandleProps={dragHandleProps} accentColor={sectionColor} />;
      }
    };

    // Grouped text blocks (middle/last) need negative margin to collapse space-y-12 gap
    const isGroupedContinuation = groupPosition === 'middle' || groupPosition === 'last';

    return (
      <div key={block.id} style={isGroupedContinuation ? { marginTop: '-3rem' } : undefined}>
        <div className="group/insert relative h-0 flex items-center justify-center -mb-2 z-10">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity">
            {isTopLevel ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const prevId = index > 0 ? blocks[index - 1]?.id : undefined;
                    handleAddSectionBlock(prevId);
                  }}
                  className="h-7 px-3 gap-1.5 bg-background shadow-sm border-dashed hover:border-primary hover:bg-primary/5"
                >
                  <Folder className="w-3 h-3" />
                  <span className="text-xs">Add Section</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const prevId = index > 0 ? blocks[index - 1]?.id : undefined;
                    handleOpenDialog(undefined, prevId);
                  }}
                  className="h-7 px-2 text-muted-foreground/50 hover:text-foreground"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="text-[10px] ml-1">More</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => { const prevId = index > 0 ? blocks[index - 1]?.id : undefined; handleAddTextBlock(block.parentId, prevId); }} className="h-6 px-2 gap-1 bg-background shadow-sm border-dashed text-[10px]">
                  <FileText className="w-3 h-3" /> Text
                </Button>
                <Button variant="outline" size="sm" onClick={() => { const prevId = index > 0 ? blocks[index - 1]?.id : undefined; handleOpenDialog(block.parentId, prevId); }} className="h-6 px-2 gap-1 bg-background shadow-sm border-dashed text-[10px]">
                  <Plus className="w-3 h-3" /> More
                </Button>
              </div>
            )}
          </div>
        </div>

        <Draggable draggableId={draggableId} index={index}>
          {(provided, snapshot) => (
            <div
              id={block.id}
              ref={(el) => {
                provided.innerRef(el);
                blockRefs.current[block.id] = el;
              }}
              {...provided.draggableProps}
              style={{
                ...provided.draggableProps.style,
                opacity: snapshot.isDragging ? 0.8 : 1
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isTopLevel ? (
                  // Every top-level block gets its own paper
                  // Grouped text blocks share visual paper — first gets top radius, last gets bottom radius
                  <div
                    className={`bg-white ${isCoverBlock ? 'rounded-none overflow-hidden' : `overflow-hidden ${
                      groupPosition === 'first' ? 'rounded-t-sm rounded-b-none border-b border-border/20 px-10 sm:px-16 py-10' :
                      groupPosition === 'middle' ? 'rounded-none border-b border-border/20 px-10 sm:px-16 py-10' :
                      groupPosition === 'last' ? 'rounded-b-sm rounded-t-none px-10 sm:px-16 py-10' :
                      `rounded-sm ${block.type === 'section' && block.coverImage ? 'px-10 sm:px-16 pt-0 pb-10' : 'px-10 sm:px-16 py-10'}`
                    }`}`}
                    style={{ boxShadow: isCoverBlock ? 'none' : (groupPosition === 'first' || groupPosition === 'solo' || !groupPosition ? paperShadow : groupPosition === 'last' ? paperShadow : 'none') }}
                  >
                    {renderBlockContent(provided.dragHandleProps)}
                  </div>
                ) : (
                  // Child blocks: no paper wrapper, inherit parent's
                  renderBlockContent(provided.dragHandleProps)
                )}
              </motion.div>
            </div>
          )}
        </Draggable>

        <div className="group/insert relative h-0 flex items-center justify-center -mt-2 z-10">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity">
            {isTopLevel ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSectionBlock(block.id)}
                  className="h-7 px-3 gap-1.5 bg-background shadow-sm border-dashed hover:border-primary hover:bg-primary/5"
                >
                  <Folder className="w-3 h-3" />
                  <span className="text-xs">Add Section</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDialog(undefined, block.id)}
                  className="h-7 px-2 text-muted-foreground/50 hover:text-foreground"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="text-[10px] ml-1">More</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => handleAddTextBlock(block.parentId, block.id)} className="h-6 px-2 gap-1 bg-background shadow-sm border-dashed text-[10px]">
                  <FileText className="w-3 h-3" /> Text
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(block.parentId, block.id)} className="h-6 px-2 gap-1 bg-background shadow-sm border-dashed text-[10px]">
                  <Plus className="w-3 h-3" /> More
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleTitleClick = () => {
    if (currentPlan) {
      setEditedTitle(currentPlan.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    if (currentPlan && editedTitle.trim()) {
      updatePlan({ title: editedTitle.trim() });
      setIsEditingTitle(false);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  if (!currentPlan || !blocks || blocks.length === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <BlocksSidebar
        onAddBlock={() => handleOpenDialog()}
        activeBlockId={activeBlockId}
        onBlockClick={handleBlockClick}
      />

      <div className="flex-1 overflow-y-auto flex flex-col" style={{ backgroundColor: '#F3F5F7' }}>
        <div className="max-w-5xl w-full mx-auto py-10 px-4 sm:px-8">

          {/* Title header when no cover block */}
          {!blocks.some(b => b.type === 'cover') && (
            <div className="bg-white rounded-sm px-10 sm:px-16 py-10 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)' }}>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={titleInputRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleTitleSave}
                    className="text-3xl font-bold tracking-tight h-auto py-2 px-3 border-2 border-primary"
                  />
                </div>
              ) : (
                <h1
                  onClick={handleTitleClick}
                  className="text-3xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors rounded px-2 -mx-2 py-1 hover:bg-muted/50"
                  title="Click to edit title"
                >
                  {currentPlan?.title}
                </h1>
              )}
              <p className="text-muted-foreground mt-2">{currentPlan?.clientName} • {blocks.length} Sections</p>
            </div>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="plan-blocks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-12"
                >
                  {blocks.length > 0 && (
                    <div className="group/insert relative h-0 flex items-center justify-center mb-4 z-10">
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(undefined, undefined)}
                          className="h-7 px-3 gap-1.5 bg-background shadow-sm border-dashed hover:border-primary hover:bg-primary/5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-xs">Add block at start</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {blocks.map((block, index) => {
                    // Detect consecutive top-level text blocks and group them visually
                    const isText = block.type === 'text';
                    const prevIsText = index > 0 && blocks[index - 1].type === 'text';
                    const nextIsText = index < blocks.length - 1 && blocks[index + 1].type === 'text';

                    let groupPos: 'first' | 'middle' | 'last' | 'solo' | undefined;
                    if (isText && nextIsText && !prevIsText) groupPos = 'first';
                    else if (isText && prevIsText && nextIsText) groupPos = 'middle';
                    else if (isText && prevIsText && !nextIsText) groupPos = 'last';
                    else if (isText && !prevIsText && !nextIsText) groupPos = undefined; // solo text, normal paper

                    return renderBlock(block, index, undefined, undefined, groupPos);
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setSelectedBlockType(null);
          setAddingToParentId(undefined);
          setInsertAfterBlockId(undefined);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
          <div className="p-6 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedBlockType === 'tactic' ? 'Configure Marketing Tactic' : 'Add New Block'}
              </DialogTitle>
              <DialogDescription>
                {addingToParentId && <span className="font-medium text-primary">Adding to section • </span>}
                {selectedBlockType === 'tactic' 
                  ? 'Select a template or create a custom tactic with AI-generated content'
                  : 'Choose the type of content block you want to add to your plan'
                }
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <AnimatePresence mode="wait">
              {!selectedBlockType ? (
                <motion.div
                  key="block-selection"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-6"
                >
                  <div className="grid grid-cols-3 gap-4">
                    {blockTypes.map((blockType) => {
                      const Icon = blockType.icon;
                      return (
                        <motion.button
                          key={blockType.id}
                          onClick={blockType.action}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="group relative overflow-hidden rounded-xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${blockType.color} opacity-0 transition-opacity group-hover:opacity-5`} />
                          
                          <div className="relative space-y-3">
                            <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${blockType.color}`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            
                            <div>
                              <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                {blockType.title}
                              </h3>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {blockType.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                              <Plus className="w-3 h-3" />
                              <span>Click to add</span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : selectedBlockType === 'tactic' ? (
                <motion.div
                  key="tactic-configuration"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-6 space-y-6"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBlockType(null)}
                    className="mb-2"
                  >
                    ← Back to block types
                  </Button>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-semibold">Select from Templates</Label>
                      <p className="text-sm text-muted-foreground mb-2">Choose a pre-configured marketing tactic</p>

                      <Input
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="mb-2"
                      />

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <button
                          onClick={() => setTemplateCategory('All')}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            templateCategory === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          All
                        </button>
                        {tacticCategories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setTemplateCategory(cat)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              templateCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <ScrollArea className="h-[300px] pr-2">
                        <div className="grid gap-2">
                          {tacticTemplates
                            .filter(t => templateCategory === 'All' || t.category === templateCategory)
                            .filter(t => !templateSearch.trim() ||
                              t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                              t.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
                              t.category.toLowerCase().includes(templateSearch.toLowerCase())
                            )
                            .map(template => {
                              const IconComponent = template.icon
                                ? (LucideIcons as any)[template.icon] || LucideIcons.Package
                                : LucideIcons.Package;
                              const isSelected = selectedTemplate?.id === template.id;

                              return (
                                <motion.button
                                  key={template.id}
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setCustomTacticName('');
                                    setCustomTacticDescription('');
                                  }}
                                  whileHover={{ scale: 1.01 }}
                                  className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all text-left ${
                                    isSelected
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border bg-card hover:border-muted-foreground/30'
                                  }`}
                                >
                                  <div className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <IconComponent className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{template.name}</p>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                        {template.defaultHours}h
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      {template.description}
                                    </p>
                                  </div>
                                </motion.button>
                              );
                            })}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or create custom</span>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                      <div>
                        <Label htmlFor="custom-name">Custom Tactic Name</Label>
                        <Input
                          id="custom-name"
                          value={customTacticName}
                          onChange={(e) => {
                            setCustomTacticName(e.target.value);
                            if (e.target.value) setSelectedTemplate(null);
                          }}
                          placeholder="e.g., Influencer Partnership Campaign"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="custom-description">Description / Context</Label>
                        <Textarea
                          id="custom-description"
                          value={customTacticDescription}
                          onChange={(e) => {
                            setCustomTacticDescription(e.target.value);
                            if (e.target.value) setSelectedTemplate(null);
                          }}
                          placeholder="Describe the goals, approach, and deliverables for this custom tactic..."
                          rows={4}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleAddTacticBlock} 
                      disabled={isGenerating || (!selectedTemplate && (!customTacticName || !customTacticDescription))}
                      className="w-full h-11 gap-2 text-base"
                      size="lg"
                    >
                      <Sparkles className="w-5 h-5" />
                      {isGenerating ? 'Generating Content...' : 'Generate & Add Tactic'}
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

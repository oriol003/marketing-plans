import { usePlanStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, FileText, Calendar, TableIcon, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Block } from '@/lib/types';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BlocksSidebarProps {
  onAddBlock: () => void;
  activeBlockId?: string;
  onBlockClick: (blockId: string) => void;
}

export function BlocksSidebar({ onAddBlock, activeBlockId, onBlockClick }: BlocksSidebarProps) {
  const { currentPlan, reorderBlocks, updateBlock } = usePlanStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState('');

  const commonIcons = [
    'Package', 'Sparkles', 'Megaphone', 'Target', 'TrendingUp', 'Users', 'Mail',
    'Video', 'Image', 'MessageCircle', 'Share2', 'Heart', 'Star', 'Zap',
    'Award', 'Bell', 'Bookmark', 'Calendar', 'Camera', 'FileText', 'Gift',
    'Globe', 'Headphones', 'Home', 'Lightbulb', 'Map', 'Music', 'Newspaper',
    'Palette', 'Phone', 'Play', 'Printer', 'Radio', 'Search', 'Send',
    'Settings', 'ShoppingCart', 'Smartphone', 'Speaker', 'Tag', 'Tv',
    'Upload', 'Volume2', 'Wifi', 'Youtube', 'Instagram', 'Facebook',
    'Twitter', 'Linkedin', 'Github', 'Chrome', 'Monitor', 'Clipboard'
  ];

  const filteredIcons = iconSearch.trim()
    ? commonIcons.filter(name => name.toLowerCase().includes(iconSearch.toLowerCase()))
    : commonIcons;

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    reorderBlocks(result.source.index, result.destination.index);
  };

  const handleIconClick = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlockId(blockId);
    setIconPickerOpen(true);
    setIconSearch('');
  };

  const handleIconSelect = (iconName: string) => {
    if (selectedBlockId) {
      updateBlock(selectedBlockId, { icon: iconName });
      setIconPickerOpen(false);
      setSelectedBlockId(null);
    }
  };

  const getBlockIcon = (block: Block) => {
    if (block.type === 'text') {
      return FileText;
    } else if (block.type === 'table') {
      return TableIcon;
    } else if (block.type === 'timeline') {
      return Calendar;
    } else if (block.type === 'section') {
      const iconName = (block as any).icon;
      return iconName ? ((LucideIcons as any)[iconName] || Folder) : Folder;
    } else if (block.type === 'tactic' && (block as any).icon) {
      const IconComponent = (LucideIcons as any)[(block as any).icon];
      return IconComponent || LucideIcons.Package;
    }
    return LucideIcons.Package;
  };

  const getBlockTitle = (block: Block) => {
    return block.title || 'Untitled';
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const renderBlockItem = (block: Block, index: number, depth: number = 0) => {
    const Icon = getBlockIcon(block);
    const hasChildren = block.children && block.children.length > 0;
    const isExpanded = expandedSections.has(block.id);
    const isSection = block.type === 'section';
    const canChangeIcon = block.type === 'section' || block.type === 'tactic';

    return (
      <Draggable key={block.id} draggableId={block.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
          >
            <div
              onClick={() => onBlockClick(block.id)}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                activeBlockId === block.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
                snapshot.isDragging && "shadow-lg"
              )}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              <div {...provided.dragHandleProps} className="shrink-0 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {isSection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection(block.id);
                  }}
                  className="shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              {!isSection && <div className="w-4" />}
              <button
                onClick={(e) => canChangeIcon ? handleIconClick(block.id, e) : undefined}
                className={cn(
                  "shrink-0 p-0.5 rounded transition-colors",
                  canChangeIcon && "hover:bg-background/50 cursor-pointer"
                )}
                title={canChangeIcon ? "Click to change icon" : undefined}
              >
                <Icon className="w-4 h-4" />
              </button>
              <span className="truncate flex-1">{getBlockTitle(block)}</span>
            </div>

            {isSection && hasChildren && isExpanded && (
              <div>
                {block.children!.map((child, childIndex) => 
                  renderBlockItem(child, childIndex, depth + 1)
                )}
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  if (!currentPlan) return null;

  return (
    <>
      <div className="w-64 h-full border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Sections
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {currentPlan.blocks.length} blocks
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="blocks-sidebar">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex-1 overflow-y-auto p-2 space-y-1"
              >
                {currentPlan.blocks.map((block, index) => renderBlockItem(block, index))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="p-4 border-t">
          <Button
            onClick={onAddBlock}
            variant="outline"
            className="w-full gap-2 border-dashed"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </Button>
        </div>
      </div>

      <Dialog open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose an Icon</DialogTitle>
            <DialogDescription>
              Select an icon for your block. Click any icon to apply it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Search icons..."
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              className="w-full"
            />

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="grid grid-cols-8 gap-2">
                {filteredIcons.map((iconName) => {
                  const IconComponent = (LucideIcons as any)[iconName];
                  if (!IconComponent) return null;
                  
                  return (
                    <button
                      key={iconName}
                      onClick={() => handleIconSelect(iconName)}
                      className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors group"
                      title={iconName}
                    >
                      <IconComponent className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground truncate w-full text-center">
                        {iconName}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {filteredIcons.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No icons found
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

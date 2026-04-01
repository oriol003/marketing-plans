"use client"

import { usePlanStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  GripVertical,
  Plus,
  Trash2,
  Sparkles,
  FileText,
  TableIcon,
  Calendar,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Loader2,
  Zap,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsDownUp,
  ChevronsUpDown,
  Package,
} from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import type { Block, TacticBlock, TacticTemplate } from "@/lib/types"
import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import * as LucideIcons from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { tacticCategories } from "@/lib/tactic-templates"

// Context for expand/collapse all
const OutlineContext = createContext<{
  globalExpanded: boolean | null // null = individual control, true/false = forced
  resetGlobal: () => void
}>({ globalExpanded: null, resetGlobal: () => {} })

// Helper function to flatten blocks
const getAllBlocksFlattened = (blocks: Block[]): Block[] => {
  const result: Block[] = []

  const traverse = (blockList: Block[]) => {
    for (const block of blockList) {
      result.push(block)
      if (block.children && block.children.length > 0) {
        traverse(block.children)
      }
    }
  }

  traverse(blocks)
  return result
}

// ─────────────────────────────────────────────
// Tactic Drawer (left panel)
// ─────────────────────────────────────────────
function TacticDrawer({
  templates,
  isLoading,
  onAddTactic,
}: {
  templates: TacticTemplate[]
  isLoading: boolean
  onAddTactic: (template: TacticTemplate) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(tacticCategories))

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const filteredTemplates = searchQuery.trim()
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : templates

  // Group by category
  const grouped = tacticCategories
    .map((cat) => ({
      category: cat,
      tactics: filteredTemplates.filter((t) => t.category === cat),
    }))
    .filter((g) => g.tactics.length > 0)

  return (
    <div className="w-[280px] shrink-0 border-r bg-muted/30 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tactic Templates</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tactics..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {searchQuery ? "No tactics match your search" : "No templates available"}
          </div>
        ) : (
          <div className="py-1">
            {grouped.map((group) => (
              <div key={group.category}>
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {expandedCategories.has(group.category) ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{group.category}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{group.tactics.length}</span>
                </button>

                {expandedCategories.has(group.category) && (
                  <div className="pb-1">
                    {group.tactics.map((tactic) => {
                      const Icon = tactic.icon
                        ? (LucideIcons as any)[tactic.icon] || Package
                        : Package
                      return (
                        <button
                          key={tactic.id}
                          onClick={() => onAddTactic(tactic)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 pl-7 text-left hover:bg-muted/80 transition-colors group"
                          title={tactic.description}
                        >
                          <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                          <span className="text-xs truncate">{tactic.name}</span>
                          <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground shrink-0 transition-opacity" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─────────────────────────────────────────────
// Compact Outline Item
// ─────────────────────────────────────────────
function OutlineItem({
  block,
  index,
  depth = 0,
  parentId = null,
}: {
  block: Block
  index: number
  depth?: number
  parentId?: string | null
}) {
  const { updateBlock, removeBlock, addBlock, currentPlan } = usePlanStore()
  const { globalExpanded, resetGlobal } = useContext(OutlineContext)
  const [localExpanded, setLocalExpanded] = useState(false) // collapsed by default
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false)
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [references, setReferences] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showSourceContext, setShowSourceContext] = useState(false)
  const { toast } = useToast()

  // Use global override if set, otherwise use local state
  const isExpanded = globalExpanded !== null ? globalExpanded : localExpanded

  const toggleExpanded = () => {
    if (globalExpanded !== null) {
      resetGlobal()
    }
    setLocalExpanded((prev) => !prev)
  }

  useEffect(() => {
    if (isReferenceDialogOpen && currentPlan?.id) {
      setIsLoadingReferences(true)
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => {
          setReferences(data.references || [])
          setIsLoadingReferences(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching references:", err)
          setIsLoadingReferences(false)
        })
    }
  }, [isReferenceDialogOpen, currentPlan?.id])

  const getBlockIcon = (block: Block) => {
    if (block.type === "section") return <FolderOpen className="w-3.5 h-3.5" />
    if (block.type === "tactic" && "icon" in block && block.icon) {
      const Icon = (LucideIcons as any)[block.icon] || LucideIcons.Package
      return <Icon className="w-3.5 h-3.5" />
    }
    if (block.type === "table") return <TableIcon className="w-3.5 h-3.5" />
    if (block.type === "timeline") return <Calendar className="w-3.5 h-3.5" />
    return <FileText className="w-3.5 h-3.5" />
  }

  const handleRegenerateBlock = async (blockId: string, referenceIds?: string[]) => {
    const allBlocks = getAllBlocksFlattened(currentPlan?.blocks || [])
    const block = allBlocks.find((b) => b.id === blockId)

    if (!block) {
      toast({
        title: "Block not found",
        description: "Could not find the block to generate content for.",
        variant: "destructive",
      })
      return
    }

    if (block.type !== "tactic" && block.type !== "text") return

    const sourceContext = (block as any).sourceContext || ""
    if (!sourceContext.trim()) {
      toast({
        title: "No context provided",
        description: "Add source context to regenerate content.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    toast({
      title: "Generating content...",
      description: `Generating content for "${block.title}"`,
    })

    try {
      updateBlock(blockId, { content: "AI is generating content... This may take 10-30 seconds." })

      const allBlocks = getAllBlocksFlattened(currentPlan?.blocks || [])
      const currentIndex = allBlocks.findIndex((b) => b.id === blockId)

      const previousBlocks = allBlocks
        .slice(0, currentIndex)
        .filter((b) => b.content && b.content.trim())
        .slice(-3)
        .map((b) => ({ title: b.title, content: b.content }))

      const upcomingBlocks = allBlocks
        .slice(currentIndex + 1)
        .slice(0, 5)
        .map((b) => ({ title: b.title }))

      const response = await fetch(`/api/plans/${currentPlan?.id}/generate-block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type,
          tacticName: block.title,
          tacticDescription: sourceContext,
          clientName: currentPlan?.clientName,
          objective: currentPlan?.objective,
          referenceIds: referenceIds || [],
          previousBlocks,
          upcomingBlocks,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const { content } = await response.json()
      updateBlock(blockId, { content })

      toast({
        title: "Content generated",
        description: `Successfully generated content for "${block.title}"`,
      })
    } catch (error) {
      console.error("[v0] Error regenerating content:", error)
      updateBlock(blockId, { content: "" })
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleOpenReferenceDialog = () => {
    setIsReferenceDialogOpen(true)
    setSelectedReferenceIds([])
  }

  const handleConfirmGeneration = async () => {
    setIsReferenceDialogOpen(false)
    await handleRegenerateBlock(block.id, selectedReferenceIds)
  }

  const toggleReference = (refId: string) => {
    setSelectedReferenceIds((prev) => (prev.includes(refId) ? prev.filter((id) => id !== refId) : [...prev, refId]))
  }

  const handleAddChildBlock = (childType: "text" | "tactic") => {
    const baseBlock = {
      id: crypto.randomUUID(),
      order: block.children?.length || 0,
      title: childType === "text" ? "New Section" : "New Tactic",
      sourceContext: "",
      parentId: block.id,
    }

    let newBlock: Block

    if (childType === "text") {
      newBlock = {
        ...baseBlock,
        type: "text",
        content: "",
      }
    } else {
      const today = new Date()
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)

      newBlock = {
        ...baseBlock,
        type: "tactic",
        tacticId: "",
        description: "",
        content: "",
        hours: 5,
        startDate: today.toISOString().split("T")[0],
        endDate: nextWeek.toISOString().split("T")[0],
        icon: "Package",
      } as TacticBlock
    }

    addBlock(newBlock)
    setIsAddingChild(false)
    setLocalExpanded(true)
  }

  const hasChildren = block.children && block.children.length > 0
  const canHaveChildren = block.type === "section"

  return (
    <>
      <Draggable draggableId={block.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{
              ...provided.draggableProps.style,
              opacity: snapshot.isDragging ? 0.8 : 1,
            }}
          >
            {/* Compact row */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors group cursor-pointer ${
                snapshot.isDragging ? "bg-accent shadow-md" : showSourceContext ? "bg-muted/80" : "hover:bg-muted/60"
              } ${
                (block as any).aiModified
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-amber-400"
                  : ""
              } ${
                isGenerating ? "bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-blue-400" : ""
              }`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={(e) => {
                // Don't toggle if clicking on input, button, or textarea
                const target = e.target as HTMLElement
                if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.tagName === "TEXTAREA" || target.closest("button")) return
                setShowSourceContext(!showSourceContext)
              }}
            >
              {/* Drag handle */}
              <div
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing hover:bg-muted rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </div>

              {/* Collapse arrow for sections / expand indicator for others */}
              {canHaveChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                  className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="shrink-0 p-0.5">
                  {showSourceContext ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  )}
                </div>
              )}

              {/* Icon */}
              <div className="p-1 rounded bg-primary/10 text-primary shrink-0">{getBlockIcon(block)}</div>

              {/* Inline editable title */}
              <Input
                value={block.title}
                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                className="flex-1 h-7 text-xs font-medium border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1.5"
                placeholder="Block title"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Type badge */}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 capitalize">
                {block.type}
              </span>

              {/* Action buttons - show on hover */}
              <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}>
                {(block.type === "tactic" || block.type === "text") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleOpenReferenceDialog(); }}
                    disabled={isGenerating}
                    className="h-6 w-6"
                    title="Generate content"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                  </Button>
                )}

                {canHaveChildren && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setIsAddingChild(!isAddingChild); }}
                    className="h-6 w-6"
                    title="Add child block"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Accordion expansion - description/context + tactic details */}
            {showSourceContext && (
              <div className="ml-8 mr-2 mt-1 mb-1.5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                {/* AI Modified badge */}
                {(block as any).aiModified && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Modified by AI</span>
                    <button
                      onClick={() => updateBlock(block.id, { aiModified: false })}
                      className="ml-1 hover:underline text-muted-foreground"
                    >
                      dismiss
                    </button>
                  </div>
                )}

                {/* Description / Source context */}
                {block.type === "section" ? (
                  <Textarea
                    value={(block as any).description || ""}
                    onChange={(e) => updateBlock(block.id, { description: e.target.value })}
                    placeholder="Section description..."
                    rows={2}
                    className="resize-none text-xs"
                  />
                ) : (
                  <Textarea
                    value={(block as any).sourceContext || ""}
                    onChange={(e) => updateBlock(block.id, { sourceContext: e.target.value })}
                    placeholder="Source context for AI generation..."
                    rows={2}
                    className="resize-none text-xs"
                  />
                )}

                {/* Tactic-specific fields: hours + dates */}
                {block.type === "tactic" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Hours</Label>
                      <Input
                        type="number"
                        value={(block as TacticBlock).hours}
                        onChange={(e) => updateBlock(block.id, { hours: Number.parseInt(e.target.value) || 0 })}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Start</Label>
                      <Input
                        type="date"
                        value={(block as TacticBlock).startDate}
                        onChange={(e) => updateBlock(block.id, { startDate: e.target.value })}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">End</Label>
                      <Input
                        type="date"
                        value={(block as TacticBlock).endDate}
                        onChange={(e) => updateBlock(block.id, { endDate: e.target.value })}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                )}

                {/* Quick actions row */}
                <div className="flex items-center gap-1.5">
                  {(block.type === "tactic" || block.type === "text") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleOpenReferenceDialog}
                      disabled={isGenerating}
                      className="h-6 text-[10px] gap-1 px-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-2.5 h-2.5" />
                      )}
                      {isGenerating ? "Generating..." : "Generate Content"}
                    </Button>
                  )}
                  {canHaveChildren && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddingChild(!isAddingChild)}
                      className="h-6 text-[10px] gap-1 px-2"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Add Child
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* AI Modified badge when collapsed */}
            {!showSourceContext && (block as any).aiModified && (
              <div className="ml-8 mt-0.5 mb-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Modified by AI</span>
                <button
                  onClick={() => updateBlock(block.id, { aiModified: false })}
                  className="ml-1 hover:underline text-muted-foreground"
                >
                  dismiss
                </button>
              </div>
            )}

            {/* Add child block picker (inline) */}
            {isAddingChild && canHaveChildren && (
              <div className="ml-8 mt-1 mb-1 flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAddChildBlock("text")}
                  className="h-7 text-xs gap-1.5"
                >
                  <FileText className="w-3 h-3" />
                  Text
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAddChildBlock("tactic")}
                  className="h-7 text-xs gap-1.5"
                >
                  <Zap className="w-3 h-3" />
                  Tactic
                </Button>
              </div>
            )}

            {/* Children (expanded) */}
            {isExpanded && hasChildren && (
              <div className="ml-5 border-l border-muted-foreground/20 pl-2 mt-0.5">
                <DragDropContext
                  onDragEnd={(result) => {
                    if (!result.destination) return
                    const updatedChildren = Array.from(block.children!)
                    const [removed] = updatedChildren.splice(result.source.index, 1)
                    updatedChildren.splice(result.destination.index, 0, removed)
                    updateBlock(block.id, { children: updatedChildren })
                  }}
                >
                  <Droppable droppableId={`section-${block.id}`}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0">
                        {block.children!.map((child, childIndex) => (
                          <OutlineItem
                            key={child.id}
                            block={child}
                            index={childIndex}
                            depth={depth + 1}
                            parentId={block.id}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
          </div>
        )}
      </Draggable>

      {/* Reference Dialog */}
      <Dialog
        open={isReferenceDialogOpen}
        onOpenChange={setIsReferenceDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Content for &ldquo;{block.title}&rdquo;</DialogTitle>
            <DialogDescription>
              Optionally select references to provide additional context for AI generation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingReferences ? (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : references.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select References (Optional)</Label>
                  {selectedReferenceIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">{selectedReferenceIds.length} selected</span>
                  )}
                </div>
                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <label
                        key={ref.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReferenceIds.includes(ref.id)}
                          onChange={() => toggleReference(ref.id)}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{ref.title}</div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ref.content.substring(0, 150)}...
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <p className="text-sm text-muted-foreground">No references available</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {selectedReferenceIds.length > 0
                  ? `Selected references will provide additional context to generate more relevant content for "${block.title}".`
                  : "You can proceed without references, or select some to provide additional context."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsReferenceDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmGeneration} className="flex-1 gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────
// Main PlanOutline Component
// ─────────────────────────────────────────────
export function PlanOutline() {
  const { currentPlan, reorderBlocks, addBlock, setCurrentPlan, updateBlock } = usePlanStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editInstructions, setEditInstructions] = useState("")
  const [isEditingOutline, setIsEditingOutline] = useState(false)
  const [unstructuredContext, setUnstructuredContext] = useState("")
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false)

  const [selectedBlockType, setSelectedBlockType] = useState<"text" | "tactic" | "table" | "timeline" | "section">(
    "section",
  )
  const [newBlockTitle, setNewBlockTitle] = useState("")
  const [newBlockContext, setNewBlockContext] = useState("")
  const [tacticTemplates, setTacticTemplates] = useState<TacticTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TacticTemplate | null>(null)
  const [customTacticHours, setCustomTacticHours] = useState(5)
  const [customTacticStartDate, setCustomTacticStartDate] = useState("")
  const [customTacticEndDate, setCustomTacticEndDate] = useState("")
  const [tacticMode, setTacticMode] = useState<"preset" | "custom">("preset")
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isUpdatingIcons, setIsUpdatingIcons] = useState(false)
  const { toast } = useToast()

  const [references, setReferences] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [editSelectedReferenceIds, setEditSelectedReferenceIds] = useState<string[]>([])
  const [generateAllReferenceIds, setGenerateAllReferenceIds] = useState<string[]>([])
  const [isGenerateAllDialogOpen, setIsGenerateAllDialogOpen] = useState(false)
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)

  // Tactic drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(true)
  const [drawerTemplates, setDrawerTemplates] = useState<TacticTemplate[]>([])
  const [isLoadingDrawerTemplates, setIsLoadingDrawerTemplates] = useState(false)

  // Expand/collapse all
  const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null)
  const resetGlobal = useCallback(() => setGlobalExpanded(null), [])

  const blocks = currentPlan?.blocks || []
  const isEmptyOutline = blocks.length === 0

  // Load templates for the drawer on mount
  useEffect(() => {
    setIsLoadingDrawerTemplates(true)
    fetch("/api/tactic-templates")
      .then((res) => res.json())
      .then((data) => {
        const templates = Array.isArray(data) ? data : data?.templates || []
        setDrawerTemplates(templates)
        setTacticTemplates(templates) // Also populate dialog templates
        setIsLoadingDrawerTemplates(false)
      })
      .catch((err) => {
        console.error("[v0] Error fetching templates:", err)
        setIsLoadingDrawerTemplates(false)
        setDrawerTemplates([])
      })
  }, [])

  useEffect(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    setCustomTacticStartDate(today.toISOString().split("T")[0])
    setCustomTacticEndDate(nextWeek.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (isAddDialogOpen && selectedBlockType === "tactic" && tacticTemplates.length === 0) {
      setIsLoadingTemplates(true)
      fetch("/api/tactic-templates")
        .then((res) => res.json())
        .then((data) => {
          const templates = Array.isArray(data) ? data : data?.templates || []
          setTacticTemplates(templates)
          setIsLoadingTemplates(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching templates:", err)
          setIsLoadingTemplates(false)
          setTacticTemplates([])
        })
    }
  }, [isAddDialogOpen, selectedBlockType, tacticTemplates.length])

  // Fetch references for generate dialog
  useEffect(() => {
    if (isGenerateDialogOpen && currentPlan?.id) {
      setIsLoadingReferences(true)
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => {
          setReferences(data.references || [])
          setIsLoadingReferences(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching references:", err)
          setIsLoadingReferences(false)
        })
    }
  }, [isGenerateDialogOpen, currentPlan?.id])

  useEffect(() => {
    if (isEditDialogOpen && currentPlan?.id) {
      setIsLoadingReferences(true)
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => {
          setReferences(data.references || [])
          setIsLoadingReferences(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching references:", err)
          setIsLoadingReferences(false)
        })
    }
  }, [isEditDialogOpen, currentPlan?.id])

  useEffect(() => {
    if (isGenerateAllDialogOpen && currentPlan?.id) {
      setIsLoadingReferences(true)
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => {
          setReferences(data.references || [])
          setIsLoadingReferences(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching references:", err)
          setIsLoadingReferences(false)
        })
    }
  }, [isGenerateAllDialogOpen, currentPlan?.id])

  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    reorderBlocks(result.source.index, result.destination.index)
  }

  // Add tactic from drawer
  const handleAddTacticFromDrawer = (template: TacticTemplate) => {
    if (!currentPlan) return

    const today = new Date()
    const end = new Date(today)
    end.setDate(today.getDate() + (template.defaultDuration || 7))

    const newBlock: TacticBlock = {
      id: crypto.randomUUID(),
      order: currentPlan.blocks.length,
      title: template.name,
      type: "tactic",
      tacticId: template.id,
      description: template.description || "",
      content: "",
      sourceContext: [
        template.what ? `What: ${template.what}` : "",
        template.why ? `Why: ${template.why}` : "",
        template.how ? `How: ${template.how}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      hours: template.defaultHours || 5,
      startDate: today.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      icon: template.icon || "Package",
      parentId: undefined,
    }

    addBlock(newBlock)

    toast({
      title: "Tactic added",
      description: `"${template.name}" has been added to your outline.`,
    })
  }

  const handleAddBlock = () => {
    if (!newBlockTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the block.",
        variant: "destructive",
      })
      return
    }

    const baseBlock = {
      id: crypto.randomUUID(),
      order: currentPlan.blocks.length,
      title: newBlockTitle,
      sourceContext: newBlockContext,
      parentId: null,
    }

    let newBlock: Block

    if (selectedBlockType === "section") {
      newBlock = {
        ...baseBlock,
        type: "section",
        content: "",
        children: [],
        description: "",
      }
    } else if (selectedBlockType === "text") {
      newBlock = {
        ...baseBlock,
        type: "text",
        content: "",
      }
    } else if (selectedBlockType === "tactic") {
      const hours = tacticMode === "preset" && selectedTemplate ? selectedTemplate.defaultHours : customTacticHours
      const duration = tacticMode === "preset" && selectedTemplate ? selectedTemplate.defaultDuration : null

      const startDate = customTacticStartDate
      let endDate = customTacticEndDate

      if (duration && tacticMode === "preset") {
        const start = new Date(customTacticStartDate)
        const end = new Date(start)
        end.setDate(start.getDate() + duration)
        endDate = end.toISOString().split("T")[0]
      }

      newBlock = {
        ...baseBlock,
        type: "tactic",
        tacticId: selectedTemplate?.id || "",
        description: newBlockContext || selectedTemplate?.description || "",
        content: "",
        hours: hours,
        startDate: startDate,
        endDate: endDate,
        icon: selectedTemplate?.icon || "Package",
      } as TacticBlock
    } else if (selectedBlockType === "table") {
      newBlock = {
        ...baseBlock,
        type: "table",
      }
    } else {
      newBlock = {
        ...baseBlock,
        type: "timeline",
      }
    }

    addBlock(newBlock)

    setIsAddDialogOpen(false)
    setNewBlockTitle("")
    setNewBlockContext("")
    setSelectedBlockType("section")
    setSelectedTemplate(null)
    setTacticMode("preset")

    toast({
      title: "Block added",
      description: "Block has been added to your plan outline.",
    })
  }

  const handleGenerateOrEditOutline = async () => {
    if (!editInstructions.trim()) {
      toast({
        title: "Instructions required",
        description: "Please provide instructions for the outline.",
        variant: "destructive",
      })
      return
    }

    if (!currentPlan) {
      toast({
        title: "No plan available",
        description: "Please create a plan first.",
        variant: "destructive",
      })
      return
    }

    setIsEditingOutline(true)

    try {
      if (currentPlan.blocks.length === 0) {
        const response = await fetch(`/api/plans/${currentPlan.id}/generate-outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unstructuredContext: editInstructions,
            clientName: currentPlan.clientName,
            objective: currentPlan.objective,
            referenceIds: editSelectedReferenceIds,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to generate outline")
        }

        const { blocks } = await response.json()

        setCurrentPlan({
          ...currentPlan,
          blocks: blocks,
          updatedAt: new Date().toISOString(),
        })

        toast({
          title: "Outline generated",
          description: `Created ${blocks.length} blocks for your plan outline.`,
        })
      } else {
        const response = await fetch(`/api/plans/${currentPlan.id}/edit-outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentBlocks: currentPlan.blocks,
            instructions: editInstructions,
            referenceIds: editSelectedReferenceIds,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to edit outline")
        }

        const { blocks } = await response.json()

        setCurrentPlan({
          ...currentPlan,
          blocks: blocks,
          updatedAt: new Date().toISOString(),
        })

        toast({
          title: "Outline updated",
          description: `Updated outline with ${blocks.length} blocks.`,
        })
      }

      setIsEditDialogOpen(false)
      setEditInstructions("")
      setEditSelectedReferenceIds([])
    } catch (error) {
      console.error("[v0] Generate/Edit outline error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process outline",
        variant: "destructive",
      })
    } finally {
      setIsEditingOutline(false)
    }
  }

  const handleGenerateOutline = async () => {
    if (!unstructuredContext.trim()) {
      toast({
        title: "Context required",
        description: "Please provide some context for the plan.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingOutline(true)

    try {
      const response = await fetch(`/api/plans/${currentPlan?.id}/generate-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unstructuredContext,
          clientName: currentPlan?.clientName,
          objective: currentPlan?.objective,
          referenceIds: selectedReferenceIds,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate outline")

      const { blocks } = await response.json()

      if (currentPlan) {
        setCurrentPlan({
          ...currentPlan,
          blocks: [...currentPlan.blocks, ...blocks],
          updatedAt: new Date().toISOString(),
        })
      }

      toast({
        title: "Outline generated",
        description: `Added ${blocks.length} blocks to your plan outline.`,
      })

      setIsGenerateDialogOpen(false)
      setUnstructuredContext("")
      setSelectedReferenceIds([])
    } catch (error) {
      console.error("[v0] Error generating outline:", error)
      toast({
        title: "Generation failed",
        description: "Failed to generate outline. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingOutline(false)
    }
  }

  const handleEditOutline = async () => {
    if (!editInstructions.trim()) {
      toast({
        title: "Instructions required",
        description: "Please provide instructions for editing the outline.",
        variant: "destructive",
      })
      return
    }

    if (!currentPlan || currentPlan.blocks.length === 0) {
      toast({
        title: "No blocks to edit",
        description: "Create some blocks first before editing.",
        variant: "destructive",
      })
      return
    }

    setIsEditingOutline(true)

    try {
      const response = await fetch(`/api/plans/${currentPlan.id}/edit-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentBlocks: currentPlan.blocks,
          instructions: editInstructions,
          referenceIds: editSelectedReferenceIds,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to edit outline")
      }

      const { blocks, summary, changesExplanation } = await response.json()

      if (currentPlan) {
        setCurrentPlan({
          ...currentPlan,
          blocks,
          updatedAt: new Date().toISOString(),
        })
      }

      toast({
        title: "Outline edited",
        description: "Your plan outline has been edited.",
      })

      setIsEditDialogOpen(false)
      setEditInstructions("")
      setEditSelectedReferenceIds([])
    } catch (error) {
      console.error("[v0] Error editing outline:", error)
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Failed to edit outline. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditingOutline(false)
    }
  }

  const handleGenerateAllBlocks = async () => {
    if (!currentPlan || currentPlan.blocks.length === 0) {
      toast({
        title: "No blocks to generate",
        description: "Create some blocks first before generating content.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingAll(true)

    try {
      const response = await fetch(`/api/plans/${currentPlan.id}/generate-all-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: currentPlan.blocks,
          referenceIds: generateAllReferenceIds,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate all blocks")
      }

      const { blocks: updatedBlocks } = await response.json()

      if (currentPlan) {
        setCurrentPlan({
          ...currentPlan,
          blocks: updatedBlocks,
          updatedAt: new Date().toISOString(),
        })
      }

      toast({
        title: "All blocks generated",
        description: "Content has been generated for all blocks in your plan outline.",
      })

      setIsGenerateAllDialogOpen(false)
      setGenerateAllReferenceIds([])
    } catch (error) {
      console.error("[v0] Error generating all blocks:", error)
      toast({
        title: "Generation failed",
        description: "Failed to generate content for all blocks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingAll(false)
    }
  }

  const handleMassUpdateIcons = async () => {
    if (!currentPlan || currentPlan.blocks.length === 0) {
      toast({
        title: "No blocks to update",
        description: "Create some blocks first before updating icons.",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingIcons(true)

    toast({
      title: "Updating icons...",
      description: "Analyzing all blocks and updating their icons with AI suggestions.",
    })

    try {
      const { suggestIconForTactic } = await import("@/lib/utils")

      const updateBlockIcons = (blocks: Block[]): Block[] => {
        return blocks.map((block) => {
          let updatedBlock = { ...block }

          if (block.type === "tactic") {
            const tacticBlock = block as TacticBlock
            const sourceContext = (tacticBlock as any).sourceContext || tacticBlock.description || ""
            const newIcon = suggestIconForTactic(tacticBlock.title, sourceContext)
            updatedBlock = { ...updatedBlock, icon: newIcon }
          }

          if (block.type === "section") {
            const sectionBlock = block as any
            const description = sectionBlock.description || ""
            const newIcon = suggestIconForTactic(sectionBlock.title, description)
            updatedBlock = { ...updatedBlock, icon: newIcon }
          }

          if (updatedBlock.children && updatedBlock.children.length > 0) {
            updatedBlock = {
              ...updatedBlock,
              children: updateBlockIcons(updatedBlock.children),
            }
          }

          return updatedBlock
        })
      }

      const updatedBlocks = updateBlockIcons(currentPlan.blocks)

      const allBlocksFlat = getAllBlocksFlattened(currentPlan.blocks)
      const updatedBlocksFlat = getAllBlocksFlattened(updatedBlocks)
      const changedCount = allBlocksFlat.filter((block, index) => {
        const oldIcon = (block as any).icon
        const newIcon = (updatedBlocksFlat[index] as any).icon
        return oldIcon !== newIcon && (block.type === "tactic" || block.type === "section")
      }).length

      setCurrentPlan({
        ...currentPlan,
        blocks: updatedBlocks,
        updatedAt: new Date().toISOString(),
      })

      toast({
        title: "Icons updated",
        description: `Successfully updated ${changedCount} icons based on block titles and content.`,
      })
    } catch (error) {
      console.error("[v0] Error updating icons:", error)
      toast({
        title: "Update failed",
        description: "Failed to update icons. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingIcons(false)
    }
  }

  return (
    <OutlineContext.Provider value={{ globalExpanded, resetGlobal }}>
      <div className="flex h-full overflow-hidden">
        {/* Left Tactic Drawer */}
        {isDrawerOpen && (
          <TacticDrawer
            templates={drawerTemplates}
            isLoading={isLoadingDrawerTemplates}
            onAddTactic={handleAddTacticFromDrawer}
          />
        )}

        {/* Main outline area */}
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-2 px-4 py-4">
            {/* Header toolbar — sticky so Add Block is always reachable */}
            <div className="sticky top-0 z-10 bg-inherit -mx-4 px-4 pb-3 pt-0 space-y-3">
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                  className="h-8 w-8 shrink-0"
                  title={isDrawerOpen ? "Hide tactic drawer" : "Show tactic drawer"}
                >
                  {isDrawerOpen ? (
                    <PanelLeftClose className="w-4 h-4" />
                  ) : (
                    <PanelLeftOpen className="w-4 h-4" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold tracking-tight">Plan Outline</h2>
                </div>

                <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 h-8 text-xs shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  Add Block
                </Button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setGlobalExpanded(globalExpanded === true ? false : true)}
                  className="gap-1.5 h-7 text-xs"
                  title={globalExpanded === true ? "Collapse all" : "Expand all"}
                >
                  {globalExpanded === true ? (
                    <>
                      <ChevronsDownUp className="w-3.5 h-3.5" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                      Expand
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMassUpdateIcons}
                  disabled={isUpdatingIcons}
                  className="gap-1.5 h-7 text-xs bg-transparent"
                >
                  {isUpdatingIcons ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Icons
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsGenerateAllDialogOpen(true)}
                  disabled={isGeneratingAll}
                  className="gap-1.5 h-7 text-xs"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Generate All
                    </>
                  )}
                </Button>

                <Button size="sm" variant="secondary" onClick={() => setIsEditDialogOpen(true)} className="gap-1.5 h-7 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  {blocks.length === 0 ? "Generate Outline" : "Edit with AI"}
                </Button>
              </div>
            </div>

            {/* Outline tree */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="plan-outline">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0">
                    {currentPlan?.blocks.map((block, index) => (
                      <OutlineItem key={block.id} block={block} index={index} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {isEmptyOutline && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FolderOpen className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No blocks yet</p>
                <p className="text-xs mt-1">
                  Add blocks manually, drag tactics from the left panel, or generate an outline with AI.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Block Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Block</DialogTitle>
            <DialogDescription>Choose a block type, then configure it below.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Block Type Picker - Visual Cards */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Block Type</Label>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { value: "section", label: "Section", icon: FolderOpen, desc: "Group blocks" },
                  { value: "text", label: "Text", icon: FileText, desc: "Rich content" },
                  { value: "tactic", label: "Tactic", icon: Zap, desc: "Marketing tactic" },
                  { value: "table", label: "Table", icon: TableIcon, desc: "Data table" },
                  { value: "timeline", label: "Timeline", icon: Calendar, desc: "Schedule" },
                ] as const).map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedBlockType(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                      selectedBlockType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Block Title */}
            <div className="space-y-1.5">
              <Label htmlFor="block-title">Title</Label>
              <Input
                id="block-title"
                value={newBlockTitle}
                onChange={(e) => setNewBlockTitle(e.target.value)}
                placeholder="Enter block title"
              />
            </div>

            {/* Tactic-specific options */}
            {selectedBlockType === "tactic" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tacticTemplates.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Template</Label>
                    <ScrollArea className="h-[220px] rounded-md border bg-background p-2">
                      <div className="space-y-1">
                        {tacticTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedTemplate(template)}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${
                              selectedTemplate?.id === template.id
                                ? "bg-primary/10 border border-primary/30"
                                : "hover:bg-muted/80 border border-transparent"
                            }`}
                          >
                            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              selectedTemplate?.id === template.id
                                ? "border-primary"
                                : "border-muted-foreground/40"
                            }`}>
                              {selectedTemplate?.id === template.id && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{template.name}</div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {template.description.substring(0, 120)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No tactic templates available</p>
                )}

                {/* Preset / Custom Toggle */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Mode</Label>
                  <div className="flex rounded-md border bg-background p-0.5 w-fit">
                    {(["preset", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTacticMode(mode)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors capitalize ${
                          tacticMode === mode
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {tacticMode === "custom" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Hours</Label>
                      <Input
                        type="number"
                        value={customTacticHours}
                        onChange={(e) => setCustomTacticHours(Number.parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <Input
                        type="date"
                        value={customTacticStartDate}
                        onChange={(e) => setCustomTacticStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">End Date</Label>
                      <Input
                        type="date"
                        value={customTacticEndDate}
                        onChange={(e) => setCustomTacticEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Source Context - non-section blocks */}
            {selectedBlockType !== "section" && (
              <div className="space-y-1.5">
                <Label htmlFor="block-context">Source Context <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="block-context"
                  value={newBlockContext}
                  onChange={(e) => setNewBlockContext(e.target.value)}
                  placeholder="Provide context that the AI will use to flesh out this block's content..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAddBlock} className="flex-1 gap-2">
              <Plus className="w-4 h-4" />
              Add Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Outline Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Outline</DialogTitle>
            <DialogDescription>
              Provide context and optionally select references to generate the outline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unstructured-context">Context</Label>
              <Textarea
                id="unstructured-context"
                value={unstructuredContext}
                onChange={(e) => setUnstructuredContext(e.target.value)}
                placeholder="Provide context for the outline generation..."
                rows={4}
                className="resize-none bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
              />
            </div>

            {isLoadingReferences ? (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : references.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select References (Optional)</Label>
                  {selectedReferenceIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">{selectedReferenceIds.length} selected</span>
                  )}
                </div>
                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <label
                        key={ref.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReferenceIds.includes(ref.id)}
                          onChange={() =>
                            setSelectedReferenceIds((prev) =>
                              prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id],
                            )
                          }
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{ref.title}</div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ref.content.substring(0, 150)}...
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <p className="text-sm text-muted-foreground">No references available</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {selectedReferenceIds.length > 0
                  ? `Selected references will provide additional context to generate more relevant content for your outline.`
                  : "You can proceed without references, or select some to provide additional context."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleGenerateOutline} className="flex-1 gap-2">
              <Zap className="w-4 h-4" />
              Generate Outline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Outline Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEmptyOutline ? "Generate Outline" : "Edit Outline"}</DialogTitle>
            <DialogDescription>
              {isEmptyOutline
                ? "Describe what you want in your marketing plan and optionally select references for context."
                : "Provide instructions and optionally select references to edit the outline."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-instructions">
                {isEmptyOutline ? "What should this plan include?" : "Instructions"}
              </Label>
              <Textarea
                id="edit-instructions"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder={
                  isEmptyOutline
                    ? "E.g., Create a 6-month marketing plan focused on social media, content marketing, and paid ads for a B2B SaaS company..."
                    : "Provide instructions for editing the outline..."
                }
                rows={4}
                className="resize-none bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
              />
            </div>

            {isLoadingReferences ? (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : references.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select References (Optional)</Label>
                  {editSelectedReferenceIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">{editSelectedReferenceIds.length} selected</span>
                  )}
                </div>
                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <label
                        key={ref.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={editSelectedReferenceIds.includes(ref.id)}
                          onChange={() =>
                            setEditSelectedReferenceIds((prev) =>
                              prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id],
                            )
                          }
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{ref.title}</div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ref.content.substring(0, 150)}...
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <p className="text-sm text-muted-foreground">No references available</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {editSelectedReferenceIds.length > 0
                  ? `Selected references will provide additional context to edit your outline more effectively.`
                  : "You can proceed without references, or select some to provide additional context."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="flex-1"
              disabled={isEditingOutline}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateOrEditOutline}
              disabled={!editInstructions.trim() || isEditingOutline}
              className="bg-primary hover:bg-primary/90"
            >
              {isEditingOutline ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEmptyOutline ? "Generating..." : "Editing..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isEmptyOutline ? "Generate Outline" : "Edit Outline"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate All Blocks Dialog */}
      <Dialog open={isGenerateAllDialogOpen} onOpenChange={setIsGenerateAllDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Content for All Blocks</DialogTitle>
            <DialogDescription>
              Optionally select references to provide additional context for AI generation of all blocks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingReferences ? (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : references.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select References (Optional)</Label>
                  {generateAllReferenceIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">{generateAllReferenceIds.length} selected</span>
                  )}
                </div>
                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <label
                        key={ref.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={generateAllReferenceIds.includes(ref.id)}
                          onChange={() =>
                            setGenerateAllReferenceIds((prev) =>
                              prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id],
                            )
                          }
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{ref.title}</div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ref.content.substring(0, 150)}...
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 border rounded-lg">
                <p className="text-sm text-muted-foreground">No references available</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {generateAllReferenceIds.length > 0
                  ? `Selected references will provide additional context to generate more relevant content for all blocks in your outline.`
                  : "You can proceed without references, or select some to provide additional context."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsGenerateAllDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleGenerateAllBlocks} className="flex-1 gap-2">
              <Zap className="w-4 h-4" />
              Generate All Blocks
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </OutlineContext.Provider>
  )
}

"use client"

import { usePlanStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
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
} from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import type { Block, TacticBlock, TacticTemplate } from "@/lib/types"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import * as LucideIcons from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  const [isExpanded, setIsExpanded] = useState(true)
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false)
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [references, setReferences] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false) // Track generation state per block
  const { toast } = useToast()

  useEffect(() => {
    console.log(`[v0] OutlineItem mounted - Block: "${block.title}" (${block.type}) Depth: ${depth}`)
  }, [block.title, block.type, depth])

  useEffect(() => {
    if (isReferenceDialogOpen && currentPlan?.id) {
      console.log(`[v0] Loading references for block: "${block.title}"`)
      setIsLoadingReferences(true)
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => {
          console.log(`[v0] Loaded ${data.references?.length || 0} references`)
          setReferences(data.references || [])
          setIsLoadingReferences(false)
        })
        .catch((err) => {
          console.error("[v0] Error fetching references:", err)
          setIsLoadingReferences(false)
        })
    }
  }, [isReferenceDialogOpen, currentPlan?.id, block.title])

  const getBlockIcon = (block: Block) => {
    if (block.type === "section") return <FolderOpen className="w-4 h-4" />
    if (block.type === "tactic" && "icon" in block && block.icon) {
      const Icon = (LucideIcons as any)[block.icon] || LucideIcons.Package
      return <Icon className="w-4 h-4" />
    }
    if (block.type === "table") return <TableIcon className="w-4 h-4" />
    if (block.type === "timeline") return <Calendar className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const handleRegenerateBlock = async (blockId: string, referenceIds?: string[]) => {
    const allBlocks = getAllBlocksFlattened(currentPlan?.blocks || [])
    const block = allBlocks.find((b) => b.id === blockId)

    console.log(`[v0] Looking for block ID: ${blockId} in ${allBlocks.length} total blocks`)

    if (!block) {
      console.error(`[v0] Block not found: ${blockId}`)
      toast({
        title: "Block not found",
        description: "Could not find the block to generate content for.",
        variant: "destructive",
      })
      return
    }

    if (block.type !== "tactic" && block.type !== "text") {
      console.log(`[v0] Block type ${block.type} is not supported for content generation`)
      return
    }

    const sourceContext = (block as any).sourceContext || ""
    if (!sourceContext.trim()) {
      toast({
        title: "No context provided",
        description: "Add source context to regenerate content.",
        variant: "destructive",
      })
      return
    }

    console.log(`[v0] Starting content generation for block: ${block.title}`)
    setIsGenerating(true)

    toast({
      title: "Generating content...",
      description: `Generating content for "${block.title}"`,
    })

    try {
      updateBlock(blockId, { content: "🤖 AI is generating content... This may take 10-30 seconds." })

      // Get all blocks for context
      const currentIndex = allBlocks.findIndex((b) => b.id === blockId)

      // Get previous blocks (up to 3) that have content
      const previousBlocks = allBlocks
        .slice(0, currentIndex)
        .filter((b) => b.content && b.content.trim())
        .slice(-3)
        .map((b) => ({ title: b.title, content: b.content }))

      // Get upcoming blocks (up to 5)
      const upcomingBlocks = allBlocks
        .slice(currentIndex + 1)
        .slice(0, 5)
        .map((b) => ({ title: b.title }))

      console.log(`[v0] Calling generate-block API for "${block.title}" with ${referenceIds?.length || 0} references`)
      console.log(`[v0] Context: ${previousBlocks.length} previous blocks, ${upcomingBlocks.length} upcoming blocks`)

      const response = await fetch(`/api/plans/${currentPlan?.id}/generate-block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type, // Pass block type to API
          tacticName: block.title,
          tacticDescription: sourceContext,
          clientName: currentPlan?.clientName,
          objective: currentPlan?.objective,
          referenceIds: referenceIds || [],
          previousBlocks, // Send previous blocks for context
          upcomingBlocks, // Send upcoming blocks for context
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const { content } = await response.json()

      console.log(`[v0] Successfully generated ${content.length} characters for "${block.title}"`)

      updateBlock(blockId, { content })

      toast({
        title: "Content generated ✓",
        description: `Successfully generated content for "${block.title}"`,
      })
    } catch (error) {
      console.error("[v0] Error regenerating content:", error)
      updateBlock(blockId, { content: "" }) // Clear loading text on error
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false) // Reset generating state
      console.log(`[v0] Finished generation process for "${block.title}"`)
    }
  }

  // Add logging to track event
  const handleOpenReferenceDialog = () => {
    console.log(`[v0] Opening reference dialog for block: "${block.title}" (${block.type})`)
    setIsReferenceDialogOpen(true)
    setSelectedReferenceIds([])
  }

  // Add logging to track event
  const handleConfirmGeneration = async () => {
    console.log(`[v0] Confirmed generation for block: "${block.title}" with ${selectedReferenceIds.length} references`)
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
    setIsExpanded(true)
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
              marginLeft: depth > 0 ? `${depth * 24}px` : 0,
            }}
            className="space-y-2"
          >
            <Card
              className={`p-4 ${snapshot.isDragging ? "shadow-lg" : ""} ${
                (block as any).aiModified
                  ? "border-2 border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                  : ""
              } ${
                isGenerating ? "border-2 border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20" : ""
              }`}
            >
              {(block as any).aiModified && (
                <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-3 py-1.5 rounded-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-medium">Modified by AI</span>
                  <button
                    onClick={() => updateBlock(block.id, { aiModified: false })}
                    className="ml-auto text-xs hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div
                  {...provided.dragHandleProps}
                  className="mt-1 cursor-grab active:cursor-grabbing hover:bg-muted rounded p-1 transition-colors"
                >
                  <GripVertical className="w-5 h-5 text-muted-foreground" />
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    {canHaveChildren && hasChildren && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">{getBlockIcon(block)}</div>

                    <Input
                      value={block.title}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                      className="flex-1 font-medium"
                      placeholder="Block title"
                    />

                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{block.type}</span>
                  </div>

                  {block.type === "section" && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Description</Label>
                      <Textarea
                        value={(block as any).description || ""}
                        onChange={(e) => updateBlock(block.id, { description: e.target.value })}
                        placeholder="Enter a description for this section/campaign..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  )}

                  {block.type !== "section" && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Source Context (for AI generation)</Label>
                      <Textarea
                        value={(block as any).sourceContext || ""}
                        onChange={(e) => updateBlock(block.id, { sourceContext: e.target.value })}
                        placeholder="Provide context that the AI will use to flesh out this block's content..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  )}

                  {block.type === "tactic" && (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Hours</Label>
                        <Input
                          type="number"
                          value={(block as TacticBlock).hours}
                          onChange={(e) => updateBlock(block.id, { hours: Number.parseInt(e.target.value) || 0 })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <Input
                          type="date"
                          value={(block as TacticBlock).startDate}
                          onChange={(e) => updateBlock(block.id, { startDate: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">End Date</Label>
                        <Input
                          type="date"
                          value={(block as TacticBlock).endDate}
                          onChange={(e) => updateBlock(block.id, { endDate: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {(block.type === "tactic" || block.type === "text") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          console.log(
                            `[v0] Generate Content button clicked for: "${block.title}" (${block.type}) Depth: ${depth}`,
                          )
                          handleOpenReferenceDialog()
                        }}
                        disabled={isGenerating} // Disable button while generating
                        className={`gap-2 ${isGenerating ? "animate-pulse" : ""}`}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Generate Content
                          </>
                        )}
                      </Button>
                    )}

                    {canHaveChildren && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingChild(!isAddingChild)}
                        className="gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        Add Child Block
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBlock(block.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </Button>
                  </div>

                  {isAddingChild && canHaveChildren && (
                    <div className="flex gap-2 p-3 bg-muted/50 rounded-lg border">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddChildBlock("text")}
                        className="gap-2 flex-1"
                      >
                        <FileText className="w-3 h-3" />
                        Text Section
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddChildBlock("tactic")}
                        className="gap-2 flex-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Marketing Tactic
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {isExpanded && hasChildren && (
              <div className="ml-6 border-l-2 border-muted pl-4">
                <DragDropContext
                  onDragEnd={(result) => {
                    if (!result.destination) return
                    // Handle reordering within this section
                    const updatedChildren = Array.from(block.children!)
                    const [removed] = updatedChildren.splice(result.source.index, 1)
                    updatedChildren.splice(result.destination.index, 0, removed)

                    // Update the parent block with reordered children
                    updateBlock(block.id, { children: updatedChildren })
                  }}
                >
                  <Droppable droppableId={`section-${block.id}`}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
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

      <Dialog
        open={isReferenceDialogOpen}
        onOpenChange={(open) => {
          console.log(`[v0] Reference dialog ${open ? "opened" : "closed"} for: "${block.title}"`)
          setIsReferenceDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Content for "{block.title}"</DialogTitle>
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
              onClick={() => {
                console.log(`[v0] Canceling generation for: "${block.title}"`)
                setIsReferenceDialogOpen(false)
              }}
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

  // Moved getAllBlocksFlattened here to be accessible by PlanOutline as well
  // const getAllBlocksFlattened = (blocks: Block[]): Block[] => {
  //   const result: Block[] = []

  //   const traverse = (blockList: Block[]) => {
  //     for (const block of blockList) {
  //       result.push(block)
  //       if (block.children && block.children.length > 0) {
  //         traverse(block.children)
  //       }
  //     }
  //   }

  //   traverse(blocks)
  //   return result
  // }

  const blocks = currentPlan?.blocks || []
  const isEmptyOutline = blocks.length === 0

  useEffect(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    setCustomTacticStartDate(today.toISOString().split("T")[0])
    setCustomTacticEndDate(nextWeek.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (isAddDialogOpen && selectedBlockType === "tactic" && tacticTemplates.length === 0) {
      console.log("[v0] Loading tactic templates...")
      setIsLoadingTemplates(true)
      fetch("/api/tactic-templates")
        .then((res) => res.json())
        .then((data) => {
          const templates = Array.isArray(data) ? data : data?.templates || []
          console.log("[v0] Templates loaded:", templates.length)
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
        description: "", // Added description field
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
    console.log("[v0] Generate/Edit Outline button clicked")
    console.log("[v0] Instructions:", editInstructions)
    console.log("[v0] Selected references:", editSelectedReferenceIds.length)
    console.log("[v0] Current blocks count:", currentPlan?.blocks.length || 0)

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
        console.log("[v0] No existing blocks - calling generate-outline endpoint")

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

        console.log("[v0] Generate response status:", response.status)

        if (!response.ok) {
          const errorData = await response.json()
          console.error("[v0] Generate error response:", errorData)
          throw new Error(errorData.error || "Failed to generate outline")
        }

        const { blocks } = await response.json()
        console.log("[v0] Generated blocks count:", blocks.length)

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
        // Edit existing blocks
        console.log("[v0] Editing existing blocks - calling edit-outline endpoint")
        console.log("[v0] Sending edit request with", currentPlan.blocks.length, "blocks")

        const response = await fetch(`/api/plans/${currentPlan.id}/edit-outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentBlocks: currentPlan.blocks,
            instructions: editInstructions,
            referenceIds: editSelectedReferenceIds,
          }),
        })

        console.log("[v0] Edit response status:", response.status)

        if (!response.ok) {
          const errorData = await response.json()
          console.error("[v0] Edit error response:", errorData)
          throw new Error(errorData.error || "Failed to edit outline")
        }

        const { blocks } = await response.json()
        console.log("[v0] Received edited blocks:", blocks.length)

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

      // Add all generated blocks to the plan
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
    console.log("[v0] Edit Outline button clicked")
    console.log("[v0] Instructions:", editInstructions)
    console.log("[v0] Selected references:", editSelectedReferenceIds.length)

    if (!editInstructions.trim()) {
      toast({
        title: "Instructions required",
        description: "Please provide instructions for editing the outline.",
        variant: "destructive",
      })
      return
    }

    if (!currentPlan || currentPlan.blocks.length === 0) {
      console.log("[v0] No blocks available to edit")
      toast({
        title: "No blocks to edit",
        description: "Create some blocks first before editing.",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Starting outline edit process...")
    setIsEditingOutline(true)

    try {
      console.log("[v0] Sending edit request with", currentPlan.blocks.length, "blocks")

      const response = await fetch(`/api/plans/${currentPlan.id}/edit-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentBlocks: currentPlan.blocks,
          instructions: editInstructions,
          referenceIds: editSelectedReferenceIds,
        }),
      })

      console.log("[v0] Edit response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Edit error response:", errorData)
        throw new Error(errorData.error || "Failed to edit outline")
      }

      const { blocks, summary, changesExplanation } = await response.json()

      console.log("[v0] Received edited blocks:", {
        total: blocks.length,
        modified: blocks.filter((b: any) => b.aiModified).length,
      })

      // Update the plan with edited blocks
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
      console.log("[v0] Edit outline process completed")
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
      console.log("[v0] Sending generate all request with", currentPlan.blocks.length, "blocks")

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

      console.log("[v0] Received generated blocks:", updatedBlocks.length)

      // Update the plan with generated blocks
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
      // Import the utility function
      const { suggestIconForTactic } = await import("@/lib/utils")

      // Helper to recursively update icons in all blocks
      const updateBlockIcons = (blocks: Block[]): Block[] => {
        return blocks.map((block) => {
          let updatedBlock = { ...block }

          // Update icon for tactic blocks
          if (block.type === "tactic") {
            const tacticBlock = block as TacticBlock
            const sourceContext = (tacticBlock as any).sourceContext || tacticBlock.description || ""
            const newIcon = suggestIconForTactic(tacticBlock.title, sourceContext)
            updatedBlock = { ...updatedBlock, icon: newIcon }
          }

          // Update icon for section blocks
          if (block.type === "section") {
            const sectionBlock = block as any
            const description = sectionBlock.description || ""
            const newIcon = suggestIconForTactic(sectionBlock.title, description)
            updatedBlock = { ...updatedBlock, icon: newIcon }
          }

          // Recursively update children
          if (updatedBlock.children && updatedBlock.children.length > 0) {
            updatedBlock = {
              ...updatedBlock,
              children: updateBlockIcons(updatedBlock.children),
            }
          }

          return updatedBlock
        })
      }

      // Update all blocks
      const updatedBlocks = updateBlockIcons(currentPlan.blocks)

      // Count how many icons were changed
      const allBlocksFlat = getAllBlocksFlattened(currentPlan.blocks)
      const updatedBlocksFlat = getAllBlocksFlattened(updatedBlocks)
      const changedCount = allBlocksFlat.filter((block, index) => {
        const oldIcon = (block as any).icon
        const newIcon = (updatedBlocksFlat[index] as any).icon
        return oldIcon !== newIcon && (block.type === "tactic" || block.type === "section")
      }).length

      // Update the plan
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
    <div className="max-w-5xl mx-auto space-y-4 px-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Plan Outline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the skeleton of your plan and define context for AI generation
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMassUpdateIcons}
            disabled={isUpdatingIcons}
            className="gap-2 bg-transparent"
          >
            {isUpdatingIcons ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Update Icons
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsGenerateAllDialogOpen(true)}
            disabled={isGeneratingAll}
            className="gap-2"
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate All
              </>
            )}
          </Button>

          {/* Make button label contextual based on whether blocks exist */}
          <Button size="sm" variant="secondary" onClick={() => setIsEditDialogOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {blocks.length === 0 ? "Generate Outline" : "Edit with AI"}
          </Button>

          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Block
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="plan-outline">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {currentPlan?.blocks.map((block, index) => (
                <OutlineItem key={block.id} block={block} index={index} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Block Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Block</DialogTitle>
            <DialogDescription>Select the type of block you want to add.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="block-type">Block Type</Label>
              <select
                id="block-type"
                value={selectedBlockType}
                onChange={(e) => setSelectedBlockType(e.target.value as any)}
                className="bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
              >
                <option value="section">Section</option>
                <option value="text">Text</option>
                <option value="tactic">Tactic</option>
                <option value="table">Table</option>
                <option value="timeline">Timeline</option>
              </select>
            </div>

            {selectedBlockType === "tactic" && (
              <div className="space-y-4">
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center p-12 border rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tacticTemplates.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Select Tactic Template</Label>
                      {selectedTemplate && (
                        <span className="text-xs text-muted-foreground">{selectedTemplate.title}</span>
                      )}
                    </div>
                    <ScrollArea className="h-[300px] border rounded-lg p-3">
                      <div className="space-y-2">
                        {tacticTemplates.map((template) => (
                          <label
                            key={template.id}
                            className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <input
                              type="radio"
                              name="tactic-template"
                              value={template.id}
                              checked={selectedTemplate?.id === template.id}
                              onChange={() => setSelectedTemplate(template)}
                              className="mt-1 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{template.title}</div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {template.description.substring(0, 150)}...
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-12 border rounded-lg">
                    <p className="text-sm text-muted-foreground">No tactic templates available</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Label htmlFor="tactic-mode">Mode</Label>
                  <select
                    id="tactic-mode"
                    value={tacticMode}
                    onChange={(e) => setTacticMode(e.target.value as any)}
                    className="bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
                  >
                    <option value="preset">Preset</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {tacticMode === "custom" && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Hours</Label>
                    <Input
                      type="number"
                      value={customTacticHours}
                      onChange={(e) => setCustomTacticHours(Number.parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />

                    <Label className="text-sm text-muted-foreground">Start Date</Label>
                    <Input
                      type="date"
                      value={customTacticStartDate}
                      onChange={(e) => setCustomTacticStartDate(e.target.value)}
                      className="mt-1"
                    />

                    <Label className="text-sm text-muted-foreground">End Date</Label>
                    <Input
                      type="date"
                      value={customTacticEndDate}
                      onChange={(e) => setCustomTacticEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="block-title">Block Title</Label>
              <Input
                id="block-title"
                value={newBlockTitle}
                onChange={(e) => setNewBlockTitle(e.target.value)}
                placeholder="Enter block title"
                className="bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
              />
            </div>

            {selectedBlockType !== "section" && (
              <div className="space-y-2">
                <Label htmlFor="block-context">Source Context</Label>
                <Textarea
                  id="block-context"
                  value={newBlockContext}
                  onChange={(e) => setNewBlockContext(e.target.value)}
                  placeholder="Provide context that the AI will use to flesh out this block's content..."
                  rows={3}
                  className="resize-none bg-background border border-input ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm rounded-md shadow-sm"
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
              onClick={() => {
                console.log("[v0] Cancel button clicked in Edit Outline dialog")
                setIsEditDialogOpen(false)
              }}
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
    </div>
  )
}

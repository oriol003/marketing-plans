"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, GripVertical, Copy, Check } from "lucide-react"
import type { Reference } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

interface ReferencesPanelProps {
  planId: string
}

const truncateContent = (content: string, maxLength = 150): string => {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength).trim() + "..."
}

export function ReferencesPanel({ planId }: ReferencesPanelProps) {
  const [references, setReferences] = useState<Reference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingContent, setEditingContent] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadReferences()
  }, [planId])

  const loadReferences = async () => {
    try {
      const response = await fetch(`/api/plans/${planId}/references`)
      if (response.ok) {
        const data = await response.json()
        setReferences(data.references || [])
      }
    } catch (error) {
      console.error("Error loading references:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyReference = async (reference: Reference) => {
    const textToCopy = `${reference.title}\n\n${reference.content}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(reference.id)
      toast({
        title: "Copied to clipboard",
        description: "Reference content has been copied.",
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error("Error copying reference:", error)
      toast({
        title: "Error",
        description: "Failed to copy reference.",
        variant: "destructive",
      })
    }
  }

  const handleAddReference = async () => {
    try {
      const newReference = {
        title: "New Reference",
        content: "Add your reference content here...",
        order: references.length,
      }

      const response = await fetch(`/api/plans/${planId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReference),
      })

      if (response.ok) {
        const data = await response.json()
        setReferences([...references, data.reference])
        setEditingId(data.reference.id)
        setEditingTitle(data.reference.title)
        setEditingContent(data.reference.content)
        toast({
          title: "Reference added",
          description: "New reference has been created.",
        })
      }
    } catch (error) {
      console.error("Error adding reference:", error)
      toast({
        title: "Error",
        description: "Failed to add reference.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateReference = async (id: string, updates: Partial<Reference>) => {
    try {
      const response = await fetch(`/api/plans/${planId}/references/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setReferences(references.map((ref) => (ref.id === id ? data.reference : ref)))
      }
    } catch (error) {
      console.error("Error updating reference:", error)
    }
  }

  const handleStartEditing = (reference: Reference) => {
    setEditingId(reference.id)
    setEditingTitle(reference.title)
    setEditingContent(reference.content)
  }

  const handleFinishEditing = async () => {
    if (editingId) {
      await handleUpdateReference(editingId, {
        title: editingTitle,
        content: editingContent,
      })
    }
    setEditingId(null)
    setEditingTitle("")
    setEditingContent("")
  }

  const handleDeleteReference = async (id: string) => {
    try {
      const response = await fetch(`/api/plans/${planId}/references/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setReferences(references.filter((ref) => ref.id !== id))
        toast({
          title: "Reference deleted",
          description: "Reference has been removed.",
        })
      }
    } catch (error) {
      console.error("Error deleting reference:", error)
      toast({
        title: "Error",
        description: "Failed to delete reference.",
        variant: "destructive",
      })
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(references)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const updatedReferences = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    setReferences(updatedReferences)

    try {
      await fetch(`/api/plans/${planId}/references/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          references: updatedReferences.map((r) => ({ id: r.id, order: r.order })),
        }),
      })
    } catch (error) {
      console.error("Error reordering references:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading references...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">References</h2>
          <p className="text-muted-foreground mt-1">
            Add sources, links, and reference materials relevant to this marketing plan
          </p>
        </div>
        <Button onClick={handleAddReference} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Reference
        </Button>
      </div>

      {references.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No references yet</h3>
          <p className="text-muted-foreground mb-6">
            Start adding references to keep track of important sources and materials
          </p>
          <Button onClick={handleAddReference} variant="outline" className="gap-2 bg-transparent">
            <Plus className="w-4 h-4" />
            Add First Reference
          </Button>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="references">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                {references.map((reference, index) => (
                  <Draggable key={reference.id} draggableId={reference.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-6 transition-shadow ${snapshot.isDragging ? "shadow-lg" : ""}`}
                      >
                        <div className="flex gap-4">
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-start pt-2 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-5 h-5 text-muted-foreground" />
                          </div>

                          <div className="flex-1 space-y-4">
                            {editingId === reference.id ? (
                              <>
                                <Input
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  placeholder="Reference title"
                                  className="font-semibold text-lg"
                                  autoFocus
                                />
                                <Textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  placeholder="Add reference content, links, or notes..."
                                  rows={8}
                                  className="resize-none"
                                />
                                <Button size="sm" variant="outline" onClick={handleFinishEditing}>
                                  Done Editing
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-4">
                                  <h3
                                    className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleStartEditing(reference)}
                                  >
                                    {reference.title}
                                  </h3>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleCopyReference(reference)}
                                      className="hover:bg-muted"
                                      title="Copy reference"
                                    >
                                      {copiedId === reference.id ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDeleteReference(reference.id)}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <p
                                  className="text-muted-foreground whitespace-pre-wrap cursor-pointer hover:text-foreground transition-colors"
                                  onClick={() => handleStartEditing(reference)}
                                >
                                  {truncateContent(reference.content)}
                                </p>
                                {reference.content.length > 150 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStartEditing(reference)}
                                    className="text-xs text-primary hover:text-primary/80"
                                  >
                                    Click to view full content
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { TextBlock as TextBlockType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X, Sparkles, Upload } from "lucide-react"
import { usePlanStore } from "@/lib/store"
import ReactMarkdown from "react-markdown"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

interface TextBlockProps {
  block: TextBlockType
  dragHandleProps?: any
  accentColor?: string // Added accent color prop from parent section
}

export function TextBlock({ block, dragHandleProps, accentColor = "#1DB5C4" }: TextBlockProps) {
  const { updateBlock, deleteBlock, currentPlan } = usePlanStore()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(block.title)
  const [content, setContent] = useState(block.content)
  const [useHtml, setUseHtml] = useState(block.useHtml || false)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [aiInstructions, setAiInstructions] = useState("")
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [image, setImage] = useState(block.image || "")
  const [imagePosition, setImagePosition] = useState<"above" | "below">(block.imagePosition || "above")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [references, setReferences] = useState<any[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [loadingReferences, setLoadingReferences] = useState(false)
  const [includeEntirePlan, setIncludeEntirePlan] = useState(false)

  useEffect(() => {
    setTitle(block.title)
    setContent(block.content)
    setImage(block.image || "")
    setImagePosition(block.imagePosition || "above")
    setUseHtml(block.useHtml || false)
  }, [block.title, block.content, block.image, block.imagePosition, block.useHtml])

  useEffect(() => {
    if (showAIDialog) {
      fetchReferences()
    }
  }, [showAIDialog])

  const fetchReferences = async () => {
    if (!currentPlan?.id) return

    setLoadingReferences(true)
    try {
      const response = await fetch(`/api/plans/${currentPlan.id}/references`)
      if (response.ok) {
        const data = await response.json()
        setReferences(data.references || [])
      }
    } catch (error) {
      console.error("Error fetching references:", error)
    } finally {
      setLoadingReferences(false)
    }
  }

  const handleAIEdit = async () => {
    if (!aiInstructions.trim()) {
      toast({ title: "Please provide editing instructions", variant: "destructive" })
      return
    }

    setIsGeneratingAI(true)
    try {
      const response = await fetch(`/api/plans/${currentPlan?.id}/edit-with-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId: block.id,
          blockTitle: block.title,
          blockContent: block.content,
          blockType: block.type,
          instructions: aiInstructions,
          clientName: currentPlan?.clientName,
          objective: currentPlan?.objective,
          referenceIds: selectedReferenceIds,
          includeEntirePlan,
          useHtml,
        }),
      })

      if (!response.ok) throw new Error("Failed to edit with AI")

      const data = await response.json()

      setContent(data.content)
      updateBlock(block.id, { content: data.content })

      setShowAIDialog(false)
      setAiInstructions("")
      setSelectedReferenceIds([])
      setIncludeEntirePlan(false)
      toast({ title: "Content updated with AI" })
    } catch (error) {
      console.error("Error editing with AI:", error)
      toast({ title: "Failed to edit with AI", variant: "destructive" })
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const toggleReference = (refId: string) => {
    setSelectedReferenceIds((prev) => (prev.includes(refId) ? prev.filter((id) => id !== refId) : [...prev, refId]))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const renderImage = () => {
    if (!image) return null
    return (
      <div className="relative group/img">
        <img src={image || "/placeholder.svg"} alt={title} className="w-full rounded-lg" />
        {isEditing && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity"
            onClick={() => setImage("")}
          >
            Remove
          </Button>
        )}
      </div>
    )
  }

  const sanitizeHtml = (html: string) => {
    return html
      .replace(/<html[^>]*>/gi, "")
      .replace(/<\/html>/gi, "")
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<body[^>]*>/gi, "")
      .replace(/<\/body>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts for security
  }

  const [editingField, setEditingField] = useState<"title" | "content" | null>(null)

  const saveInlineField = (field: "title" | "content") => {
    updateBlock(block.id, { [field]: field === "title" ? title : content })
    setEditingField(null)
  }

  return (
    <div className="relative group py-6">
      <div className="hidden" {...dragHandleProps} />

      {/* Title with underline accent */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          {isEditing || editingField === "title" ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (editingField === "title") saveInlineField("title") }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (editingField === "title") saveInlineField("title") }
                if (e.key === "Escape") { setTitle(block.title); setEditingField(null) }
              }}
              className="font-bold text-xl h-auto py-0 border-none shadow-none bg-transparent focus-visible:ring-1 font-heading"
              autoFocus={editingField === "title"}
            />
          ) : (
            block.title && (
              <h3
                className="font-heading font-bold text-xl text-foreground leading-tight cursor-text hover:opacity-60 transition-opacity"
                onClick={() => { setTitle(block.title); setEditingField("title") }}
              >
                {block.title}
              </h3>
            )
          )}
          {/* Colored underline */}
          {block.title && !isEditing && (
            <div className="mt-2 h-[3px] w-12 rounded-full" style={{ backgroundColor: accentColor }} />
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-4 flex-shrink-0">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  updateBlock(block.id, { title, content, image, imagePosition, useHtml })
                  setIsEditing(false)
                }}
                className="h-7 w-7 text-green-600"
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTitle(block.title)
                  setContent(block.content)
                  setImage(block.image || "")
                  setImagePosition(block.imagePosition || "above")
                  setUseHtml(block.useHtml || false)
                  setIsEditing(false)
                }}
                className="h-7 w-7 text-red-600"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => setShowAIDialog(true)} className="h-7 w-7">
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-7 w-7">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteBlock(block.id)}
                className="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!isEditing && imagePosition === "above" && renderImage()}

      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <input
              type="checkbox"
              id={`html-mode-${block.id}`}
              checked={useHtml}
              onChange={(e) => setUseHtml(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor={`html-mode-${block.id}`} className="text-sm font-medium text-foreground cursor-pointer">
              Use HTML formatting
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Image (optional)</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(`image-upload-${block.id}`)?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              <input
                id={`image-upload-${block.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              {image && (
                <Select value={imagePosition} onValueChange={(val: "above" | "below") => setImagePosition(val)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above text</SelectItem>
                    <SelectItem value="below">Below text</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {image && <div className="mt-2">{renderImage()}</div>}
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[150px] resize-y font-mono text-sm"
          />
        </div>
      ) : editingField === "content" ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => saveInlineField("content")}
          onKeyDown={(e) => { if (e.key === "Escape") { setContent(block.content); setEditingField(null) } }}
          className="min-h-[200px] text-[13.5px] leading-[1.8] text-muted-foreground border-none shadow-none bg-transparent focus-visible:ring-1 resize-y"
          autoFocus
        />
      ) : (
        <div
          className="prose prose-sm max-w-none cursor-text hover:opacity-70 transition-opacity"
          onClick={() => { setContent(block.content); setEditingField("content") }}
        >
          {useHtml ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />
          ) : (
            <ReactMarkdown
              components={{
                h2: ({ node, ...props }) => (
                  <h2 className="text-base font-semibold text-foreground mt-5 mb-3" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-sm font-semibold text-foreground mt-4 mb-2" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="mb-3 leading-[1.75] text-[14px] text-muted-foreground" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="mb-3 space-y-1.5 text-[14px] text-muted-foreground" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="mb-3 space-y-1.5 text-[14px] text-muted-foreground" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="text-foreground font-semibold" {...props} />
                ),
              }}
            >
              {block.content}
            </ReactMarkdown>
          )}
        </div>
      )}

      {!isEditing && imagePosition === "below" && renderImage()}

      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-6 overflow-y-auto flex-1">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">What would you like to change?</label>
              <Textarea
                placeholder="e.g., Make it more concise, Add more details about benefits, Change tone to be more formal..."
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                className="min-h-[120px] text-base"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Include Context (optional)</label>
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                <input
                  type="checkbox"
                  id="include-plan-text"
                  checked={includeEntirePlan}
                  onChange={(e) => setIncludeEntirePlan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="include-plan-text" className="flex-1 cursor-pointer text-sm">
                  <div className="font-medium text-foreground">Include Entire Marketing Plan</div>
                  <div className="text-xs text-muted-foreground">
                    Provides AI with full plan context for better consistency
                  </div>
                </label>
              </div>
            </div>

            {!loadingReferences && references.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Include References (optional)</label>
                <p className="text-sm text-muted-foreground">
                  Select references to provide additional context for the AI
                </p>
                <div className="space-y-2 max-h-[280px] overflow-y-auto border rounded-lg p-4 bg-muted/30">
                  {references.map((ref) => (
                    <label
                      key={ref.id}
                      className="flex items-start gap-3 cursor-pointer hover:bg-background p-3 rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReferenceIds.includes(ref.id)}
                        onChange={() => toggleReference(ref.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-1">{ref.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {ref.content?.substring(0, 150)}...
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowAIDialog(false)
                setAiInstructions("")
                setSelectedReferenceIds([])
                setIncludeEntirePlan(false)
              }}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button onClick={handleAIEdit} disabled={isGeneratingAI} className="min-w-[120px]">
              {isGeneratingAI ? "Editing..." : "Edit with AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

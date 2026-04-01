"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { TacticBlock as TacticBlockType, Reference } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X, Clock, Calendar, Sparkles, Upload, Quote } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { formatDate, getMonthsBetween, formatMonthKey } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { IconPicker } from "@/components/icon-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"

interface TacticBlockProps {
  block: TacticBlockType
  dragHandleProps?: any
  accentColor?: string // Added accent color prop from parent section
}

export function TacticBlock({ block, dragHandleProps, accentColor = "#FF6B35" }: TacticBlockProps) {
  const { updateBlock, deleteBlock, currentPlan } = usePlanStore()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(block.title)
  const [content, setContent] = useState(block.content)
  const [useHtml, setUseHtml] = useState(block.useHtml || false)
  const [hours, setHours] = useState(block.hours)
  const [hoursByMonth, setHoursByMonth] = useState<Record<string, number>>(block.hoursByMonth || {})
  const [startDate, setStartDate] = useState(block.startDate)
  const [endDate, setEndDate] = useState(block.endDate)
  const [icon, setIcon] = useState(block.icon || "Package")
  const [image, setImage] = useState(block.image || "")
  const [imagePosition, setImagePosition] = useState<"above" | "below">(block.imagePosition || "above")
  const [deliverable, setDeliverable] = useState(block.deliverable || "")
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [aiInstructions, setAiInstructions] = useState("")
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [references, setReferences] = useState<Reference[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [loadingReferences, setLoadingReferences] = useState(false)

  const [budgetEnabled, setBudgetEnabled] = useState(block.budgetEnabled || false)
  const [budgetTiers, setBudgetTiers] = useState(
    block.budgetTiers || {
      minimum: { amount: 2000, scope: "Search Only (Focus on key markets)" },
      recommended: { amount: 4000, scope: "Search + Retargeting + Expansion" },
      aggressive: { amount: 8000, scope: "Regional Dominance + Video Ads" },
    },
  )

  const [isDragging, setIsDragging] = useState(false)
  const [includeEntirePlan, setIncludeEntirePlan] = useState(false)

  useEffect(() => {
    setTitle(block.title)
    setContent(block.content)
    setUseHtml(block.useHtml || false)
    setHours(block.hours)
    setHoursByMonth(block.hoursByMonth || {})
    setStartDate(block.startDate)
    setEndDate(block.endDate)
    setIcon(block.icon || "Package")
    setImage(block.image || "")
    setImagePosition(block.imagePosition || "above")
    setDeliverable(block.deliverable || "")
    setBudgetEnabled(block.budgetEnabled || false)
    setBudgetTiers(
      block.budgetTiers || {
        minimum: { amount: 2000, scope: "Search Only (Focus on key markets)" },
        recommended: { amount: 4000, scope: "Search + Retargeting + Expansion" },
        aggressive: { amount: 8000, scope: "Regional Dominance + Video Ads" },
      },
    )
  }, [block])

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

  const toggleReference = (refId: string) => {
    setSelectedReferenceIds((prev) => (prev.includes(refId) ? prev.filter((id) => id !== refId) : [...prev, refId]))
  }

  const handleSave = () => {
    // If monthly hours are set, total hours = sum of monthly values
    const hasMonthlyHours = Object.values(hoursByMonth).some((v) => v > 0)
    const totalHours = hasMonthlyHours
      ? Object.values(hoursByMonth).reduce((sum, v) => sum + (v || 0), 0)
      : Number(hours)

    updateBlock(block.id, {
      title,
      content,
      useHtml,
      hours: totalHours,
      hoursByMonth: hasMonthlyHours ? hoursByMonth : undefined,
      startDate,
      endDate,
      icon,
      image,
      imagePosition,
      deliverable,
      budgetEnabled,
      budgetTiers,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setTitle(block.title)
    setContent(block.content)
    setUseHtml(block.useHtml || false)
    setHours(block.hours)
    setHoursByMonth(block.hoursByMonth || {})
    setStartDate(block.startDate)
    setEndDate(block.endDate)
    setIcon(block.icon || "Package")
    setImage(block.image || "")
    setImagePosition(block.imagePosition || "above")
    setDeliverable(block.deliverable || "")
    setBudgetEnabled(block.budgetEnabled || false)
    setBudgetTiers(
      block.budgetTiers || {
        minimum: { amount: 2000, scope: "Search Only (Focus on key markets)" },
        recommended: { amount: 4000, scope: "Search + Retargeting + Expansion" },
        aggressive: { amount: 8000, scope: "Regional Dominance + Video Ads" },
      },
    )
    setIsEditing(false)
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
          blockType: block.type, // Pass block type
          currentIcon: block.icon, // Pass current icon
          instructions: aiInstructions,
          referenceIds: selectedReferenceIds,
          includeEntirePlan,
          clientName: currentPlan?.clientName,
          objective: currentPlan?.objective,
          useHtml,
        }),
      })

      if (!response.ok) throw new Error("Failed to edit with AI")

      const data = await response.json()

      setContent(data.content)
      const updates: any = { content: data.content }

      if (data.icon && data.icon !== block.icon) {
        setIcon(data.icon)
        updates.icon = data.icon
        console.log("[v0] Icon updated from", block.icon, "to", data.icon)
      }

      updateBlock(block.id, updates)

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
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

  const IconComponent = (LucideIcons as any)[block.icon || "Package"] || LucideIcons.Package

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

  return (
    <div
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all relative group border border-border border-l-4 mb-5"
      style={{ borderLeftColor: accentColor }} // Use dynamic accent color
    >
      <div className="hidden" {...dragHandleProps} />

      <div className="pl-12 pr-8 pt-8 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-lg"
                style={{ backgroundColor: `${accentColor}1A` }} // Use accent color with transparency for icon background
              >
                <IconComponent
                  className="w-5 h-5"
                  style={{ color: accentColor }} // Use accent color for icon
                />
              </div>
              {isEditing ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-semibold text-lg h-auto py-1 flex-1"
                />
              ) : (
                <h3 className="font-heading font-bold text-2xl text-foreground flex-1">{block.title}</h3>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={handleSave} className="h-8 w-8 text-green-600">
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8 text-red-600">
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowAIDialog(true)} className="h-8 w-8">
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteBlock(block.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!isEditing && <div className="mt-4 border-t border-border/20" />}
      </div>

      <div className="pl-12 pr-8 pb-6 space-y-4">
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

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Image (optional)</label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {isDragging ? "Drop image here" : "Drag and drop an image, or click to browse"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(`image-upload-${block.id}`)?.click()}
                >
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
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-xs text-green-600 font-medium">✓ Image uploaded</span>
                    <Select value={imagePosition} onValueChange={(val: "above" | "below") => setImagePosition(val)}>
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Above text</SelectItem>
                        <SelectItem value="below">Below text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {image && <div className="mt-2">{renderImage()}</div>}
            </div>

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[280px] font-mono text-sm"
              placeholder={useHtml ? "Enter HTML content (What, Why, How)..." : "Enter markdown content (What, Why, How)..."}
            />

            {/* Deliverable Field */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Deliverable
              </label>
              <Textarea
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="e.g., A 15-page Brand Style Guide (PDF) including primary and secondary color palettes, typography pairings..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Hours by month */}
            {(() => {
              const months = startDate && endDate ? getMonthsBetween(startDate, endDate) : []
              if (months.length <= 1) {
                return (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Hours</label>
                    <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                  </div>
                )
              }
              const monthlyTotal = Object.values(hoursByMonth).reduce((s, v) => s + (v || 0), 0)
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Hours by Month</label>
                    <span className="text-xs text-muted-foreground">
                      Total: <span className="font-bold text-foreground">{monthlyTotal}</span> hrs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {months.map((monthKey) => (
                      <div key={monthKey} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{formatMonthKey(monthKey)}</label>
                        <Input
                          type="number"
                          min={0}
                          value={hoursByMonth[monthKey] || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value)
                            setHoursByMonth((prev) => ({ ...prev, [monthKey]: val }))
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`budget-enabled-${block.id}`}
                  checked={budgetEnabled}
                  onChange={(e) => setBudgetEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor={`budget-enabled-${block.id}`}
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Include Budget Tiers
                </label>
              </div>

              {budgetEnabled && (
                <div className="space-y-4 pl-6">
                  <p className="text-xs text-muted-foreground">Define budget options for this tactic</p>

                  {/* Minimum Tier */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Minimum Tier</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Monthly Budget</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            value={budgetTiers.minimum?.amount || 0}
                            onChange={(e) =>
                              setBudgetTiers({
                                ...budgetTiers,
                                minimum: { ...budgetTiers.minimum!, amount: Number(e.target.value) },
                              })
                            }
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Scope of Impact</label>
                        <Input
                          value={budgetTiers.minimum?.scope || ""}
                          onChange={(e) =>
                            setBudgetTiers({
                              ...budgetTiers,
                              minimum: { ...budgetTiers.minimum!, scope: e.target.value },
                            })
                          }
                          placeholder="e.g., Search Only"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recommended Tier */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Recommended Tier</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Monthly Budget</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            value={budgetTiers.recommended?.amount || 0}
                            onChange={(e) =>
                              setBudgetTiers({
                                ...budgetTiers,
                                recommended: { ...budgetTiers.recommended!, amount: Number(e.target.value) },
                              })
                            }
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Scope of Impact</label>
                        <Input
                          value={budgetTiers.recommended?.scope || ""}
                          onChange={(e) =>
                            setBudgetTiers({
                              ...budgetTiers,
                              recommended: { ...budgetTiers.recommended!, scope: e.target.value },
                            })
                          }
                          placeholder="e.g., Search + Retargeting"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Aggressive Tier */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Aggressive Tier</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Monthly Budget</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            value={budgetTiers.aggressive?.amount || 0}
                            onChange={(e) =>
                              setBudgetTiers({
                                ...budgetTiers,
                                aggressive: { ...budgetTiers.aggressive!, amount: Number(e.target.value) },
                              })
                            }
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Scope of Impact</label>
                        <Input
                          value={budgetTiers.aggressive?.scope || ""}
                          onChange={(e) =>
                            setBudgetTiers({
                              ...budgetTiers,
                              aggressive: { ...budgetTiers.aggressive!, scope: e.target.value },
                            })
                          }
                          placeholder="e.g., Regional Dominance"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Main Content - What, Why, How */}
            <div className="prose prose-sm max-w-none text-muted-foreground/90">
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
                    p: ({ node, ...props }) => <p className="mb-3 leading-[1.7] text-[14px]" {...props} />,
                    ul: ({ node, ...props }) => <ul className="mb-3 space-y-1.5 text-[14px]" {...props} />,
                    ol: ({ node, ...props }) => <ol className="mb-3 space-y-1.5 text-[14px]" {...props} />,
                  }}
                >
                  {block.content}
                </ReactMarkdown>
              )}
            </div>

            {/* Deliverable - Always visible */}
            {block.deliverable && (
              <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-lg border border-emerald-200/60">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Deliverable</span>
                    <p className="text-sm text-emerald-900 mt-1 leading-relaxed">{block.deliverable}</p>
                  </div>
                </div>
              </div>
            )}

            {block.evidence && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Quote className="h-4 w-4 text-muted-foreground" />
                  Evidence from Reference
                </Label>
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground italic">{block.evidence}</div>
              </div>
            )}

            {/* Evidence & Sources - Hidden/Expandable */}
            {block.sourceContext && (
              <details className="pt-4 border-t group/details">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  View Evidence & Sources
                </summary>
                <div className="mt-3 p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-lg border border-amber-200/50">
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    <ReactMarkdown
                      components={{
                        strong: ({ node, ...props }) => <strong className="text-foreground font-semibold" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 text-sm leading-relaxed" {...props} />,
                        hr: ({ node, ...props }) => <hr className="my-3 border-amber-200/50" {...props} />,
                        em: ({ node, ...props }) => <em className="text-muted-foreground/80" {...props} />,
                      }}
                    >
                      {block.sourceContext}
                    </ReactMarkdown>
                  </div>
                </div>
              </details>
            )}

            {imagePosition === "below" && renderImage()}

            {budgetEnabled && budgetTiers && (
              <div className="mt-6 border border-border/50 rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-white">
                <div
                  className="px-5 py-3 border-b border-border/30 bg-gradient-to-r"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${accentColor}1A, ${accentColor}0D)`, // Use accent color for budget table header
                  }}
                >
                  <div className="flex items-center gap-2" style={{ color: accentColor }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <span className="font-semibold text-sm uppercase tracking-wide">Monthly Ad Spend Options</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/30">
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Tier
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Monthly Budget
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Scope of Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      <tr
                        className="hover:bg-muted/20 transition-colors"
                        style={{ backgroundColor: `${accentColor}0D` }}
                      >
                        <td className="py-4 px-5 font-medium text-foreground">Minimum</td>
                        <td className="py-4 px-5 font-semibold text-foreground">
                          ${budgetTiers.minimum?.amount.toLocaleString()} / mo
                        </td>
                        <td className="py-4 px-5 text-muted-foreground">{budgetTiers.minimum?.scope}</td>
                      </tr>
                      <tr className="hover:bg-muted/20 transition-colors bg-[#FF6B35]/5">
                        <td className="py-4 px-5 font-medium text-foreground">Recommended</td>
                        <td className="py-4 px-5 font-semibold text-foreground">
                          ${budgetTiers.recommended?.amount.toLocaleString()} / mo
                        </td>
                        <td className="py-4 px-5 text-muted-foreground">{budgetTiers.recommended?.scope}</td>
                      </tr>
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="py-4 px-5 font-medium text-foreground">Aggressive</td>
                        <td className="py-4 px-5 font-semibold text-foreground">
                          ${budgetTiers.aggressive?.amount.toLocaleString()} / mo
                        </td>
                        <td className="py-4 px-5 text-muted-foreground">{budgetTiers.aggressive?.scope}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!isEditing && (
        <div className="px-8 py-4 border-t border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{block.hours}</span>
              <span className="text-muted-foreground uppercase tracking-wide text-xs">Hours</span>
              {block.hoursByMonth && Object.keys(block.hoursByMonth).length > 1 && (
                <span className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border/50">
                  {Object.entries(block.hoursByMonth)
                    .filter(([, v]) => v > 0)
                    .map(([key, val]) => (
                      <span key={key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{val}</span>
                        <span className="lowercase">{formatMonthKey(key).split(" ")[0]}</span>
                      </span>
                    ))}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: accentColor }} />
              <span className="text-muted-foreground">
                {formatDate(block.startDate)} — {formatDate(block.endDate)}
              </span>
              <span className="text-muted-foreground uppercase tracking-wide text-xs ml-2">Schedule</span>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Edit with AI</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-6">
            <div className="space-y-3">
              <label className="text-base font-medium text-foreground">What would you like to change?</label>
              <Textarea
                placeholder="e.g., Make it more concise, Add more details about benefits, Change tone to be more formal..."
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                className="min-h-[120px] text-base resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-base font-medium text-foreground">Include Context (optional)</label>
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                <input
                  type="checkbox"
                  id="include-plan"
                  checked={includeEntirePlan}
                  onChange={(e) => setIncludeEntirePlan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="include-plan" className="flex-1 cursor-pointer text-sm">
                  <div className="font-medium text-foreground">Include Entire Marketing Plan</div>
                  <div className="text-xs text-muted-foreground">
                    Provides AI with full plan context for better consistency
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-base font-medium text-foreground">Include References (optional)</label>
              <p className="text-sm text-muted-foreground">
                Select references to provide additional context for the AI
              </p>

              {loadingReferences ? (
                <div className="text-sm text-muted-foreground">Loading references...</div>
              ) : !Array.isArray(references) || references.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No references available. Add references in the References tab to use them here.
                </div>
              ) : (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30 max-h-[240px] overflow-y-auto">
                  {references.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-start gap-3 p-3 rounded-md hover:bg-background/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`ref-${ref.id}`}
                        checked={selectedReferenceIds.includes(ref.id)}
                        onChange={() => toggleReference(ref.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`ref-${ref.id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium text-foreground">{ref.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {ref.content.slice(0, 150)}
                          {ref.content.length > 150 && "..."}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t">
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
            <Button
              onClick={handleAIEdit}
              disabled={isGeneratingAI || !aiInstructions.trim()}
              className="min-w-[140px]"
            >
              {isGeneratingAI ? "Editing..." : "Edit with AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

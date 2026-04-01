"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { TacticBlock as TacticBlockType, Reference } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X, Clock, Calendar, Sparkles, Upload, Quote, Search, Plus, Radio, DollarSign, CalendarRange, Settings2 } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { formatDate, getMonthsBetween, formatMonthKey } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { IconPicker } from "@/components/icon-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"

interface TacticBlockProps {
  block: TacticBlockType
  dragHandleProps?: any
  accentColor?: string // Added accent color prop from parent section
}

const ICON_OPTIONS = [
  'Target', 'TrendingUp', 'BarChart', 'Users', 'Mail', 'Calendar',
  'Clock', 'Zap', 'Award', 'Bookmark', 'Camera', 'Database',
  'FileText', 'Film', 'Image', 'Lightbulb', 'Map', 'MessageSquare',
  'Newspaper', 'Package', 'Palette', 'Search', 'Settings', 'Share2',
  'ShoppingCart', 'Smartphone', 'Star', 'Tag', 'ThumbsUp', 'Video',
  'Globe', 'Heart', 'Home', 'Key', 'Layers', 'Layout', 'Link',
  'Monitor', 'Music', 'PenTool', 'Printer', 'Shield', 'Speaker',
  'Truck', 'Wifi', 'Wrench', 'Activity', 'Aperture', 'Box',
  'Briefcase', 'Coffee', 'Compass', 'Cpu', 'Eye', 'Feather',
  'Flag', 'Gift', 'Grid', 'Headphones', 'Hexagon', 'Megaphone',
]

// Default plan-level tier definitions
const DEFAULT_TIER_DEFS = [
  { id: "minimum", name: "Minimum", order: 0 },
  { id: "recommended", name: "Recommended", order: 1 },
  { id: "aggressive", name: "Aggressive", order: 2 },
]

// Smart distribution: rounds to whole numbers while preserving the total
function smartDistributeHours(totalHours: number, startDateStr: string, endDateStr: string): Record<string, number> {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  const monthly: Array<{ key: string; days: number }> = []
  const cur = new Date(start)
  while (cur <= end) {
    const monthKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const rangeStart = monthStart < start ? start : monthStart
    const rangeEnd = monthEnd > end ? end : monthEnd
    const days = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    monthly.push({ key: monthKey, days })
    cur.setMonth(cur.getMonth() + 1)
    cur.setDate(1)
  }

  // Distribute proportionally then round using largest remainder method
  const rawShares = monthly.map(m => (m.days / totalDays) * totalHours)
  const floored = rawShares.map(v => Math.floor(v))
  let remainder = totalHours - floored.reduce((s, v) => s + v, 0)

  // Sort by fractional part descending, give 1 hour to each until remainder is gone
  const indexed = rawShares.map((v, i) => ({ i, frac: v - Math.floor(v) }))
  indexed.sort((a, b) => b.frac - a.frac)
  for (const item of indexed) {
    if (remainder <= 0) break
    floored[item.i] += 1
    remainder -= 1
  }

  const result: Record<string, number> = {}
  monthly.forEach((m, i) => { if (floored[i] > 0) result[m.key] = floored[i] })
  return result
}

const DEFAULT_BUDGET_TIERS: Record<string, { amount: number; scope: string }> = {
  minimum: { amount: 2000, scope: "Search Only (Focus on key markets)" },
  recommended: { amount: 4000, scope: "Search + Retargeting + Expansion" },
  aggressive: { amount: 8000, scope: "Regional Dominance + Video Ads" },
}

export function TacticBlock({ block, dragHandleProps, accentColor = "#1DB5C4" }: TacticBlockProps) {
  const { updateBlock, deleteBlock, currentPlan, updatePlan } = usePlanStore()
  const [isEditing, setIsEditing] = useState(false)
  // Inline editing states
  const [editingField, setEditingField] = useState<"title" | "content" | "hours" | "dates" | "deliverable" | "mediaFlights" | null>(null)
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
  const [budgetMode, setBudgetMode] = useState<"scenario" | "fixed">(block.budgetMode || "scenario")
  const [budgetTiers, setBudgetTiers] = useState<Record<string, { amount: number; scope: string }>>(
    block.budgetTiers || DEFAULT_BUDGET_TIERS,
  )

  const [mediaFlights, setMediaFlights] = useState<Array<{ startDate: string; endDate: string; label?: string }>>(block.mediaFlights || [])
  const [budgetByMonth, setBudgetByMonth] = useState<Record<string, number>>(block.budgetByMonth || {})
  const [editingBudgetCell, setEditingBudgetCell] = useState<{ tier: string; field: 'amount' | 'scope' } | null>(null)
  const [editingMonthBudget, setEditingMonthBudget] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [includeEntirePlan, setIncludeEntirePlan] = useState(false)

  // Plan-level tier definitions
  const tierDefs = currentPlan?.budgetTierDefs || DEFAULT_TIER_DEFS
  const sortedTierDefs = [...tierDefs].sort((a, b) => a.order - b.order)
  const [showTierManager, setShowTierManager] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconSearch, setIconSearch] = useState("")
  const [editableTierDefs, setEditableTierDefs] = useState(tierDefs)

  const saveTierDefs = () => {
    updatePlan({ budgetTierDefs: editableTierDefs })
    setShowTierManager(false)
  }

  const addTierDef = () => {
    const id = `tier_${Date.now()}`
    setEditableTierDefs([...editableTierDefs, { id, name: "New Tier", order: editableTierDefs.length }])
  }

  const removeTierDef = (id: string) => {
    setEditableTierDefs(editableTierDefs.filter(t => t.id !== id))
  }

  const updateTierDefName = (id: string, name: string) => {
    setEditableTierDefs(editableTierDefs.map(t => t.id === id ? { ...t, name } : t))
  }

  // Save a single field inline and close editing
  const saveField = (field: typeof editingField) => {
    if (!field) return
    const hasMonthlyHours = Object.values(hoursByMonth).some((v) => v > 0)
    const totalHours = hasMonthlyHours
      ? Object.values(hoursByMonth).reduce((sum, v) => sum + (v || 0), 0)
      : Number(hours)

    const updates: Record<string, any> = {}
    switch (field) {
      case "title":
        updates.title = title
        break
      case "content":
        updates.content = content
        break
      case "hours":
        updates.hours = totalHours
        if (hasMonthlyHours) updates.hoursByMonth = hoursByMonth
        break
      case "dates":
        updates.startDate = startDate
        updates.endDate = endDate
        break
      case "deliverable":
        updates.deliverable = deliverable
        break
    }
    updateBlock(block.id, updates)
    setEditingField(null)
  }

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
    setBudgetMode(block.budgetMode || "scenario")
    setBudgetTiers(block.budgetTiers || DEFAULT_BUDGET_TIERS)
    setMediaFlights(block.mediaFlights || [])
    setBudgetByMonth(block.budgetByMonth || {})
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
      budgetMode,
      budgetTiers,
      budgetByMonth,
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
    setBudgetMode(block.budgetMode || "scenario")
    setBudgetTiers(block.budgetTiers || DEFAULT_BUDGET_TIERS)
    setBudgetByMonth(block.budgetByMonth || {})
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

  // Parse content into What/Why/How sections if present
  const parseWhatWhyHow = (text: string): { sections: Array<{ label: string; content: string }> | null } => {
    // Match patterns like **What:** ..., ## What, or --what
    const sectionRegex = /(?:^|\n)(?:#{1,3}\s*|(?:\*\*))?(What|Why|How)(?:\*\*)?[:\s]*(?:\*\*)?/gi
    const matches = [...text.matchAll(sectionRegex)]

    if (matches.length < 2) return { sections: null } // Need at least 2 sections to style

    const sections: Array<{ label: string; content: string }> = []
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const label = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
      const startIdx = (match.index || 0) + match[0].length
      const endIdx = i + 1 < matches.length ? matches[i + 1].index || text.length : text.length
      const content = text.slice(startIdx, endIdx).trim()
      if (content) sections.push({ label, content })
    }

    // Check if there's content before the first section marker
    const preContent = text.slice(0, matches[0].index || 0).trim()
    if (preContent) {
      sections.unshift({ label: '', content: preContent })
    }

    return { sections: sections.length > 0 ? sections : null }
  }

  const mdComponents = {
    p: ({ node, ...props }: any) => <p className="mb-3 last:mb-0 leading-[1.85] text-sm text-muted-foreground" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="mb-3 last:mb-0 space-y-1.5 list-disc pl-5 text-sm text-muted-foreground marker:text-muted-foreground/40" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="mb-3 last:mb-0 space-y-1.5 list-decimal pl-5 text-sm text-muted-foreground marker:text-muted-foreground/40" {...props} />,
    li: ({ node, ...props }: any) => <li className="leading-[1.75] pl-1" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="text-foreground font-semibold" {...props} />,
    em: ({ node, ...props }: any) => <em className="text-muted-foreground/70" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-sm font-semibold text-foreground mt-4 mb-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-xs font-semibold text-foreground mt-3 mb-1.5" {...props} />,
  }

  const WWH_COLORS: Record<string, string> = {
    What: '#1DB5C4',  // Strategic Teal
    Why: '#FF9500',   // Primary Orange
    How: '#2A3441',   // Executive Dark
  }

  const renderStyledContent = () => {
    if (useHtml) {
      return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />
    }

    const { sections } = parseWhatWhyHow(block.content)

    if (sections) {
      return (
        <div className="space-y-6">
          {sections.map((section, idx) => {
            if (!section.label) {
              return (
                <div key={idx}>
                  <ReactMarkdown components={mdComponents}>{section.content}</ReactMarkdown>
                </div>
              )
            }

            const labelColor = WWH_COLORS[section.label] || accentColor

            return (
              <div key={idx}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-5 h-[2.5px] rounded-full" style={{ backgroundColor: labelColor }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: labelColor }}>
                    {section.label}
                  </span>
                </div>
                <ReactMarkdown components={mdComponents}>{section.content}</ReactMarkdown>
              </div>
            )
          })}
        </div>
      )
    }

    // Fallback: regular markdown
    return <ReactMarkdown components={mdComponents}>{block.content}</ReactMarkdown>
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

  const hasEvidence = !!(block.sourceContext || block.evidence)

  return (
    <div className="relative group py-8 border-b border-border/30 last:border-b-0">
      <div className="hidden" {...dragHandleProps} />

      {/* Header: accent bar + icon + title + action icons */}
      <div className="flex items-center gap-4 mb-5">
        {/* Left accent bar */}
        <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accentColor, opacity: 0.35 }} />

        <Popover open={iconPickerOpen} onOpenChange={(open) => { setIconPickerOpen(open); if (open) setIconSearch("") }}>
          <PopoverTrigger asChild>
            <button
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
              style={{ backgroundColor: `${accentColor}12` }}
              title="Change icon"
            >
              <IconComponent className="w-5 h-5" style={{ color: accentColor }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start" side="bottom">
            <Input
              placeholder="Search icons..."
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              className="h-8 text-xs mb-2"
              autoFocus
            />
            <ScrollArea className="h-48">
              <div className="grid grid-cols-6 gap-1">
                {ICON_OPTIONS
                  .filter(name => !iconSearch || name.toLowerCase().includes(iconSearch.toLowerCase()))
                  .map((name) => {
                    const Ic = (LucideIcons as any)[name] || LucideIcons.Package
                    const isSelected = (block.icon || "Package") === name
                    return (
                      <button
                        key={name}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-muted'}`}
                        style={isSelected ? { backgroundColor: `${accentColor}20`, boxShadow: `0 0 0 2px ${accentColor}` } : {}}
                        onClick={() => {
                          setIcon(name)
                          updateBlock(block.id, { icon: name })
                          setIconPickerOpen(false)
                        }}
                        title={name}
                      >
                        <Ic className="w-4 h-4" style={{ color: isSelected ? accentColor : undefined }} />
                      </button>
                    )
                  })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <div className="flex-1 min-w-0">
          {editingField === "title" || isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (editingField === "title") saveField("title") }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField("title") } if (e.key === "Escape") { setTitle(block.title); setEditingField(null) } }}
              className="font-semibold text-xl h-auto py-0 border-none shadow-none bg-transparent focus-visible:ring-1 font-heading"
              autoFocus={editingField === "title"}
            />
          ) : (
            <h3
              className="font-heading font-semibold text-xl text-foreground cursor-text hover:opacity-60 transition-opacity leading-snug"
              onClick={() => { setTitle(block.title); setEditingField("title") }}
            >
              {block.title}
            </h3>
          )}
        </div>

        {/* Right-side icons — all hidden until hover */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Evidence slide-out */}
          {hasEvidence && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600/70 hover:text-amber-700 hover:bg-amber-50/50">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-amber-600" />
                    Evidence & Sources
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    {block.title}
                  </p>
                  {block.evidence && (
                    <div className="p-4 bg-amber-50/50 rounded-lg text-sm text-foreground/80 italic border-l-3 border-amber-400 leading-relaxed">
                      {block.evidence}
                    </div>
                  )}
                  {block.sourceContext && (
                    <div className="prose prose-sm max-w-none text-muted-foreground">
                      <ReactMarkdown
                        components={{
                          strong: ({ node, ...props }) => <strong className="text-foreground font-semibold" {...props} />,
                          p: ({ node, ...props }) => <p className="mb-3 text-sm leading-relaxed" {...props} />,
                          hr: ({ node, ...props }) => <hr className="my-4 border-border/50" {...props} />,
                          em: ({ node, ...props }) => <em className="text-muted-foreground/70" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-base font-semibold text-foreground mt-5 mb-2" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-sm font-semibold text-foreground mt-4 mb-2" {...props} />,
                          ul: ({ node, ...props }) => <ul className="mb-3 space-y-1 text-sm" {...props} />,
                          ol: ({ node, ...props }) => <ol className="mb-3 space-y-1 text-sm" {...props} />,
                        }}
                      >
                        {block.sourceContext}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setShowAIDialog(true)} className="h-7 w-7">
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-7 w-7">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteBlock(block.id)} className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editing Sheet — slides in from right */}
      <Sheet open={isEditing} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <SheetContent className="!w-[680px] sm:!max-w-[680px] overflow-y-auto p-6" side="right">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <IconComponent className="w-5 h-5" style={{ color: accentColor }} />
              Edit: {block.title}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
              </div>
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
                  Include Budget
                </label>
              </div>

              {budgetEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground">Budget Mode:</label>
                    <Select value={budgetMode} onValueChange={(val: "scenario" | "fixed") => setBudgetMode(val)}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scenario">Scenario Tiers</SelectItem>
                        <SelectItem value="fixed">Fixed Monthly Budget</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {budgetMode === "scenario" ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Budget tiers are defined at the plan level. Edit amounts and scope per tactic below.</p>
                      {sortedTierDefs.map((tierDef) => (
                        <div key={tierDef.id} className="space-y-2">
                          <label className="text-xs font-semibold text-foreground">{tierDef.name}</label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Monthly Budget</label>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">$</span>
                                <Input
                                  type="number"
                                  value={budgetTiers[tierDef.id]?.amount || 0}
                                  onChange={(e) =>
                                    setBudgetTiers({
                                      ...budgetTiers,
                                      [tierDef.id]: { ...(budgetTiers[tierDef.id] || { amount: 0, scope: "" }), amount: Number(e.target.value) },
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
                                value={budgetTiers[tierDef.id]?.scope || ""}
                                onChange={(e) =>
                                  setBudgetTiers({
                                    ...budgetTiers,
                                    [tierDef.id]: { ...(budgetTiers[tierDef.id] || { amount: 0, scope: "" }), scope: e.target.value },
                                  })
                                }
                                placeholder="e.g., Search Only"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Monthly budget allocation. Months are pre-filled from the tactic date range.</p>
                      {(() => {
                        // Get months from date range
                        const dateMonths = startDate && endDate ? getMonthsBetween(startDate, endDate) : []
                        // Also include any months already in budgetByMonth that aren't in the date range
                        const existingMonths = Object.keys(budgetByMonth).filter(k => !dateMonths.includes(k))
                        const allMonths = [...dateMonths, ...existingMonths].sort()
                        const monthTotal = Object.values(budgetByMonth).reduce((s, v) => s + (v || 0), 0)

                        const addNextMonth = () => {
                          const last = allMonths.length > 0 ? allMonths[allMonths.length - 1] : (startDate ? startDate.slice(0, 7) : new Date().toISOString().slice(0, 7))
                          const [y, m] = last.split("-").map(Number)
                          const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
                          setBudgetByMonth((prev) => ({ ...prev, [nextMonth]: 0 }))
                        }

                        return (
                          <>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/40 border-b">
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Month</th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</th>
                                    <th className="w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allMonths.map((monthKey) => (
                                    <tr key={monthKey} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                                      <td className="py-2 px-3 text-xs font-medium text-foreground">{formatMonthKey(monthKey)}</td>
                                      <td className="py-1.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-xs text-muted-foreground">$</span>
                                          <Input
                                            type="number"
                                            min={0}
                                            value={budgetByMonth[monthKey] || ""}
                                            placeholder="0"
                                            onChange={(e) => {
                                              const val = e.target.value === "" ? 0 : Number(e.target.value)
                                              setBudgetByMonth((prev) => ({ ...prev, [monthKey]: val }))
                                            }}
                                            className="w-24 h-7 text-right text-sm"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-1">
                                        {!dateMonths.includes(monthKey) && (
                                          <button
                                            onClick={() => {
                                              const updated = { ...budgetByMonth }
                                              delete updated[monthKey]
                                              setBudgetByMonth(updated)
                                            }}
                                            className="text-muted-foreground/40 hover:text-destructive transition-colors"
                                            title="Remove month"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {allMonths.length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="py-4 text-center text-xs text-muted-foreground italic">
                                        Set start and end dates first to allocate monthly budgets.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                {allMonths.length > 0 && (
                                  <tfoot>
                                    <tr className="bg-muted/30 border-t">
                                      <td className="py-2 px-3 text-xs font-bold text-foreground">Total</td>
                                      <td className="py-2 px-3 text-right text-xs font-bold text-foreground">${monthTotal.toLocaleString()}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                            {allMonths.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground gap-1"
                                onClick={addNextMonth}
                              >
                                <Plus className="w-3 h-3" /> Add Month
                              </Button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="space-y-3">
        {imagePosition === "above" && renderImage()}

          {/* Main Content - What, Why, How */}
            {editingField === "content" ? (
              <div className="space-y-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onBlur={() => saveField("content")}
                  onKeyDown={(e) => { if (e.key === "Escape") { setContent(block.content); setEditingField(null) } }}
                  className="min-h-[200px] text-[13.5px] leading-[1.8] text-muted-foreground border-none shadow-none bg-transparent focus-visible:ring-1 resize-y"
                  placeholder="Use **What:** **Why:** **How:** to auto-style sections..."
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Press Escape to cancel, click outside to save. Use <code className="bg-muted px-1 rounded">**What:**</code> <code className="bg-muted px-1 rounded">**Why:**</code> <code className="bg-muted px-1 rounded">**How:**</code> for auto-styled sections.</p>
              </div>
            ) : (
              <div
                className="cursor-text hover:bg-muted/20 rounded-lg p-1.5 -m-1.5 transition-colors"
                onClick={() => { setContent(block.content); setEditingField("content") }}
              >
                {renderStyledContent()}
              </div>
            )}

            {/* Deliverable */}
            {(block.deliverable || editingField === "deliverable") && (
              <div
                className={`mt-3 pl-4 border-l-2 border-emerald-400/60 ${editingField !== "deliverable" ? "cursor-text hover:border-emerald-500 transition-colors" : ""}`}
                onClick={() => { if (editingField !== "deliverable") { setDeliverable(block.deliverable || ""); setEditingField("deliverable") } }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Deliverable</span>
                {editingField === "deliverable" ? (
                  <Textarea
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    onBlur={() => saveField("deliverable")}
                    onKeyDown={(e) => { if (e.key === "Escape") { setDeliverable(block.deliverable || ""); setEditingField(null) } }}
                    className="mt-1 min-h-[50px] text-sm"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-[13px] text-foreground/70 mt-1 leading-relaxed">{block.deliverable}</p>
                )}
              </div>
            )}

            {/* Evidence & Sources now shown via popover icon in header */}

            {imagePosition === "below" && renderImage()}

            {budgetEnabled && budgetMode === "scenario" && budgetTiers && (
              <div className="mt-6 border border-border/50 rounded-lg overflow-hidden group/budget">
                <div
                  className="px-5 py-3 border-b border-border/30"
                  style={{ backgroundColor: `${accentColor}0A` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: accentColor }}>
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold text-sm uppercase tracking-wide">Monthly Ad Spend Options</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/budget:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditableTierDefs(tierDefs); setShowTierManager(true) }}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setBudgetEnabled(false)
                          updateBlock(block.id, { budgetEnabled: false })
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/30">
                        <th className="text-left py-2.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[120px]">Tier</th>
                        <th className="text-left py-2.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[160px]">Monthly Budget</th>
                        <th className="text-left py-2.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scope of Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {sortedTierDefs.map((tierDef, idx) => {
                        const tierData = budgetTiers[tierDef.id]
                        if (!tierData) return null
                        const isHighlightRow = idx === 1 // Highlight second tier (typically "recommended")
                        return (
                          <tr key={tierDef.id} className="hover:bg-muted/20 transition-colors" style={isHighlightRow ? { backgroundColor: '#FF95000A' } : {}}>
                            <td className="py-3 px-5 font-medium text-foreground text-sm">{tierDef.name}</td>
                            <td className="py-3 px-5">
                              {editingBudgetCell?.tier === tierDef.id && editingBudgetCell?.field === 'amount' ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium">$</span>
                                  <Input
                                    type="number"
                                    value={tierData.amount}
                                    onChange={(e) => {
                                      const updated = { ...budgetTiers, [tierDef.id]: { ...tierData, amount: Number(e.target.value) } }
                                      setBudgetTiers(updated)
                                    }}
                                    onBlur={() => {
                                      updateBlock(block.id, { budgetTiers })
                                      setEditingBudgetCell(null)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { updateBlock(block.id, { budgetTiers }); setEditingBudgetCell(null) }
                                      if (e.key === "Escape") { setBudgetTiers(block.budgetTiers || budgetTiers); setEditingBudgetCell(null) }
                                    }}
                                    className="w-24 h-7 text-sm font-semibold border-none bg-white"
                                    autoFocus
                                  />
                                  <span className="text-xs text-muted-foreground">/mo</span>
                                </div>
                              ) : (
                                <span
                                  className="font-semibold text-foreground text-sm cursor-text hover:opacity-60 transition-opacity"
                                  onClick={() => setEditingBudgetCell({ tier: tierDef.id, field: 'amount' })}
                                >
                                  ${tierData.amount.toLocaleString()} / mo
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-5">
                              {editingBudgetCell?.tier === tierDef.id && editingBudgetCell?.field === 'scope' ? (
                                <Input
                                  value={tierData.scope}
                                  onChange={(e) => {
                                    const updated = { ...budgetTiers, [tierDef.id]: { ...tierData, scope: e.target.value } }
                                    setBudgetTiers(updated)
                                  }}
                                  onBlur={() => {
                                    updateBlock(block.id, { budgetTiers })
                                    setEditingBudgetCell(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { updateBlock(block.id, { budgetTiers }); setEditingBudgetCell(null) }
                                    if (e.key === "Escape") { setBudgetTiers(block.budgetTiers || budgetTiers); setEditingBudgetCell(null) }
                                  }}
                                  className="h-7 text-sm border-none bg-white"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="text-muted-foreground text-sm cursor-text hover:opacity-60 transition-opacity"
                                  onClick={() => setEditingBudgetCell({ tier: tierDef.id, field: 'scope' })}
                                >
                                  {tierData.scope}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fixed Monthly Budget Table — vertical layout with months as rows */}
            {budgetEnabled && budgetMode === "fixed" && Object.keys(budgetByMonth).length > 0 && (
              <div className="mt-6 border border-border/50 rounded-lg overflow-hidden group/fixedbudget">
                <div
                  className="px-5 py-3 border-b border-border/30"
                  style={{ backgroundColor: `${accentColor}0A` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: accentColor }}>
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold text-sm uppercase tracking-wide">Monthly Budget Allocation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Total: ${Object.values(budgetByMonth).reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover/fixedbudget:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setBudgetEnabled(false)
                          setBudgetByMonth({})
                          updateBlock(block.id, { budgetEnabled: false, budgetByMonth: {} })
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30">
                      <th className="text-left py-2.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Month</th>
                      <th className="text-right py-2.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(budgetByMonth).sort().filter(k => budgetByMonth[k] > 0).map((monthKey) => (
                      <tr key={monthKey} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                        <td className="py-2.5 px-5 text-sm font-medium text-foreground">{formatMonthKey(monthKey)}</td>
                        <td className="py-2 px-5 text-right">
                          {editingMonthBudget === monthKey ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                value={budgetByMonth[monthKey] || 0}
                                onChange={(e) => {
                                  const updated = { ...budgetByMonth, [monthKey]: Number(e.target.value) }
                                  setBudgetByMonth(updated)
                                }}
                                onBlur={() => {
                                  updateBlock(block.id, { budgetByMonth })
                                  setEditingMonthBudget(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { updateBlock(block.id, { budgetByMonth }); setEditingMonthBudget(null) }
                                  if (e.key === "Escape") { setBudgetByMonth(block.budgetByMonth || {}); setEditingMonthBudget(null) }
                                }}
                                className="w-24 h-7 text-sm font-semibold text-right"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span
                              className="font-semibold text-foreground text-sm cursor-text hover:opacity-60 transition-opacity"
                              onClick={() => setEditingMonthBudget(monthKey)}
                            >
                              ${(budgetByMonth[monthKey] || 0).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t">
                      <td className="py-2.5 px-5 text-sm font-bold text-foreground">Total</td>
                      <td className="py-2.5 px-5 text-right text-sm font-bold text-foreground">
                        ${Object.values(budgetByMonth).reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
      </div>

        <div className="mt-6 pt-5 border-t border-border/20 group/footer">
          <div className="flex flex-wrap gap-6">
            {/* Resource Allocation — shown unless hours is 0 and explicitly hidden */}
            {block.hours > 0 && (
            <div className="group/hours relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3" style={{ color: '#1DB5C4' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Resource Allocation</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover/hours:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                  onClick={() => { updateBlock(block.id, { hours: 0, hoursByMonth: {} }); setHours(0); setHoursByMonth({}) }}
                >
                  <X className="w-2.5 h-2.5" />
                </Button>
              </div>
              {editingField === "hours" ? (
                <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    onBlur={() => saveField("hours")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField("hours") } if (e.key === "Escape") { setHours(block.hours); setEditingField(null) } }}
                    className="w-16 h-7 text-sm font-bold border-none bg-white"
                    autoFocus
                  />
                  <span className="text-[11px] text-muted-foreground uppercase">Total Hours</span>
                </div>
              ) : (
                <div className="relative group/hoursval">
                  <div
                    className="bg-muted/30 rounded-lg px-4 py-2 cursor-text hover:bg-muted/50 transition-colors inline-flex items-baseline gap-1.5"
                    onClick={() => { setHours(block.hours); setEditingField("hours") }}
                  >
                    <span className="text-base font-bold text-foreground">{block.hours}</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Hours</span>
                  </div>
                  {/* Monthly breakdown tooltip on hover */}
                  {(() => {
                    const months = block.startDate && block.endDate ? getMonthsBetween(block.startDate, block.endDate) : []
                    if (months.length <= 1) return null
                    const monthlyHrs = smartDistributeHours(block.hours, block.startDate, block.endDate)
                    return (
                      <div className="absolute bottom-full left-0 mb-2 bg-foreground text-background rounded-lg px-3 py-2 text-[10px] whitespace-nowrap opacity-0 group-hover/hoursval:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                        {Object.entries(monthlyHrs).map(([mk, hrs]) => (
                          <div key={mk} className="flex justify-between gap-4">
                            <span className="text-background/70">{formatMonthKey(mk)}</span>
                            <span className="font-semibold">{hrs}h</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            )}

            {/* Production Timeline — shown when dates exist */}
            {block.startDate && block.endDate && (
            <div className="group/dates relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3 h-3" style={{ color: '#FF9500' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Production Timeline</span>
              </div>
              {editingField === "dates" ? (
                <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 h-7 text-sm border-none bg-white"
                    autoFocus
                  />
                  <span className="text-muted-foreground text-xs">—</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 h-7 text-sm border-none bg-white"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => saveField("dates")}>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </Button>
                </div>
              ) : (
                <div
                  className="bg-muted/30 rounded-lg px-4 py-2 cursor-text hover:bg-muted/50 transition-colors inline-flex items-center"
                  onClick={() => { setStartDate(block.startDate); setEndDate(block.endDate); setEditingField("dates") }}
                >
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(block.startDate)} — {formatDate(block.endDate)}
                  </span>
                </div>
              )}
            </div>
            )}

            {/* Media Flights — shown when has data or editing */}
            {(mediaFlights.length > 0 || editingField === "mediaFlights") && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Radio className="w-3 h-3" style={{ color: '#1DB5C4' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Media Flights</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mediaFlights.map((flight, idx) => (
                    <div key={idx} className="group/flight inline-flex items-center gap-1">
                      {editingField === "mediaFlights" ? (
                        <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1.5">
                          <Input
                            value={flight.label || ""}
                            onChange={(e) => {
                              const updated = [...mediaFlights]
                              updated[idx] = { ...updated[idx], label: e.target.value }
                              setMediaFlights(updated)
                            }}
                            placeholder="Label (optional)"
                            className="w-[110px] h-6 text-xs border-none bg-white px-1.5"
                          />
                          <Input
                            type="date"
                            value={flight.startDate}
                            onChange={(e) => {
                              const updated = [...mediaFlights]
                              updated[idx] = { ...updated[idx], startDate: e.target.value }
                              setMediaFlights(updated)
                            }}
                            className="w-[120px] h-6 text-xs border-none bg-white px-1.5"
                          />
                          <span className="text-muted-foreground text-[10px]">—</span>
                          <Input
                            type="date"
                            value={flight.endDate}
                            onChange={(e) => {
                              const updated = [...mediaFlights]
                              updated[idx] = { ...updated[idx], endDate: e.target.value }
                              setMediaFlights(updated)
                            }}
                            className="w-[120px] h-6 text-xs border-none bg-white px-1.5"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              const updated = mediaFlights.filter((_, i) => i !== idx)
                              setMediaFlights(updated)
                              updateBlock(block.id, { mediaFlights: updated })
                              if (updated.length === 0) setEditingField(null)
                            }}
                          >
                            <X className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="rounded-lg px-3 py-1.5 text-xs font-medium cursor-text hover:opacity-70 transition-opacity border"
                          style={{ borderColor: '#1DB5C420', color: '#1DB5C4', backgroundColor: '#1DB5C408' }}
                          onClick={() => setEditingField("mediaFlights")}
                        >
                          {flight.label && <span className="font-semibold mr-1.5" style={{ color: '#2A3441' }}>{flight.label}:</span>}
                          {formatDate(flight.startDate)} — {formatDate(flight.endDate)}
                        </div>
                      )}
                    </div>
                  ))}
                  {editingField === "mediaFlights" && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setMediaFlights([...mediaFlights, { startDate: block.startDate, endDate: block.endDate, label: "" }])
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add flight
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-green-600"
                        onClick={() => {
                          updateBlock(block.id, { mediaFlights })
                          setEditingField(null)
                        }}
                      >
                        <Check className="w-3 h-3 mr-1" /> Done
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Budget summary — shown when enabled */}
            {budgetEnabled && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-3 h-3" style={{ color: '#FF9500' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                    {budgetMode === "fixed" ? "Budget" : "Budget Range"}
                  </span>
                </div>
                {budgetMode === "scenario" ? (
                  <div className="bg-muted/30 rounded-lg px-4 py-2 inline-flex items-baseline gap-1.5">
                    {(() => {
                      const amounts = sortedTierDefs.map(td => budgetTiers[td.id]?.amount || 0).filter(a => a > 0)
                      const min = Math.min(...amounts)
                      const max = Math.max(...amounts)
                      return (
                        <>
                          <span className="text-sm font-bold text-foreground">
                            ${min.toLocaleString()} — ${max.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">/ mo</span>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg px-4 py-2 inline-flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-foreground">
                      ${Object.values(budgetByMonth).reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hover add-on buttons */}
          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover/footer:opacity-100 transition-opacity">
            {block.hours === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground/60 hover:text-foreground gap-1 px-2"
                onClick={() => { setHours(1); setEditingField("hours") }}
              >
                <Clock className="w-3 h-3" /> Add Hours
              </Button>
            )}
            {mediaFlights.length === 0 && editingField !== "mediaFlights" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground/60 hover:text-foreground gap-1 px-2"
                onClick={() => {
                  setMediaFlights([{ startDate: block.startDate, endDate: block.endDate, label: "" }])
                  setEditingField("mediaFlights")
                }}
              >
                <Radio className="w-3 h-3" /> Add Media Flight
              </Button>
            )}
            {!budgetEnabled && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground/60 hover:text-foreground gap-1 px-2"
                  onClick={() => {
                    setBudgetEnabled(true)
                    setBudgetMode("scenario")
                    updateBlock(block.id, { budgetEnabled: true, budgetMode: "scenario" })
                  }}
                >
                  <DollarSign className="w-3 h-3" /> Add Budget Tiers
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground/60 hover:text-foreground gap-1 px-2"
                  onClick={() => {
                    // Auto-populate monthly budget from date range
                    const months = block.startDate && block.endDate ? getMonthsBetween(block.startDate, block.endDate) : []
                    const initialBudget: Record<string, number> = {}
                    months.forEach(m => { initialBudget[m] = 0 })
                    setBudgetEnabled(true)
                    setBudgetMode("fixed")
                    setBudgetByMonth(initialBudget)
                    updateBlock(block.id, { budgetEnabled: true, budgetMode: "fixed", budgetByMonth: initialBudget })
                  }}
                >
                  <CalendarRange className="w-3 h-3" /> Add Monthly Budget
                </Button>
              </>
            )}
          </div>
        </div>

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

      {/* Plan-level Tier Manager Dialog */}
      <Dialog open={showTierManager} onOpenChange={(open) => { setShowTierManager(open); if (open) setEditableTierDefs(tierDefs) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Budget Tiers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These tier names apply to all tactics in the plan. Changing a name here updates it everywhere.
          </p>
          <div className="space-y-3 py-4">
            {editableTierDefs.sort((a, b) => a.order - b.order).map((tierDef, idx) => (
              <div key={tierDef.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 text-center">{idx + 1}</span>
                <Input
                  value={tierDef.name}
                  onChange={(e) => updateTierDefName(tierDef.id, e.target.value)}
                  className="flex-1 h-9"
                  placeholder="Tier name"
                />
                {editableTierDefs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeTierDef(tierDef.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={addTierDef}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Tier
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTierManager(false)}>Cancel</Button>
            <Button onClick={saveTierDefs}>Save for All Tactics</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

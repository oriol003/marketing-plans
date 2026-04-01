"use client"

import { useState, useEffect, useRef } from "react"
import { usePlanStore } from "@/lib/store"
import { Trash2, Plus, Users, Check, X, Sparkles, Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { AudienceBlock as AudienceBlockType, Audience } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

interface AudienceBlockProps {
  block: AudienceBlockType
  dragHandleProps?: any
  accentColor?: string
}

export function AudienceBlock({ block, dragHandleProps, accentColor = "#00A7B5" }: AudienceBlockProps) {
  const { updateBlock, removeBlock, currentPlan } = usePlanStore()
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null)
  const [editedTitle, setEditedTitle] = useState(block.title)
  const [editedDescription, setEditedDescription] = useState(block.description || "")
  const [editingAudienceId, setEditingAudienceId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [generateCount, setGenerateCount] = useState(3)
  const [references, setReferences] = useState<any[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [customInstructions, setCustomInstructions] = useState("")

  useEffect(() => {
    setEditedTitle(block.title)
  }, [block.title])

  useEffect(() => {
    setEditedDescription(block.description || "")
  }, [block.description])

  useEffect(() => {
    if (showGenerateDialog && currentPlan?.id) {
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => setReferences(data.references || []))
        .catch((err) => console.error("Error fetching references:", err))
    }
  }, [showGenerateDialog, currentPlan?.id])

  const saveField = (field: "title" | "description") => {
    updateBlock(block.id, { [field]: field === "title" ? editedTitle : editedDescription })
    setEditingField(null)
  }

  const handleGenerateWithAI = async () => {
    setIsGenerating(true)
    try {
      const context = `Client: ${currentPlan?.title || "Unknown"}. Objective: ${currentPlan?.objective || "Not specified"}. ${block.description || ""}`
      const response = await fetch("/api/generate-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: context,
          count: generateCount,
          referenceIds: selectedReferenceIds,
          customInstructions: customInstructions || undefined,
        }),
      })
      if (!response.ok) throw new Error("Failed to generate personas")
      const data = await response.json()
      const newAudiences = data.personas.map((persona: any, index: number) => ({
        id: crypto.randomUUID(),
        name: persona.name,
        description: persona.description,
        incomeLevel: persona.incomeLevel,
        keyFocus: persona.keyFocus,
        demographics: persona.demographics,
        motivations: persona.motivations,
        order: (block.audiences?.length || 0) + index,
      }))
      updateBlock(block.id, {
        audiences: [...(block.audiences || []), ...newAudiences],
      })
      setShowGenerateDialog(false)
      setSelectedReferenceIds([])
      setCustomInstructions("")
    } catch (error) {
      console.error("Error generating personas:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddAudience = () => {
    const newAudience: Audience = {
      id: crypto.randomUUID(),
      name: "New Persona",
      description: "Brief description of this target audience...",
      incomeLevel: "$500K+ Net Worth",
      keyFocus: "Key Focus Area",
      demographics: ["Age 35-50", "Professional"],
      motivations: ["Motivation 1", "Motivation 2"],
      order: block.audiences?.length || 0,
    }
    updateBlock(block.id, {
      audiences: [...(block.audiences || []), newAudience],
    })
    setEditingAudienceId(newAudience.id)
  }

  const handleUpdateAudience = (audienceId: string, updates: Partial<Audience>) => {
    const updatedAudiences = block.audiences.map((a) => (a.id === audienceId ? { ...a, ...updates } : a))
    updateBlock(block.id, { audiences: updatedAudiences })
  }

  const handleDeleteAudience = (audienceId: string) => {
    const updatedAudiences = block.audiences.filter((a) => a.id !== audienceId)
    updateBlock(block.id, { audiences: updatedAudiences })
  }

  return (
    <div className="relative group py-8 border-b border-border/30 last:border-b-0">
      <div className="hidden" {...dragHandleProps} />

      {/* Header: accent bar + icon + title — matches tactic block style */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accentColor, opacity: 0.35 }} />

        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}12` }}
        >
          <Users className="w-5 h-5" style={{ color: accentColor }} />
        </div>

        <div className="flex-1 min-w-0">
          {editingField === "title" ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={() => saveField("title")}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveField("title") }
                if (e.key === "Escape") { setEditedTitle(block.title); setEditingField(null) }
              }}
              className="font-semibold text-xl h-auto py-0 border-none shadow-none bg-transparent focus-visible:ring-1 font-heading"
              autoFocus
            />
          ) : (
            <h3
              className="font-heading font-semibold text-xl text-foreground cursor-text hover:opacity-60 transition-opacity leading-snug"
              onClick={() => { setEditedTitle(block.title); setEditingField("title") }}
            >
              {block.title}
            </h3>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGenerateDialog(true)}
            className="h-7 w-7"
            title="Generate personas with AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleAddAudience} className="h-7 w-7" title="Add persona">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="h-7 w-7 text-destructive hover:text-destructive" title="Delete block">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Description — inline editable */}
      {editingField === "description" ? (
        <Textarea
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          onBlur={() => saveField("description")}
          onKeyDown={(e) => { if (e.key === "Escape") { setEditedDescription(block.description || ""); setEditingField(null) } }}
          className="ml-[calc(3px+1rem+2.75rem+1rem)] text-sm min-h-[40px] border-none shadow-none bg-transparent focus-visible:ring-1"
          placeholder="Describe this audience segment..."
          autoFocus
        />
      ) : block.description ? (
        <p
          className="ml-[calc(3px+1rem+2.75rem+1rem)] text-sm text-muted-foreground leading-relaxed cursor-text hover:text-muted-foreground/60 transition-colors mb-4"
          onClick={() => { setEditedDescription(block.description || ""); setEditingField("description") }}
        >
          {block.description}
        </p>
      ) : (
        <p
          className="ml-[calc(3px+1rem+2.75rem+1rem)] text-sm italic text-muted-foreground/40 cursor-text hover:text-muted-foreground/60 transition-colors mb-4"
          onClick={() => { setEditedDescription(""); setEditingField("description") }}
        >
          Click to add description...
        </p>
      )}

      {/* Persona list */}
      <div className="ml-[calc(3px+1rem)] space-y-0">
        {block.audiences?.map((audience) => (
          <PersonaRow
            key={audience.id}
            audience={audience}
            isEditing={editingAudienceId === audience.id}
            onEdit={() => setEditingAudienceId(audience.id)}
            onSave={() => setEditingAudienceId(null)}
            onUpdate={(updates) => handleUpdateAudience(audience.id, updates)}
            onDelete={() => handleDeleteAudience(audience.id)}
            planContext={`${currentPlan?.title || ""} - ${currentPlan?.objective || ""}`}
            accentColor={accentColor}
          />
        ))}
      </div>

      {/* Add persona button — subtle */}
      {(!block.audiences || block.audiences.length === 0) && (
        <div className="ml-[calc(3px+1rem+2.75rem+1rem)] mt-4">
          <Button
            variant="outline"
            onClick={handleAddAudience}
            className="h-16 w-full border-dashed border-2 text-muted-foreground hover:text-foreground"
            style={{ borderColor: `${accentColor}30` }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Target Audience
          </Button>
        </div>
      )}

      {/* Generate dialog */}
      {showGenerateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
              <h3 className="text-lg font-bold">Generate Audience Personas with AI</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              AI will analyze your plan context and generate detailed target audience personas.
            </p>
            <div>
              <Label>Number of personas to generate</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={generateCount}
                onChange={(e) => setGenerateCount(Number.parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Custom Instructions (optional)</Label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Add any specific requirements or guidelines for the personas..."
                className="mt-1 min-h-[80px]"
              />
            </div>
            {references.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Select References for Context (optional)</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {references.map((ref) => (
                    <div key={ref.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`ref-${ref.id}`}
                        checked={selectedReferenceIds.includes(ref.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReferenceIds([...selectedReferenceIds, ref.id])
                          } else {
                            setSelectedReferenceIds(selectedReferenceIds.filter((id) => id !== ref.id))
                          }
                        }}
                      />
                      <label htmlFor={`ref-${ref.id}`} className="text-sm cursor-pointer flex-1">
                        <div className="font-medium">{ref.title}</div>
                        <div className="text-muted-foreground line-clamp-2 text-xs mt-0.5">{ref.content}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setShowGenerateDialog(false); setSelectedReferenceIds([]); setCustomInstructions("") }}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                style={{ backgroundColor: accentColor, color: "white" }}
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Persona Row ─── Individual persona, inline-editable

interface PersonaRowProps {
  audience: Audience
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onUpdate: (updates: Partial<Audience>) => void
  onDelete: () => void
  planContext: string
  accentColor?: string
}

function PersonaRow({
  audience,
  isEditing,
  onEdit,
  onSave,
  onUpdate,
  onDelete,
  planContext,
  accentColor = "#00A7B5",
}: PersonaRowProps) {
  const toList = (v: unknown): string[] => Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []
  const [demographics, setDemographics] = useState(toList(audience.demographics).join(", "))
  const [motivations, setMotivations] = useState(toList(audience.motivations).join(", "))
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false)

  useEffect(() => {
    setDemographics(toList(audience.demographics).join(", "))
    setMotivations(toList(audience.motivations).join(", "))
  }, [audience.demographics, audience.motivations])

  const handleSave = () => {
    onUpdate({
      demographics: demographics.split(",").map((d) => d.trim()).filter(Boolean),
      motivations: motivations.split(",").map((m) => m.trim()).filter(Boolean),
    })
    onSave()
  }

  const handleGenerateAvatar = async () => {
    setIsGeneratingAvatar(true)
    try {
      const res = await fetch("/api/generate-phase-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `portrait headshot ${audience.name}`,
          description: `Professional headshot portrait photo of a person matching: ${audience.demographics.join(", ")}. ${audience.description}`,
          color: accentColor,
          isPortrait: true,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate avatar")
      const data = await res.json()
      if (data.imageUrl) {
        onUpdate({ avatar: data.imageUrl })
      }
    } catch (err) {
      console.error("Avatar generation failed:", err)
    } finally {
      setIsGeneratingAvatar(false)
    }
  }

  if (isEditing) {
    return (
      <div className="py-6 border-b border-border/20 last:border-b-0 space-y-4 ml-[calc(2.75rem+1rem)]">
        <div className="flex items-center gap-3">
          {/* Avatar — clickable */}
          <button
            onClick={handleGenerateAvatar}
            disabled={isGeneratingAvatar}
            className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors flex items-center justify-center bg-muted/50"
            title="Click to generate AI headshot"
          >
            {isGeneratingAvatar ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : audience.avatar ? (
              <img src={audience.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-muted-foreground/50" />
            )}
          </button>

          <Input
            value={audience.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="text-lg font-semibold font-heading flex-1"
            placeholder="Persona Name"
          />

          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={handleSave} className="h-7 w-7 p-0 text-green-600">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onSave} className="h-7 w-7 p-0 text-red-600">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <Textarea
          value={audience.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description..."
          rows={2}
          className="text-sm"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Income Level</Label>
            <Input
              value={audience.incomeLevel}
              onChange={(e) => onUpdate({ incomeLevel: e.target.value })}
              placeholder="$500K+ Net Worth"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Key Focus</Label>
            <Input
              value={audience.keyFocus}
              onChange={(e) => onUpdate({ keyFocus: e.target.value })}
              placeholder="Privacy & Craftsmanship"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Demographics (comma-separated)</Label>
          <Input value={demographics} onChange={(e) => setDemographics(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label className="text-xs">Motivations (comma-separated)</Label>
          <Input value={motivations} onChange={(e) => setMotivations(e.target.value)} className="mt-1" />
        </div>

        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive text-xs">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Delete Persona
        </Button>
      </div>
    )
  }

  // ─── View mode ───
  return (
    <div
      onClick={onEdit}
      className="py-6 border-b border-border/20 last:border-b-0 cursor-pointer group/persona hover:bg-muted/30 transition-colors rounded-lg px-3 -mx-3 ml-[calc(2.75rem+1rem-0.75rem)]"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <button
          onClick={(e) => { e.stopPropagation(); handleGenerateAvatar() }}
          disabled={isGeneratingAvatar}
          className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 transition-all flex items-center justify-center mt-0.5"
          style={{
            borderColor: audience.avatar ? 'transparent' : `${accentColor}40`,
            backgroundColor: audience.avatar ? 'transparent' : `${accentColor}08`,
          }}
          title={audience.avatar ? "Click to regenerate headshot" : "Click to generate AI headshot"}
        >
          {isGeneratingAvatar ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
          ) : audience.avatar ? (
            <img src={audience.avatar} alt={audience.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <User className="w-6 h-6" style={{ color: `${accentColor}60` }} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4 className="font-heading font-semibold text-lg leading-snug mb-1">{audience.name}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{audience.description}</p>

          {/* Income + Key Focus */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>Income</span>
              <span className="text-sm font-medium">{audience.incomeLevel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full bg-orange-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Focus</span>
              <span className="text-sm font-medium">{audience.keyFocus}</span>
            </div>
          </div>

          {/* Demographics */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {toList(audience.demographics).map((demo, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {demo}
              </Badge>
            ))}
          </div>

          {/* Motivations */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {toList(audience.motivations).map((motivation, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
                <span className="text-sm text-muted-foreground">{motivation}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

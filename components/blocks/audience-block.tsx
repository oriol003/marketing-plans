"use client"

import { useState, useEffect } from "react"
import { usePlanStore } from "@/lib/store"
import { Trash2, Plus, Users, Edit2, Check, X, Sparkles } from "lucide-react"
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
  accentColor?: string // Added accent color prop from parent section
}

export function AudienceBlock({ block, dragHandleProps, accentColor = "#00A7B5" }: AudienceBlockProps) {
  const { updateBlock, removeBlock, currentPlan } = usePlanStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editingAudienceId, setEditingAudienceId] = useState<string | null>(null)
  const [editedTitle, setEditedTitle] = useState(block.title)
  const [editedDescription, setEditedDescription] = useState(block.description || "")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [generateCount, setGenerateCount] = useState(3)
  const [references, setReferences] = useState<any[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [customInstructions, setCustomInstructions] = useState("")

  useEffect(() => {
    if (showGenerateDialog && currentPlan?.id) {
      fetch(`/api/plans/${currentPlan.id}/references`)
        .then((res) => res.json())
        .then((data) => setReferences(data.references || []))
        .catch((err) => console.error("Error fetching references:", err))
    }
  }, [showGenerateDialog, currentPlan?.id])

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
      alert("Failed to generate audience personas. Please try again.")
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

  const handleSave = () => {
    updateBlock(block.id, {
      title: editedTitle,
      description: editedDescription,
    })
    setIsEditing(false)
  }

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm">
      <div {...dragHandleProps} className="hidden" />

      <div className="flex items-start gap-4 p-6 border-b border-border group">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: `${accentColor}1A` }} // Use dynamic accent color
            >
              <Users className="w-5 h-5" style={{ color: accentColor }} />
            </div>

            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-bold font-heading border-none focus-visible:ring-0 px-0"
              />
            ) : (
              <h2 className="text-2xl font-bold font-heading">{block.title}</h2>
            )}
          </div>

          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-2"
              rows={2}
            />
          ) : block.description ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{block.description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0">
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditedTitle(block.title)
                  setEditedDescription(block.description || "")
                }}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
                className="h-8 gap-1.5 hover:bg-opacity-10"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}00`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${accentColor}1A`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${accentColor}00`)}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">AI</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 w-8 p-0">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeBlock(block.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-white p-8">
        <div className="space-y-6">
          {block.audiences?.map((audience) => (
            <AudienceCard
              key={audience.id}
              audience={audience}
              isEditing={editingAudienceId === audience.id}
              onEdit={() => setEditingAudienceId(audience.id)}
              onSave={() => setEditingAudienceId(null)}
              onUpdate={(updates) => handleUpdateAudience(audience.id, updates)}
              onDelete={() => handleDeleteAudience(audience.id)}
              planContext={`${currentPlan?.title || ""} - ${currentPlan?.objective || ""}`}
              accentColor={accentColor} // Pass accent color to child cards
            />
          ))}

          <Button
            variant="outline"
            onClick={handleAddAudience}
            className="w-full h-32 border-dashed border-2 hover:border-opacity-100 transition-colors bg-transparent"
            style={{ borderColor: `${accentColor}40` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor
              e.currentTarget.style.backgroundColor = `${accentColor}0D`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${accentColor}40`
              e.currentTarget.style.backgroundColor = "transparent"
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Target Audience
          </Button>
        </div>
      </div>

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
                {selectedReferenceIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedReferenceIds.length} reference{selectedReferenceIds.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowGenerateDialog(false)
                  setSelectedReferenceIds([])
                  setCustomInstructions("")
                }}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                style={{
                  backgroundColor: accentColor,
                  color: "white",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface AudienceCardProps {
  audience: Audience
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onUpdate: (updates: Partial<Audience>) => void
  onDelete: () => void
  planContext: string
  accentColor?: string // Added accent color prop
}

function AudienceCard({
  audience,
  isEditing,
  onEdit,
  onSave,
  onUpdate,
  onDelete,
  planContext,
  accentColor = "#00A7B5",
}: AudienceCardProps) {
  const [demographics, setDemographics] = useState(audience.demographics.join(", "))
  const [motivations, setMotivations] = useState(audience.motivations.join(", "))
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleEnhanceWithAI = async () => {
    setIsEnhancing(true)
    try {
      const response = await fetch("/api/generate-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${planContext}. Current audience: ${audience.name} - ${audience.description}`,
          count: 1,
          existingAudience: audience,
        }),
      })

      if (!response.ok) throw new Error("Failed to enhance persona")

      const data = await response.json()
      const enhanced = data.personas[0]

      onUpdate({
        name: enhanced.name,
        description: enhanced.description,
        incomeLevel: enhanced.incomeLevel,
        keyFocus: enhanced.keyFocus,
        demographics: enhanced.demographics,
        motivations: enhanced.motivations,
      })

      setDemographics(enhanced.demographics.join(", "))
      setMotivations(enhanced.motivations.join(", "))
    } catch (error) {
      console.error("Error enhancing persona:", error)
      alert("Failed to enhance audience persona. Please try again.")
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleSave = () => {
    onUpdate({
      demographics: demographics
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      motivations: motivations
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    })
    onSave()
  }

  if (isEditing) {
    return (
      <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Input
            value={audience.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="text-xl font-bold"
            placeholder="Persona Name"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnhanceWithAI}
              disabled={isEnhancing}
              className="gap-1.5 bg-transparent"
            >
              <Sparkles className={`w-4 h-4 ${isEnhancing ? "animate-pulse" : ""}`} />
              {isEnhancing ? "Enhancing..." : "AI Enhance"}
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onSave}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Textarea
          value={audience.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description..."
          rows={2}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Income Level</Label>
            <Input
              value={audience.incomeLevel}
              onChange={(e) => onUpdate({ incomeLevel: e.target.value })}
              placeholder="$500K+ Net Worth"
            />
          </div>
          <div>
            <Label>Key Focus</Label>
            <Input
              value={audience.keyFocus}
              onChange={(e) => onUpdate({ keyFocus: e.target.value })}
              placeholder="Privacy & Craftsmanship"
            />
          </div>
        </div>

        <div>
          <Label>Demographics (comma-separated)</Label>
          <Input
            value={demographics}
            onChange={(e) => setDemographics(e.target.value)}
            placeholder="Age 45-60, Married, Children"
          />
        </div>

        <div>
          <Label>Motivations (comma-separated)</Label>
          <Input
            value={motivations}
            onChange={(e) => setMotivations(e.target.value)}
            placeholder="Family Legacy, Privacy, Turnkey Process"
          />
        </div>

        <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Persona
        </Button>
      </div>
    )
  }

  return (
    <div
      onClick={onEdit}
      className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group/card"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 rounded-lg bg-muted">
          <Users className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold font-heading mb-1">{audience.name}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{audience.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded" style={{ backgroundColor: accentColor }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
              Income Level
            </span>
          </div>
          <p className="text-base font-semibold pl-3">{audience.incomeLevel}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[#FF6B35] rounded" />
            <span className="text-xs font-bold uppercase text-[#FF6B35] tracking-wider">Key Focus</span>
          </div>
          <p className="text-base font-semibold pl-3">{audience.keyFocus}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Demographics</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {audience.demographics.map((demo, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs whitespace-nowrap">
                {demo}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Motivations</span>
          </div>
          <div className="space-y-2">
            {audience.motivations.map((motivation, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ borderColor: accentColor }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: accentColor }} />
                </div>
                <span className="text-sm leading-relaxed">{motivation}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

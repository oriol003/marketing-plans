"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlanStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import {
  Sparkles,
  FileText,
  Check,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Wand2,
  CornerDownRight,
} from "lucide-react"
import { suggestIconForTactic } from "@/lib/tactic-templates"

type TacticStatus = "pending" | "approved" | "discarded"

interface TacticWithStatus {
  title: string
  description: string
  category: string
  what: string
  why: string
  how: string
  evidence: string
  estimatedHours: number
  status: TacticStatus
  parentTitle?: string // Track parent tactic for expanded sub-tactics
}

interface Reference {
  id: string
  title: string
  content: string
}

interface ReferenceAnalyzerProps {
  planId: string
}

export function ReferenceAnalyzer({ planId }: ReferenceAnalyzerProps) {
  const { currentPlan, setCurrentPlan } = usePlanStore()
  const { toast } = useToast()

  const [step, setStep] = useState<"select" | "review">("select")
  const [references, setReferences] = useState<Reference[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [allTactics, setAllTactics] = useState<TacticWithStatus[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<TacticWithStatus | null>(null)
  const [allSeenTacticTitles, setAllSeenTacticTitles] = useState<string[]>([])

  // Expand with AI state
  const [isExpandDialogOpen, setIsExpandDialogOpen] = useState(false)
  const [expandInstruction, setExpandInstruction] = useState("")
  const [isExpanding, setIsExpanding] = useState(false)

  // Load references
  useEffect(() => {
    const loadReferences = async () => {
      if (!planId) return

      const supabase = createClient()
      const { data, error } = await supabase
        .from("plan_references")
        .select("id, title, content")
        .eq("plan_id", planId)
        .order("order", { ascending: true })

      if (error) {
        console.error("[v0] Error loading references:", error.message)
        return
      }

      setReferences(data || [])
    }

    loadReferences()
  }, [planId])

  const handleToggleReference = (id: string) => {
    setSelectedReferenceIds((prev) => (prev.includes(id) ? prev.filter((refId) => refId !== id) : [...prev, id]))
  }

  const handleAnalyze = async () => {
    if (selectedReferenceIds.length === 0) return

    setIsLoading(true)

    try {
      const selectedContent = references
        .filter((ref) => selectedReferenceIds.includes(ref.id))
        .map((ref) => `## ${ref.title}\n\n${ref.content}`)
        .join("\n\n---\n\n")

      const response = await fetch("/api/extract-tactics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: selectedContent,
          excludeTactics: allSeenTacticTitles,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to extract tactics")
      }

      const data = await response.json()

      // Add status to each tactic
      const tacticsWithStatus: TacticWithStatus[] = data.tactics.map((tactic: any) => ({
        ...tactic,
        status: "pending" as TacticStatus,
        parentTitle: undefined, // Root level tactics have no parent
      }))

      // Track seen titles
      setAllSeenTacticTitles((prev) => [...prev, ...tacticsWithStatus.map((t) => t.title)])

      setAllTactics(tacticsWithStatus)
      setCurrentIndex(0)
      setStep("review")
    } catch (error) {
      console.error("Error analyzing references:", error)
      toast({
        title: "Error",
        description: "Failed to analyze references. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFindMore = async () => {
    if (selectedReferenceIds.length === 0) return

    setIsLoading(true)

    try {
      const selectedContent = references
        .filter((ref) => selectedReferenceIds.includes(ref.id))
        .map((ref) => `## ${ref.title}\n\n${ref.content}`)
        .join("\n\n---\n\n")

      const response = await fetch("/api/extract-tactics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: selectedContent,
          excludeTactics: allSeenTacticTitles,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to extract tactics")
      }

      const data = await response.json()

      // Add status to each tactic
      const newTacticsWithStatus: TacticWithStatus[] = data.tactics.map((tactic: any) => ({
        ...tactic,
        status: "pending" as TacticStatus,
        parentTitle: undefined,
      }))

      // Track seen titles
      setAllSeenTacticTitles((prev) => [...prev, ...newTacticsWithStatus.map((t) => t.title)])

      // Add new tactics to the list
      setAllTactics((prev) => [...prev, ...newTacticsWithStatus])

      toast({
        title: "Found more tactics",
        description: `Added ${newTacticsWithStatus.length} more tactics to review.`,
      })
    } catch (error) {
      console.error("Error finding more tactics:", error)
      toast({
        title: "Error",
        description: "Failed to find more tactics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExpandWithAI = async () => {
    if (!currentTactic) return
    setIsExpanding(true)

    try {
      // Get selected reference content for context
      const selectedRefContent = references
        .filter((ref) => selectedReferenceIds.includes(ref.id))
        .map((ref) => ref.content)
        .join("\n\n---\n\n")

      const response = await fetch("/api/expand-tactic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tactic: currentTactic,
          instruction: expandInstruction,
          referenceContent: selectedRefContent,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to expand tactic")
      }

      const { tactics: expandedTactics } = await response.json()
      const parentTacticTitle = currentTactic.title

      // Replace current tactic with expanded tactics, tracking the parent
      setAllTactics((prev) => {
        const newTactics = [...prev]
        // Remove the current tactic
        newTactics.splice(currentIndex, 1)
        // Insert expanded tactics at the same position with pending status and parent reference
        const newExpandedTactics = expandedTactics.map((t: any) => ({
          ...t,
          status: "pending" as TacticStatus,
          parentTitle: parentTacticTitle, // Track which parent this came from
        }))
        newTactics.splice(currentIndex, 0, ...newExpandedTactics)
        return newTactics
      })

      // Track these in seen titles
      setAllSeenTacticTitles((prev) => [...prev, ...expandedTactics.map((t: any) => t.title)])

      setIsExpandDialogOpen(false)
      setExpandInstruction("")

      toast({
        title: "Tactic expanded",
        description: `Broke down "${parentTacticTitle}" into ${expandedTactics.length} deliverables.`,
      })
    } catch (error) {
      console.error("[v0] Error expanding tactic:", error)
      toast({
        title: "Error",
        description: "Failed to expand tactic. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExpanding(false)
    }
  }

  const currentTactic = allTactics[currentIndex]
  const approvedTactics = allTactics.filter((t) => t.status === "approved")
  const discardedTactics = allTactics.filter((t) => t.status === "discarded")
  const pendingTactics = allTactics.filter((t) => t.status === "pending")
  const pendingCount = pendingTactics.length
  const approvedCount = approvedTactics.length
  const discardedCount = discardedTactics.length

  const handleApprove = () => {
    setAllTactics((prev) => prev.map((t, i) => (i === currentIndex ? { ...t, status: "approved" } : t)))
    // Move to next pending if available
    const nextPendingIndex = allTactics.findIndex((t, i) => i > currentIndex && t.status === "pending")
    if (nextPendingIndex !== -1) {
      setCurrentIndex(nextPendingIndex)
    } else {
      // Find first pending from start
      const firstPending = allTactics.findIndex((t) => t.status === "pending")
      if (firstPending !== -1 && firstPending !== currentIndex) {
        setCurrentIndex(firstPending)
      }
    }
  }

  const handleDiscard = () => {
    setAllTactics((prev) => prev.map((t, i) => (i === currentIndex ? { ...t, status: "discarded" } : t)))
    // Move to next pending if available
    const nextPendingIndex = allTactics.findIndex((t, i) => i > currentIndex && t.status === "pending")
    if (nextPendingIndex !== -1) {
      setCurrentIndex(nextPendingIndex)
    } else {
      // Find first pending from start
      const firstPending = allTactics.findIndex((t) => t.status === "pending")
      if (firstPending !== -1 && firstPending !== currentIndex) {
        setCurrentIndex(firstPending)
      }
    }
  }

  const handleToggleStatus = () => {
    setAllTactics((prev) =>
      prev.map((t, i) =>
        i === currentIndex ? { ...t, status: t.status === "approved" ? "discarded" : "approved" } : t,
      ),
    )
  }

  const handleEdit = () => {
    if (currentTactic) {
      setEditForm({ ...currentTactic })
      setIsEditing(true)
    }
  }

  const handleSaveEdit = () => {
    if (editForm) {
      setAllTactics((prev) => prev.map((t, i) => (i === currentIndex ? editForm : t)))
      setIsEditing(false)
      setEditForm(null)
    }
  }

  const handleAddToPlan = async () => {
    if (approvedTactics.length === 0 || !currentPlan) return

    setIsLoading(true)

    try {
      // Group tactics by parentTitle (if they have one) or by category
      const tacticsByGroup: Record<string, TacticWithStatus[]> = {}

      approvedTactics.forEach((tactic) => {
        // Use parentTitle as section name if available, otherwise use category
        const groupKey = tactic.parentTitle || tactic.category
        if (!tacticsByGroup[groupKey]) {
          tacticsByGroup[groupKey] = []
        }
        tacticsByGroup[groupKey].push(tactic)
      })

      // Create blocks for each group
      const newBlocks = [...currentPlan.blocks]

      Object.entries(tacticsByGroup).forEach(([groupName, tactics]) => {
        // Check if this is a parent tactic group (has parentTitle)
        const isExpandedGroup = tactics.some((t) => t.parentTitle)

        // Create section block for the group
        const sectionId = crypto.randomUUID()
        const sectionBlock = {
          id: sectionId,
          type: "section" as const,
          title: groupName,
          icon: suggestIconForTactic(groupName, ""),
          // Add description if it's an expanded group
          description: isExpandedGroup ? `Deliverables for ${groupName}` : undefined,
          children: tactics.map((tactic) => {
            const tacticId = crypto.randomUUID()
            // Format content with What/Why/How structure
            const content = `**What:** ${tactic.what}\n\n**Why:** ${tactic.why}\n\n**How:** ${tactic.how}`
            return {
              id: tacticId,
              type: "tactic" as const,
              title: tactic.title,
              tacticId: tactic.title.toLowerCase().replace(/\s+/g, "-"),
              content,
              hours: tactic.estimatedHours,
              startDate: new Date().toISOString().split("T")[0],
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              icon: suggestIconForTactic(tactic.title, tactic.description),
              evidence: tactic.evidence,
              children: [],
            }
          }),
        }
        newBlocks.push(sectionBlock)
      })

      // Update plan
      const updatedPlan = { ...currentPlan, blocks: newBlocks }
      setCurrentPlan(updatedPlan)

      toast({
        title: "Tactics added",
        description: `Added ${approvedTactics.length} tactics to your plan in ${Object.keys(tacticsByGroup).length} sections.`,
      })

      // Reset state
      setStep("select")
      setAllTactics([])
      setCurrentIndex(0)
      setSelectedReferenceIds([])
      setAllSeenTacticTitles([])
    } catch (error) {
      console.error("Error adding tactics to plan:", error)
      toast({
        title: "Error",
        description: "Failed to add tactics to plan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Render select references step
  if (step === "select") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Analyze References</h2>
            <p className="text-muted-foreground text-sm">
              Extract tactics from your references and add them to your marketing plan.
            </p>
          </div>
        </div>

        {references.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No references found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Add references to your plan first, then come back here to analyze them.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Select references to analyze</span>
                <span className="text-muted-foreground text-sm">{selectedReferenceIds.length} selected</span>
              </div>
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                    selectedReferenceIds.includes(ref.id) ? "border-teal-500 bg-teal-50" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedReferenceIds.includes(ref.id)}
                    onCheckedChange={() => handleToggleReference(ref.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium">{ref.title}</h4>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {ref.content.substring(0, 200)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={selectedReferenceIds.length === 0 || isLoading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze References
                </>
              )}
            </Button>
          </>
        )}
      </div>
    )
  }

  // Render review step
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Analyze References</h2>
            <p className="text-muted-foreground text-sm">
              Extract tactics from your references and add them to your marketing plan.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleFindMore}
            disabled={isLoading}
            className="border-teal-200 text-teal-700 hover:bg-teal-50 bg-transparent"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Find More Tactics
          </Button>
        </div>

        {/* Status badges */}
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">
            {pendingCount} to review
          </Badge>
          <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">{approvedCount} approved</Badge>
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{discardedCount} discarded</Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        {pendingCount === 0 && allTactics.length > 0 ? (
          // All reviewed - show summary
          <div className="space-y-6">
            <div className="rounded-lg border bg-teal-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
                <Check className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold">Review Complete</h3>
              <p className="text-muted-foreground mt-1">You've approved {approvedCount} tactics to add to your plan.</p>
            </div>
          </div>
        ) : currentTactic ? (
          // Show current tactic card
          <div className="space-y-4">
            {currentTactic.parentTitle && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CornerDownRight className="h-4 w-4" />
                <span>Deliverable from:</span>
                <Badge variant="outline" className="font-medium">
                  {currentTactic.parentTitle}
                </Badge>
              </div>
            )}

            <div
              className={`rounded-xl border-2 bg-white p-6 shadow-sm ${
                currentTactic.status === "approved"
                  ? "border-teal-300 bg-teal-50/30"
                  : currentTactic.status === "discarded"
                    ? "border-red-200 bg-red-50/30"
                    : "border-gray-200"
              }`}
            >
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                    <Sparkles className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <Badge className="mb-1 bg-teal-100 text-teal-700 hover:bg-teal-100">{currentTactic.category}</Badge>
                    <h3 className="text-lg font-semibold">{currentTactic.title}</h3>
                  </div>
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4" />
                  {currentTactic.estimatedHours}h
                </div>
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-4">{currentTactic.description}</p>

              {/* What/Why/How cards */}
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-blue-50 p-4">
                  <h4 className="mb-2 font-semibold text-blue-700">What</h4>
                  <p className="text-sm text-blue-900">{currentTactic.what}</p>
                </div>
                <div className="rounded-lg border bg-purple-50 p-4">
                  <h4 className="mb-2 font-semibold text-purple-700">Why</h4>
                  <p className="text-sm text-purple-900">{currentTactic.why}</p>
                </div>
                <div className="rounded-lg border bg-teal-50 p-4">
                  <h4 className="mb-2 font-semibold text-teal-700">How</h4>
                  <p className="text-sm text-teal-900">{currentTactic.how}</p>
                </div>
              </div>

              {/* Evidence */}
              {currentTactic.evidence && (
                <div className="text-muted-foreground mb-4 rounded-lg bg-gray-50 p-3 text-sm italic">
                  "{currentTactic.evidence}"
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {currentTactic.status === "pending" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleDiscard}
                      className="border-red-200 text-red-600 hover:bg-red-50 bg-transparent"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Discard
                    </Button>
                    <Button variant="outline" onClick={handleEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsExpandDialogOpen(true)}
                      className="border-purple-200 text-purple-600 hover:bg-purple-50"
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      Expand with AI
                    </Button>
                    <Button onClick={handleApprove} className="bg-teal-600 hover:bg-teal-700">
                      <Check className="mr-2 h-4 w-4" />
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={handleToggleStatus}>
                    {currentTactic.status === "approved" ? (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Move to Discarded
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Move to Approved
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {allTactics.slice(0, 10).map((tactic, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-3 w-3 rounded-full transition-all ${
                  idx === currentIndex ? "scale-125 ring-2 ring-teal-400 ring-offset-2" : ""
                } ${
                  tactic.status === "approved"
                    ? "bg-teal-500"
                    : tactic.status === "discarded"
                      ? "bg-red-400"
                      : "bg-gray-300"
                }`}
              />
            ))}
            {allTactics.length > 10 && (
              <span className="text-muted-foreground ml-1 text-xs">+{allTactics.length - 10} more</span>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.min(allTactics.length - 1, prev + 1))}
            disabled={currentIndex >= allTactics.length - 1}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {approvedCount > 0 && (
        <div className="border-t bg-teal-50 px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h4 className="font-semibold text-teal-900">{approvedCount} tactics ready to add</h4>
                {pendingCount > 0 && <p className="text-sm text-teal-700">{pendingCount} still pending review</p>}

                {/* Group approved tactics by parent or category */}
                <div className="mt-3 space-y-3">
                  {(() => {
                    // Group tactics by parentTitle or category
                    const grouped: Record<string, TacticWithStatus[]> = {}
                    approvedTactics.forEach((t) => {
                      const key = t.parentTitle || t.category
                      if (!grouped[key]) grouped[key] = []
                      grouped[key].push(t)
                    })

                    return Object.entries(grouped).map(([group, tactics]) => (
                      <div key={group} className="rounded-lg bg-white/60 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {tactics[0].parentTitle && <CornerDownRight className="h-3 w-3 text-teal-600" />}
                          <span className="text-sm font-medium text-teal-800">{group}</span>
                          <Badge variant="outline" className="text-xs">
                            {tactics.length} {tactics.length === 1 ? "tactic" : "tactics"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tactics.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 rounded bg-white px-2 py-1 text-sm">
                              <Check className="h-3 w-3 text-teal-600" />
                              <span className="truncate max-w-[200px]">{t.title}</span>
                              <span className="text-muted-foreground text-xs">{t.estimatedHours}h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
              <Button onClick={handleAddToPlan} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Add {approvedCount} Tactics to Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tactic</DialogTitle>
            <DialogDescription>Modify the tactic details before adding it to your plan.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">What</label>
                  <Textarea
                    value={editForm.what}
                    onChange={(e) => setEditForm({ ...editForm, what: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Why</label>
                  <Textarea
                    value={editForm.why}
                    onChange={(e) => setEditForm({ ...editForm, why: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">How</label>
                  <Textarea
                    value={editForm.how}
                    onChange={(e) => setEditForm({ ...editForm, how: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Estimated Hours</label>
                <Input
                  type="number"
                  value={editForm.estimatedHours}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      estimatedHours: Number.parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expand with AI Dialog */}
      <Dialog open={isExpandDialogOpen} onOpenChange={setIsExpandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expand with AI</DialogTitle>
            <DialogDescription>
              Break down "{currentTactic?.title}" into specific deliverables and sub-tactics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Instructions (optional)</label>
              <Textarea
                placeholder="e.g., Focus on social media deliverables, include specific asset types like carousels and reels..."
                value={expandInstruction}
                onChange={(e) => setExpandInstruction(e.target.value)}
                rows={3}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Guide the AI on how to break this down. Leave empty for default expansion.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpandDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExpandWithAI} disabled={isExpanding} className="bg-purple-600 hover:bg-purple-700">
              {isExpanding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Expanding...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Expand Tactic
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

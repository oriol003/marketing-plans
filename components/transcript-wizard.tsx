"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  Check,
  X,
  Edit3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Quote,
  Clock,
  Package,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Zap,
  Brain,
  Split,
  Merge,
  Plus,
  Trash2,
  MessageSquare,
  Building2,
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Block, TacticBlock, SectionBlock } from "@/lib/types"
import { suggestIconForTactic } from "@/lib/utils"
import * as LucideIcons from "lucide-react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Summary type from API
interface TranscriptSummary {
  companyInfo: {
    name: string
    industry: string
    size: string
    location?: string
    description: string
  }
  customerNeeds: Array<{
    need: string
    quote: string
    priority: "high" | "medium" | "low"
  }>
  objectives: {
    primaryGoal: string
    secondaryGoals: string[]
    successMetrics: string[]
    timeline?: string
  }
  currentState: {
    existingEfforts: string[]
    challenges: string[]
    whatWorked: string[]
    whatFailed: string[]
  }
  conversationOutcomes: {
    agreedActions: string[]
    keyDecisions: string[]
    openQuestions: string[]
    clientConcerns: string[]
  }
  budget: {
    mentioned: boolean
    range?: string
    constraints?: string
  }
  stakeholders: Array<{
    name?: string
    role: string
    involvement: string
  }>
  suggestedPlanTitle: string
  executiveSummary: string
}

interface ExtractedTactic {
  id: string
  title: string
  description: string
  deliverable: string
  what: string
  why: string
  how: string
  evidence: string
  evidenceContext?: string
  category: string
  priority: "high" | "medium" | "low"
  estimatedHours: number
  confidence: number
  confidenceReason: string
  canBeDivided: boolean
  suggestedSubTactics: string[]
  status: "pending" | "approved" | "rejected" | "editing"
  expanded?: boolean
}

interface TranscriptWizardProps {
  onComplete: (planData: {
    title: string
    clientName: string
    objective: string
    blocks: Block[]
    transcriptReference: { title: string; content: string }
  }) => void
  onBack: () => void
}

export function TranscriptWizard({ onComplete, onBack }: TranscriptWizardProps) {
  // Steps: input -> processing-summary -> summary -> processing-tactics -> review -> finalize
  const [step, setStep] = useState<"input" | "processing-summary" | "summary" | "processing-tactics" | "review" | "finalize">("input")
  const [transcript, setTranscript] = useState("")
  const [transcriptTitle, setTranscriptTitle] = useState("Discovery Call Transcript")
  const [transcriptSummary, setTranscriptSummary] = useState<TranscriptSummary | null>(null)
  const [extractedTactics, setExtractedTactics] = useState<ExtractedTactic[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState<"summary" | "outline" | "elaborating" | "done">("summary")
  const [error, setError] = useState<string | null>(null)
  const [clientName, setClientName] = useState("")
  const [planTitle, setPlanTitle] = useState("")
  const [objective, setObjective] = useState("")
  const [editingTactic, setEditingTactic] = useState<ExtractedTactic | null>(null)

  // Divide/merge dialogs
  const [divideDialogOpen, setDivideDialogOpen] = useState(false)
  const [tacticToDivide, setTacticToDivide] = useState<ExtractedTactic | null>(null)
  const [divideSubTactics, setDivideSubTactics] = useState<string[]>([])
  const [divideCustomInput, setDivideCustomInput] = useState("")
  const [isGeneratingSubTactics, setIsGeneratingSubTactics] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])
  const [dragMergeTarget, setDragMergeTarget] = useState<string | null>(null)

  // Find more tactics
  const [isFindingMore, setIsFindingMore] = useState(false)
  const [showOpportunities, setShowOpportunities] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Get unique categories from tactics
  const categories = Array.from(new Set(extractedTactics.map(t => t.category))).sort()

  // Group tactics by category
  const tacticsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = extractedTactics.filter(t => t.category === cat)
    return acc
  }, {} as Record<string, ExtractedTactic[]>)

  // Toggle category collapse
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }
  // Step 1: Extract summary from transcript
  const handleExtractSummary = async () => {
    if (!transcript.trim()) {
      setError("Please paste a transcript to analyze")
      return
    }

    setIsProcessing(true)
    setError(null)
    setStep("processing-summary")
    setProcessingStage("summary")

    try {
      const response = await fetch("/api/extract-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to extract summary")
      }

      const data = await response.json()
      setTranscriptSummary(data)
      setClientName(data.companyInfo?.name || "")
      setPlanTitle(data.suggestedPlanTitle || `Marketing Plan for ${data.companyInfo?.name || "Client"}`)
      setObjective(data.objectives?.primaryGoal || "")
      setStep("summary")
    } catch (err) {
      console.error("Error extracting summary:", err)
      setError(err instanceof Error ? err.message : "Failed to extract summary")
      setStep("input")
    } finally {
      setIsProcessing(false)
    }
  }

  // Step 2: Extract tactics from transcript (with summary context)
  const handleExtractTactics = async () => {
    setIsProcessing(true)
    setError(null)
    setStep("processing-tactics")
    setProcessingStage("outline")

    try {
      const response = await fetch("/api/extract-tactics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summaryContext: transcriptSummary, // Pass summary for context
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to extract tactics")
      }

      const data = await response.json()

      // Add IDs and status to extracted tactics - all start as pending for manual review
      const tacticsWithMeta = data.tactics.map((tactic: any) => ({
        ...tactic,
        id: crypto.randomUUID(),
        status: "pending" as const,
        expanded: false,
      }))

      setExtractedTactics(tacticsWithMeta)
      setProcessingStage("done")
      setStep("review")
    } catch (err) {
      console.error("Error extracting tactics:", err)
      setError(err instanceof Error ? err.message : "Failed to extract tactics")
      setStep("summary") // Go back to summary on error
    } finally {
      setIsProcessing(false)
    }
  }

  // Stats
  const pendingTactics = extractedTactics.filter((t) => t.status === "pending")
  const approvedTactics = extractedTactics.filter((t) => t.status === "approved")
  const rejectedTactics = extractedTactics.filter((t) => t.status === "rejected")
  const totalHours = approvedTactics.reduce((sum, t) => sum + t.estimatedHours, 0)

  // Handle tactic approval
  const handleApproveTactic = (id: string) => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "approved" as const } : t)),
    )
  }

  // Handle tactic rejection
  const handleRejectTactic = (id: string) => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "rejected" as const } : t)),
    )
  }

  // Handle tactic reset (back to pending)
  const handleResetTactic = (id: string) => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "pending" as const } : t)),
    )
  }

  // Toggle expand
  const handleToggleExpand = (id: string) => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, expanded: !t.expanded } : t)),
    )
  }

  // Handle edit save
  const handleSaveEdit = (editedTactic: ExtractedTactic) => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.id === editedTactic.id ? { ...editedTactic, status: "pending" as const } : t)),
    )
    setEditingTactic(null)
  }

  // Handle drag and drop (with merge support)
  const handleDragEnd = useCallback((result: DropResult) => {
    setDragMergeTarget(null)

    if (!result.destination) return

    // Check if dragged onto another tactic for merge
    if (dragMergeTarget && result.draggableId !== dragMergeTarget) {
      const sourceTactic = extractedTactics.find(t => t.id === result.draggableId)
      const targetTactic = extractedTactics.find(t => t.id === dragMergeTarget)

      if (sourceTactic && targetTactic) {
        // Merge the two tactics
        const mergedTactic: ExtractedTactic = {
          id: crypto.randomUUID(),
          title: `${targetTactic.title} + ${sourceTactic.title}`,
          description: `${targetTactic.description}; ${sourceTactic.description}`,
          deliverable: `${targetTactic.deliverable}; ${sourceTactic.deliverable}`,
          what: `${targetTactic.what}; ${sourceTactic.what}`,
          why: targetTactic.why,
          how: `${targetTactic.how}; ${sourceTactic.how}`,
          evidence: `${targetTactic.evidence} | ${sourceTactic.evidence}`,
          evidenceContext: targetTactic.evidenceContext,
          category: targetTactic.category,
          priority: targetTactic.priority === "high" || sourceTactic.priority === "high" ? "high" :
            targetTactic.priority === "medium" || sourceTactic.priority === "medium" ? "medium" : "low",
          estimatedHours: targetTactic.estimatedHours + sourceTactic.estimatedHours,
          confidence: Math.max(targetTactic.confidence, sourceTactic.confidence),
          confidenceReason: `Merged from: ${targetTactic.title} and ${sourceTactic.title}`,
          canBeDivided: true,
          suggestedSubTactics: [targetTactic.title, sourceTactic.title],
          status: "pending",
          expanded: false,
        }

        // Find target index and replace both tactics with merged
        const targetIndex = extractedTactics.findIndex(t => t.id === dragMergeTarget)
        const newList = extractedTactics.filter(t => t.id !== result.draggableId && t.id !== dragMergeTarget)
        newList.splice(targetIndex, 0, mergedTactic)
        setExtractedTactics(newList)
        return
      }
    }

    const sourceCategory = result.source.droppableId.replace('category-', '')
    const destCategory = result.destination.droppableId.replace('category-', '')

    // Get the dragged tactic
    const draggedTactic = extractedTactics.find(t => t.id === result.draggableId)
    if (!draggedTactic) return

    // If moving to a different category, update the tactic's category
    if (sourceCategory !== destCategory) {
      setExtractedTactics(prev =>
        prev.map(t => t.id === result.draggableId ? { ...t, category: destCategory } : t)
      )
    } else {
      // Reorder within the same category
      const categoryTactics = extractedTactics.filter(t => t.category === sourceCategory)
      const otherTactics = extractedTactics.filter(t => t.category !== sourceCategory)

      const [reorderedItem] = categoryTactics.splice(result.source.index, 1)
      categoryTactics.splice(result.destination.index, 0, reorderedItem)

      setExtractedTactics([...otherTactics, ...categoryTactics])
    }
  }, [extractedTactics, dragMergeTarget])

  // Approve all pending
  const handleApproveAll = () => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.status === "pending" ? { ...t, status: "approved" as const } : t)),
    )
  }

  // Reject all pending
  const handleRejectAll = () => {
    setExtractedTactics((prev) =>
      prev.map((t) => (t.status === "pending" ? { ...t, status: "rejected" as const } : t)),
    )
  }

  // Open divide dialog with editable sub-tactics
  const handleOpenDivide = (tactic: ExtractedTactic) => {
    setTacticToDivide(tactic)
    setDivideSubTactics(tactic.suggestedSubTactics || [])
    setDivideCustomInput("")
    setDivideDialogOpen(true)
  }

  // Add sub-tactic in divide dialog
  const handleAddSubTactic = () => {
    if (!divideCustomInput.trim()) return
    setDivideSubTactics(prev => [...prev, divideCustomInput.trim()])
    setDivideCustomInput("")
  }

  // Remove sub-tactic in divide dialog
  const handleRemoveSubTactic = (index: number) => {
    setDivideSubTactics(prev => prev.filter((_, i) => i !== index))
  }

  // Edit sub-tactic in divide dialog
  const handleEditSubTactic = (index: number, value: string) => {
    setDivideSubTactics(prev => prev.map((s, i) => i === index ? value : s))
  }

  // Divide tactic into sub-tactics
  const handleDivideTactic = (subTacticTitles: string[]) => {
    if (!tacticToDivide || subTacticTitles.length === 0) return

    // Create new tactics from sub-tactics
    const newTactics = subTacticTitles.map((title) => ({
      id: crypto.randomUUID(),
      title,
      description: `Split from: ${tacticToDivide.title}`,
      deliverable: title,
      what: title,
      why: tacticToDivide.why,
      how: "To be defined",
      evidence: tacticToDivide.evidence,
      evidenceContext: tacticToDivide.evidenceContext,
      category: tacticToDivide.category,
      priority: tacticToDivide.priority,
      estimatedHours: Math.ceil(tacticToDivide.estimatedHours / subTacticTitles.length),
      confidence: tacticToDivide.confidence,
      confidenceReason: `Derived from: ${tacticToDivide.title}`,
      canBeDivided: false,
      suggestedSubTactics: [],
      status: "pending" as const,
      expanded: false,
    }))

    // Remove original and add new tactics
    const tacticIndex = extractedTactics.findIndex((t) => t.id === tacticToDivide.id)
    const newList = [...extractedTactics]
    newList.splice(tacticIndex, 1, ...newTactics)
    setExtractedTactics(newList)

    setDivideDialogOpen(false)
    setTacticToDivide(null)
    setDivideSubTactics([])
  }

  // Find more tactics (second pass with lower confidence)
  const handleFindMoreTactics = async () => {
    setIsFindingMore(true)
    setError(null)

    try {
      const existingTitles = extractedTactics.map(t => t.title)

      const response = await fetch("/api/extract-tactics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summaryContext: transcriptSummary,
          excludeTactics: existingTitles,
          findMore: true, // Signal to look for lower confidence tactics
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to find more tactics")
      }

      const data = await response.json()

      if (data.tactics && data.tactics.length > 0) {
        // Add new tactics with "opportunity" category marker
        const newTactics = data.tactics.map((t: any) => ({
          ...t,
          id: crypto.randomUUID(),
          status: "pending",
          expanded: false,
          confidenceReason: t.confidenceReason || "Found in secondary extraction",
        }))

        setExtractedTactics(prev => [...prev, ...newTactics])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find more tactics")
    } finally {
      setIsFindingMore(false)
    }
  }

  // Toggle selection for merge
  const handleToggleMergeSelect = (id: string) => {
    setSelectedForMerge((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Merge selected tactics
  const handleMergeTactics = () => {
    if (selectedForMerge.length < 2) return

    const tacticsToMerge = extractedTactics.filter((t) => selectedForMerge.includes(t.id))

    // Create merged tactic
    const mergedTactic: ExtractedTactic = {
      id: crypto.randomUUID(),
      title: tacticsToMerge.map((t) => t.title).join(" + "),
      description: tacticsToMerge.map((t) => t.description).join("; "),
      deliverable: tacticsToMerge.map((t) => t.deliverable).join("; "),
      what: tacticsToMerge.map((t) => t.what).join("; "),
      why: tacticsToMerge[0].why,
      how: tacticsToMerge.map((t) => t.how).join("; "),
      evidence: tacticsToMerge.map((t) => t.evidence).join(" | "),
      evidenceContext: tacticsToMerge[0].evidenceContext,
      category: tacticsToMerge[0].category,
      priority: tacticsToMerge.some(t => t.priority === "high") ? "high" :
        tacticsToMerge.some(t => t.priority === "medium") ? "medium" : "low",
      estimatedHours: tacticsToMerge.reduce((sum, t) => sum + t.estimatedHours, 0),
      confidence: Math.max(...tacticsToMerge.map((t) => t.confidence)),
      confidenceReason: `Merged from ${tacticsToMerge.length} tactics`,
      canBeDivided: true,
      suggestedSubTactics: tacticsToMerge.map((t) => t.title),
      status: "pending",
      expanded: false,
    }

    // Remove merged tactics and add new one
    const newList = extractedTactics.filter((t) => !selectedForMerge.includes(t.id))
    newList.unshift(mergedTactic)
    setExtractedTactics(newList)

    setSelectedForMerge([])
    setMergeDialogOpen(false)
  }

  // Add custom tactic
  const handleAddTactic = () => {
    const newTactic: ExtractedTactic = {
      id: crypto.randomUUID(),
      title: "New Tactic",
      description: "Custom tactic added manually",
      deliverable: "Define deliverable",
      what: "Define what will be created",
      why: "Define strategic value",
      how: "Define execution approach",
      evidence: "Based on client discussion",
      evidenceContext: "",
      category: "Messaging & Strategy",
      priority: "medium",
      estimatedHours: 8,
      confidence: 50,
      confidenceReason: "Manually added",
      canBeDivided: false,
      suggestedSubTactics: [],
      status: "editing",
      expanded: true,
    }
    setExtractedTactics((prev) => [newTactic, ...prev])
    setEditingTactic(newTactic)
  }

  // Delete tactic
  const handleDeleteTactic = (id: string) => {
    setExtractedTactics((prev) => prev.filter((t) => t.id !== id))
  }

  // Convert approved tactics to blocks
  const convertToBlocks = (): Block[] => {
    const blocks: Block[] = []
    let order = 0

    // Add cover block
    blocks.push({
      id: crypto.randomUUID(),
      type: "cover",
      order: order++,
      title: planTitle,
      subtitle: objective,
      clientName: clientName,
      executionPeriod: "",
      branding: "",
      badgeLabel: "MARKETING PLAN",
      brandColors: ["#00A7B5", "#FF6B35"],
    })

    // Group approved tactics by category (maintain order within groups)
    const tacticsByCategory = approvedTactics.reduce(
      (acc, tactic) => {
        const category = tactic.category || "General"
        if (!acc[category]) acc[category] = []
        acc[category].push(tactic)
        return acc
      },
      {} as Record<string, ExtractedTactic[]>,
    )

    // Create section blocks with tactics as children
    Object.entries(tacticsByCategory).forEach(([category, tactics]) => {
      const sectionId = crypto.randomUUID()
      const sectionIcon = suggestIconForTactic(category, "")

      const childBlocks: TacticBlock[] = tactics.map((tactic, idx) => ({
        id: crypto.randomUUID(),
        type: "tactic" as const,
        order: idx,
        parentId: sectionId,
        // Note: Not setting tacticId since transcript-derived tactics aren't from templates
        title: tactic.title,
        description: tactic.description,
        content: "",
        sourceContext: `**Deliverable:** ${tactic.deliverable}\n\n**What:** ${tactic.what}\n\n**Why:** ${tactic.why}\n\n**How:** ${tactic.how}\n\n---\n\n**Client Said:** "${tactic.evidence}"\n${tactic.evidenceContext ? `_Context: ${tactic.evidenceContext}_` : ""}\n\n**Priority:** ${tactic.priority?.toUpperCase() || "MEDIUM"}\n**Confidence:** ${tactic.confidence}% - ${tactic.confidenceReason}`,
        hours: tactic.estimatedHours || 4,
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        icon: suggestIconForTactic(tactic.title, tactic.description),
      }))

      const sectionBlock: SectionBlock = {
        id: sectionId,
        type: "section",
        order: order++,
        title: category,
        description: `Tactics related to ${category.toLowerCase()}`,
        icon: sectionIcon,
        children: childBlocks,
      }

      blocks.push(sectionBlock)
    })

    return blocks
  }

  // Finalize and create plan
  const handleFinalize = () => {
    const blocks = convertToBlocks()
    onComplete({
      title: planTitle,
      clientName,
      objective,
      blocks,
      transcriptReference: {
        title: transcriptTitle,
        content: transcript,
      },
    })
  }

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName] || Package
    return IconComponent
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "text-green-600 bg-green-50 border-green-200"
    if (confidence >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200"
    if (confidence >= 50) return "text-amber-600 bg-amber-50 border-amber-200"
    if (confidence >= 30) return "text-orange-600 bg-orange-50 border-orange-200"
    return "text-red-600 bg-red-50 border-red-200"
  }

  // Input step
  if (step === "input") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Create Plan from Transcript</h1>
          <p className="text-muted-foreground">
            Paste your discovery call or meeting transcript and let AI extract actionable tactics
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-600" />
              AI-Powered Extraction
            </CardTitle>
            <CardDescription>
              Uses Gemini 3 Pro for comprehensive extraction and Gemini 3 Flash for detailed elaboration with client quotes as evidence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transcriptTitle">Transcript Title</Label>
              <Input
                id="transcriptTitle"
                value={transcriptTitle}
                onChange={(e) => setTranscriptTitle(e.target.value)}
                placeholder="e.g., Discovery Call with Acme Corp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript Content</Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your transcript here...

Example:
[00:00] Consultant: Hi, thanks for joining today. Let's discuss your marketing challenges.
[00:15] Client: Our main issue is we're not generating enough qualified leads...
[02:30] Client: We tried Google Ads but the cost per lead was too high...
[05:00] Consultant: Have you considered content marketing?"
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Include timestamps if available. The AI will extract direct client quotes as evidence for each tactic.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleExtractSummary}
              className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
              size="lg"
              disabled={!transcript.trim()}
            >
              <Sparkles className="w-4 h-4" />
              Analyze Transcript
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Processing summary step
  if (step === "processing-summary") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Analyzing Transcript</h2>
          <p className="text-muted-foreground">
            Extracting company info, client needs, objectives, and conversation outcomes...
          </p>
        </div>
      </div>
    )
  }

  // Summary review step
  if (step === "summary" && transcriptSummary) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Button variant="ghost" onClick={() => setStep("input")} className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Transcript
          </Button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Conversation Summary</h1>
            <p className="text-muted-foreground">Review the extracted information before generating tactics</p>
          </div>

          {/* Executive Summary */}
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <p className="text-lg">{transcriptSummary.executiveSummary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Company Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div><span className="font-medium">Name:</span> {transcriptSummary.companyInfo?.name || 'Unknown'}</div>
                <div><span className="font-medium">Industry:</span> {transcriptSummary.companyInfo?.industry || 'Unknown'}</div>
                <div><span className="font-medium">Size:</span> {transcriptSummary.companyInfo?.size || 'Unknown'}</div>
                <div className="text-sm text-muted-foreground">{transcriptSummary.companyInfo?.description}</div>
              </CardContent>
            </Card>

            {/* Objectives */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5 text-green-600" />
                  Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-xs font-medium text-green-700">PRIMARY GOAL</span>
                  <p className="text-sm">{transcriptSummary.objectives?.primaryGoal || 'Not specified'}</p>
                </div>
                {(transcriptSummary.objectives?.secondaryGoals?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Secondary Goals:</span>
                    <ul className="text-sm mt-1 space-y-1">
                      {(Array.isArray(transcriptSummary.objectives?.secondaryGoals) ? transcriptSummary.objectives.secondaryGoals : []).map((goal, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {transcriptSummary.objectives?.timeline && (
                  <div className="text-sm"><span className="font-medium">Timeline:</span> {transcriptSummary.objectives.timeline}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Customer Needs */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                Customer Needs & Pain Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(Array.isArray(transcriptSummary.customerNeeds) ? transcriptSummary.customerNeeds : []).map((need, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg border",
                    need.priority === "high" ? "bg-red-50 border-red-200" :
                      need.priority === "medium" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        need.priority === "high" ? "border-red-300 text-red-700" :
                          need.priority === "medium" ? "border-amber-300 text-amber-700" : "border-gray-300"
                      )}>
                        {need.priority.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{need.need}</span>
                    </div>
                    <p className="text-sm italic text-muted-foreground">"{need.quote}"</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Agreed Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Agreed Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(transcriptSummary.conversationOutcomes?.agreedActions?.length ?? 0) > 0 ? (
                  <ul className="space-y-2">
                    {(Array.isArray(transcriptSummary.conversationOutcomes?.agreedActions) ? transcriptSummary.conversationOutcomes.agreedActions : []).map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None identified in transcript</p>
                )}
              </CardContent>
            </Card>

            {/* Open Questions / Concerns */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Open Questions & Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(transcriptSummary.conversationOutcomes?.openQuestions?.length ?? 0) > 0 && (
                  <div className="mb-3">
                    <span className="text-xs font-medium text-muted-foreground">Questions to address:</span>
                    <ul className="space-y-1 mt-1">
                      {(Array.isArray(transcriptSummary.conversationOutcomes?.openQuestions) ? transcriptSummary.conversationOutcomes.openQuestions : []).map((q, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-amber-500">?</span> {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(transcriptSummary.conversationOutcomes?.clientConcerns?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Client concerns:</span>
                    <ul className="space-y-1 mt-1">
                      {(Array.isArray(transcriptSummary.conversationOutcomes?.clientConcerns) ? transcriptSummary.conversationOutcomes.clientConcerns : []).map((c, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <AlertCircle className="w-3 h-3 text-amber-500 mt-1 flex-shrink-0" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(transcriptSummary.conversationOutcomes?.openQuestions?.length ?? 0) === 0 &&
                  (transcriptSummary.conversationOutcomes?.clientConcerns?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground">None identified in transcript</p>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Budget & Stakeholders row */}
          {(transcriptSummary.budget?.mentioned || (transcriptSummary.stakeholders?.length ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              {transcriptSummary.budget.mentioned && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Budget</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transcriptSummary.budget.range && <p className="text-sm"><span className="font-medium">Range:</span> {transcriptSummary.budget.range}</p>}
                    {transcriptSummary.budget.constraints && <p className="text-sm text-muted-foreground">{transcriptSummary.budget.constraints}</p>}
                  </CardContent>
                </Card>
              )}
              {(transcriptSummary.stakeholders?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-purple-600" />
                      Stakeholders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(Array.isArray(transcriptSummary.stakeholders) ? transcriptSummary.stakeholders : []).map((s, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{s.name || s.role}</span>
                          {s.name && <span className="text-muted-foreground"> - {s.role}</span>}
                          <p className="text-xs text-muted-foreground">{s.involvement}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2 mb-6">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Continue Button */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep("input")} className="flex-1">
              Edit Transcript
            </Button>
            <Button onClick={handleExtractTactics} className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600">
              <Sparkles className="w-4 h-4" />
              Extract Tactics
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Processing tactics step
  if (step === "processing-tactics") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Extracting Tactics</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 justify-center">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                processingStage === "outline" ? "bg-amber-500" : "bg-green-500"
              )}>
                {processingStage === "outline" ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="text-sm">Finding tactics with Gemini 3 Pro</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                processingStage === "elaborating" ? "bg-amber-500" :
                  processingStage === "done" ? "bg-green-500" : "bg-gray-300"
              )}>
                {processingStage === "elaborating" ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : processingStage === "done" ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Zap className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <span className="text-sm">Adding deliverables & client quotes with Gemini 3 Flash</span>
            </div>
          </div>
          <p className="text-muted-foreground mt-4">
            Using context from summary to find relevant tactics...
          </p>
        </div>
      </div>
    )
  }

  // Review step - Stacked list with drag & drop
  if (step === "review") {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setStep("summary")} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Summary
            </Button>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
                <Check className="w-3 h-3" />
                {approvedTactics.length} approved
              </Badge>
              <Badge variant="secondary" className="gap-1">
                {pendingTactics.length} pending
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {totalHours}h total
              </Badge>
            </div>
          </div>

          {/* Title & Actions */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Review Extracted Tactics</h1>
              <p className="text-muted-foreground text-sm">
                {extractedTactics.length} tactics found • Drag onto another to merge • Divide large tactics into deliverables
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFindMoreTactics}
                disabled={isFindingMore}
                className="gap-1 text-blue-600"
              >
                {isFindingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Find More
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddTactic} className="gap-1">
                <Plus className="w-4 h-4" />
                Add Tactic
              </Button>
              {selectedForMerge.length >= 2 && (
                <Button variant="outline" size="sm" onClick={handleMergeTactics} className="gap-1 text-purple-600">
                  <Merge className="w-4 h-4" />
                  Merge ({selectedForMerge.length})
                </Button>
              )}
              {pendingTactics.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleApproveAll} className="gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Approve All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRejectAll} className="gap-1 text-red-600">
                    <X className="w-4 h-4" />
                    Reject All
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Category-grouped Tactic List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-6">
              {categories.map(category => {
                const categoryTactics = tacticsByCategory[category] || []
                const isCollapsed = collapsedCategories.has(category)
                const categoryApproved = categoryTactics.filter(t => t.status === "approved").length
                const categoryHours = categoryTactics.reduce((sum, t) => sum + t.estimatedHours, 0)
                const CategoryIcon = getIconComponent(suggestIconForTactic(category, ""))

                return (
                  <div key={category} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    {/* Category Header */}
                    <div
                      className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleCategoryCollapse(category)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <CategoryIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{category}</h3>
                        <p className="text-sm text-muted-foreground">
                          {categoryTactics.length} tactics • {categoryApproved} approved • {categoryHours}h total
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {categoryTactics.length}
                        </Badge>
                        {isCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Tactics in Category */}
                    {!isCollapsed && (
                      <Droppable droppableId={`category-${category}`}>
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="p-3 pt-0 space-y-2"
                          >
                            {categoryTactics.map((tactic, index) => {
                              const IconComponent = getIconComponent(suggestIconForTactic(tactic.title, tactic.description))
                              const confidenceColor = getConfidenceColor(tactic.confidence)
                              const isEditing = editingTactic?.id === tactic.id
                              const isSelectedForMerge = selectedForMerge.includes(tactic.id)

                              return (
                                <Draggable key={tactic.id} draggableId={tactic.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      onMouseEnter={() => {
                                        // If something is being dragged and it's not this item
                                        if (snapshot.draggingOver && !snapshot.isDragging) {
                                          setDragMergeTarget(tactic.id)
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        if (dragMergeTarget === tactic.id) {
                                          setDragMergeTarget(null)
                                        }
                                      }}
                                      className={cn(
                                        "bg-white rounded-xl border shadow-sm transition-all relative",
                                        snapshot.isDragging && "shadow-lg ring-2 ring-amber-500",
                                        tactic.status === "approved" && "border-green-300 bg-green-50/30",
                                        tactic.status === "rejected" && "border-gray-200 bg-gray-50 opacity-60",
                                        isSelectedForMerge && "ring-2 ring-purple-400",
                                        dragMergeTarget === tactic.id && !snapshot.isDragging && "ring-2 ring-purple-500 bg-purple-50",
                                      )}
                                    >
                                      {/* Merge indicator */}
                                      {dragMergeTarget === tactic.id && !snapshot.isDragging && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-purple-500/10 rounded-xl z-10 pointer-events-none">
                                          <div className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                                            <Merge className="w-4 h-4" />
                                            Drop to Merge
                                          </div>
                                        </div>
                                      )}
                                      {isEditing ? (
                                        // Edit mode
                                        <div className="p-6 space-y-4">
                                          <div className="flex items-center gap-2 mb-4">
                                            <Edit3 className="w-5 h-5 text-amber-600" />
                                            <h3 className="font-semibold">Edit Tactic</h3>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <Label>Title</Label>
                                              <Input
                                                value={editingTactic.title}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, title: e.target.value })}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Category</Label>
                                              <Input
                                                value={editingTactic.category}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, category: e.target.value })}
                                              />
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Deliverable (be specific!)</Label>
                                            <Textarea
                                              value={editingTactic.deliverable}
                                              onChange={(e) => setEditingTactic({ ...editingTactic, deliverable: e.target.value })}
                                              placeholder="e.g., 5 branded flyers (8.5x11), 2 pull-up banners"
                                              className="min-h-[60px]"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                              value={editingTactic.description}
                                              onChange={(e) => setEditingTactic({ ...editingTactic, description: e.target.value })}
                                              className="min-h-[60px]"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Client Quote (Evidence)</Label>
                                            <Textarea
                                              value={editingTactic.evidence}
                                              onChange={(e) => setEditingTactic({ ...editingTactic, evidence: e.target.value })}
                                              placeholder="What did the client say that supports this tactic?"
                                              className="min-h-[60px]"
                                            />
                                          </div>
                                          <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                              <Label>What</Label>
                                              <Textarea
                                                value={editingTactic.what}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, what: e.target.value })}
                                                className="min-h-[80px]"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Why</Label>
                                              <Textarea
                                                value={editingTactic.why}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, why: e.target.value })}
                                                className="min-h-[80px]"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>How</Label>
                                              <Textarea
                                                value={editingTactic.how}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, how: e.target.value })}
                                                className="min-h-[80px]"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <Label>Estimated Hours</Label>
                                              <Input
                                                type="number"
                                                value={editingTactic.estimatedHours}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, estimatedHours: Number(e.target.value) || 0 })}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Confidence (%)</Label>
                                              <Input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={editingTactic.confidence}
                                                onChange={(e) => setEditingTactic({ ...editingTactic, confidence: Number(e.target.value) || 50 })}
                                              />
                                            </div>
                                          </div>
                                          <div className="flex gap-2 pt-2">
                                            <Button onClick={() => handleSaveEdit(editingTactic)} className="flex-1 bg-amber-500 hover:bg-amber-600">
                                              Save Changes
                                            </Button>
                                            <Button variant="outline" onClick={() => setEditingTactic(null)}>
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        // View mode
                                        <>
                                          {/* Main row */}
                                          <div className="flex items-start gap-4 p-4">
                                            {/* Merge checkbox */}
                                            <input
                                              type="checkbox"
                                              checked={isSelectedForMerge}
                                              onChange={() => handleToggleMergeSelect(tactic.id)}
                                              className="mt-3 w-4 h-4 rounded border-gray-300"
                                            />

                                            {/* Drag Handle */}
                                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing mt-2">
                                              <GripVertical className="w-5 h-5 text-gray-400" />
                                            </div>

                                            {/* Icon */}
                                            <div className={cn(
                                              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                              tactic.status === "approved" ? "bg-green-100" :
                                                tactic.status === "rejected" ? "bg-gray-100" : "bg-amber-100"
                                            )}>
                                              <IconComponent className={cn(
                                                "w-5 h-5",
                                                tactic.status === "approved" ? "text-green-600" :
                                                  tactic.status === "rejected" ? "text-gray-400" : "text-amber-600"
                                              )} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium">{tactic.title}</h3>
                                                <Badge variant="secondary" className="text-xs">{tactic.category}</Badge>
                                                {tactic.canBeDivided && (
                                                  <Badge variant="outline" className="text-xs gap-1 text-purple-600 border-purple-200">
                                                    <Split className="w-3 h-3" />
                                                    Divisible
                                                  </Badge>
                                                )}
                                              </div>

                                              {/* Deliverable - always visible */}
                                              <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-0.5">
                                                  <Package className="w-3 h-3" />
                                                  Deliverable
                                                </div>
                                                <p className="text-sm text-blue-900">{tactic.deliverable}</p>
                                              </div>

                                              {/* Client quote - always visible */}
                                              <button
                                                onClick={() => handleToggleExpand(tactic.id)}
                                                className="w-full text-left p-2 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                              >
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-0.5">
                                                  <MessageSquare className="w-3 h-3" />
                                                  Client said:
                                                </div>
                                                <p className="text-sm text-amber-900 italic line-clamp-2">"{tactic.evidence}"</p>
                                                {tactic.evidenceContext && (
                                                  <p className="text-xs text-amber-600 mt-1">{tactic.evidenceContext}</p>
                                                )}
                                              </button>
                                            </div>

                                            {/* Right side info */}
                                            <div className="flex flex-col items-end gap-2">
                                              {/* Priority Badge */}
                                              <Badge className={cn(
                                                "text-xs",
                                                tactic.priority === "high" && "bg-red-100 text-red-700 border-red-200",
                                                tactic.priority === "medium" && "bg-amber-100 text-amber-700 border-amber-200",
                                                tactic.priority === "low" && "bg-gray-100 text-gray-600 border-gray-200"
                                              )}>
                                                {tactic.priority?.toUpperCase() || "MEDIUM"}
                                              </Badge>

                                              {/* Confidence Badge */}
                                              <div className={cn(
                                                "px-3 py-1.5 rounded-full border text-sm font-medium",
                                                confidenceColor
                                              )}>
                                                {tactic.confidence}%
                                              </div>

                                              {/* Hours */}
                                              <Badge variant="outline" className="gap-1">
                                                <Clock className="w-3 h-3" />
                                                {tactic.estimatedHours}h
                                              </Badge>

                                              {/* Status indicator */}
                                              {tactic.status === "approved" && (
                                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                                  <Check className="w-4 h-4 text-white" />
                                                </div>
                                              )}
                                              {tactic.status === "rejected" && (
                                                <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
                                                  <X className="w-4 h-4 text-white" />
                                                </div>
                                              )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-col gap-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleExpand(tactic.id)}
                                                className="h-8 w-8 p-0"
                                              >
                                                {tactic.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                              </Button>
                                              {tactic.canBeDivided && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleOpenDivide(tactic)}
                                                  className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                                  title="Divide into sub-tactics"
                                                >
                                                  <Split className="w-4 h-4" />
                                                </Button>
                                              )}
                                              {tactic.status === "pending" ? (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRejectTactic(tactic.id)}
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingTactic(tactic)}
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <Edit3 className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleApproveTactic(tactic.id)}
                                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                  >
                                                    <Check className="w-4 h-4" />
                                                  </Button>
                                                </>
                                              ) : (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleResetTactic(tactic.id)}
                                                  className="h-8 px-2 text-xs"
                                                >
                                                  Reset
                                                </Button>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTactic(tactic.id)}
                                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          </div>

                                          {/* Expanded details */}
                                          {tactic.expanded && (
                                            <div className="px-4 pb-4 pt-0 border-t">
                                              <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div className="p-3 bg-blue-50 rounded-lg">
                                                  <h4 className="font-semibold text-blue-900 text-sm mb-1">What</h4>
                                                  <p className="text-sm text-blue-800">{tactic.what}</p>
                                                </div>
                                                <div className="p-3 bg-green-50 rounded-lg">
                                                  <h4 className="font-semibold text-green-900 text-sm mb-1">Why</h4>
                                                  <p className="text-sm text-green-800">{tactic.why}</p>
                                                </div>
                                                <div className="p-3 bg-purple-50 rounded-lg">
                                                  <h4 className="font-semibold text-purple-900 text-sm mb-1">How</h4>
                                                  <p className="text-sm text-purple-800">{tactic.how}</p>
                                                </div>
                                              </div>

                                              {/* Suggested sub-tactics if divisible */}
                                              {tactic.canBeDivided && tactic.suggestedSubTactics && tactic.suggestedSubTactics.length > 0 && (
                                                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                  <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-semibold text-purple-900 text-sm flex items-center gap-1">
                                                      <Split className="w-4 h-4" />
                                                      Can be divided into:
                                                    </h4>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() => handleOpenDivide(tactic)}
                                                      className="h-7 text-xs text-purple-600 border-purple-300"
                                                    >
                                                      Divide Now
                                                    </Button>
                                                  </div>
                                                  <ul className="space-y-1">
                                                    {tactic.suggestedSubTactics.map((sub, idx) => (
                                                      <li key={idx} className="text-sm text-purple-800 flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                                        {sub}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}

                                              <div className="mt-4">
                                                <div className={cn("p-3 rounded-lg border", confidenceColor)}>
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <Brain className="w-4 h-4" />
                                                    <h4 className="font-semibold text-sm">Confidence: {tactic.confidence}%</h4>
                                                  </div>
                                                  <p className="text-sm">{tactic.confidenceReason}</p>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                )
              })}
            </div>
          </DragDropContext>

          {/* Bottom action bar */}
          {approvedTactics.length > 0 && (
            <div className="sticky bottom-4 mt-6">
              <Card className="border-amber-200 bg-amber-50/80 backdrop-blur">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Ready to finalize?</p>
                    <p className="text-sm text-muted-foreground">
                      {approvedTactics.length} tactics approved • {totalHours} hours estimated
                    </p>
                  </div>
                  <Button onClick={() => setStep("finalize")} className="gap-2 bg-amber-500 hover:bg-amber-600">
                    Continue to Finalize <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Divide Dialog */}
        <Dialog open={divideDialogOpen} onOpenChange={setDivideDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Split className="w-5 h-5 text-purple-600" />
                Divide Tactic into Sub-Deliverables
              </DialogTitle>
              <DialogDescription>
                Split "{tacticToDivide?.title}" into smaller, more specific deliverables. Edit, add, or remove items below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Editable sub-tactics list */}
              <div className="space-y-2">
                <Label>Sub-deliverables ({divideSubTactics.length}):</Label>
                {divideSubTactics.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-gray-50 rounded-lg">
                    No sub-deliverables yet. Add some below or they'll be generated.
                  </p>
                ) : (
                  divideSubTactics.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <Input
                        value={sub}
                        onChange={(e) => handleEditSubTactic(idx, e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubTactic(idx)}
                        className="h-8 w-8 p-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Add new sub-tactic */}
              <div className="flex gap-2">
                <Input
                  value={divideCustomInput}
                  onChange={(e) => setDivideCustomInput(e.target.value)}
                  placeholder="Add a sub-deliverable..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddSubTactic()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleAddSubTactic}
                  disabled={!divideCustomInput.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDivideDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDivideTactic(divideSubTactics)}
                  disabled={divideSubTactics.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Divide into {divideSubTactics.length} Tactics
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Finalize step
  if (step === "finalize") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => setStep("review")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Review
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Finalize Your Plan</h1>
          <p className="text-muted-foreground">Review the plan details and create your marketing plan</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planTitle">Plan Title</Label>
              <Input
                id="planTitle"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="Marketing Plan Title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client or Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <div className="h-10 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">{approvedTactics.length} tactics</Badge>
                  <Badge variant="outline">{totalHours} hours</Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="objective">Plan Objective</Label>
              <Textarea
                id="objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Describe the main objective of this marketing plan..."
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tactics Summary</CardTitle>
            <CardDescription>These tactics will be organized into sections in your plan</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(
              approvedTactics.reduce(
                (acc, tactic) => {
                  const category = tactic.category || "General"
                  if (!acc[category]) acc[category] = []
                  acc[category].push(tactic)
                  return acc
                },
                {} as Record<string, ExtractedTactic[]>,
              ),
            ).map(([category, tactics]) => (
              <div key={category} className="mb-4 last:mb-0">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="outline">{category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({tactics.length} {tactics.length === 1 ? "tactic" : "tactics"})
                  </span>
                </h4>
                <ul className="space-y-2 pl-4">
                  {tactics.map((tactic) => (
                    <li key={tactic.id} className="text-sm border-l-2 border-green-300 pl-3">
                      <div className="font-medium">{tactic.title}</div>
                      <div className="text-muted-foreground text-xs">{tactic.deliverable}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setStep("review")} className="flex-1">
            Back to Review
          </Button>
          <Button
            onClick={handleFinalize}
            className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600"
            disabled={approvedTactics.length === 0}
          >
            <Sparkles className="w-4 h-4" />
            Create Marketing Plan
          </Button>
        </div>
      </div>
    )
  }

  return null
}

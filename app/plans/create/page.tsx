"use client"

import { SetupWizard } from "@/components/setup-wizard"
import { TranscriptWizard } from "@/components/transcript-wizard"
import { usePlanStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, FileEdit, ArrowRight, FileText } from "lucide-react"

export default function NewPlanPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [mode, setMode] = useState<"choice" | "wizard" | "blank" | "transcript">("choice")
  const { setWizardData, setGenerating } = usePlanStore()

  const handleComplete = async (wizardData: any) => {
    setIsCreating(true)
    setGenerating(true, "Creating plan...")

    try {
      const generateResponse = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wizardData),
      })

      if (!generateResponse.ok) throw new Error("Failed to generate plan")

      const { blocks } = await generateResponse.json()

      const createResponse = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Marketing Plan for ${wizardData.clientName}`,
          objective: wizardData.objective,
          clientName: wizardData.clientName,
          blocks,
        }),
      })

      if (!createResponse.ok) throw new Error("Failed to create plan")

      const { plan } = await createResponse.json()
      router.push(`/plans/${plan.id}`)
    } catch (error) {
      console.error("Error creating plan:", error)
      alert("Failed to create plan. Please try again.")
    } finally {
      setIsCreating(false)
      setGenerating(false)
    }
  }

  const handleCreateBlank = async () => {
    setIsCreating(true)
    try {
      const defaultCoverBlock = {
        id: crypto.randomUUID(),
        type: "cover" as const,
        order: 0,
        title: "Untitled Marketing Plan",
        subtitle: "",
        clientName: "",
        executionPeriod: "",
        branding: "",
        badgeLabel: "MARKETING PLAN",
        brandColors: ["#00A7B5", "#FF6B35"],
      }

      const createResponse = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Marketing Plan",
          objective: "",
          clientName: "",
          blocks: [defaultCoverBlock],
        }),
      })

      if (!createResponse.ok) throw new Error("Failed to create plan")

      const { plan } = await createResponse.json()
      router.push(`/plans/${plan.id}`)
    } catch (error) {
      console.error("Error creating blank plan:", error)
      alert("Failed to create blank plan. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleTranscriptComplete = async (planData: {
    title: string
    clientName: string
    objective: string
    blocks: any[]
    transcriptReference: { title: string; content: string }
  }) => {
    setIsCreating(true)
    setGenerating(true, "Creating plan from transcript...")

    try {
      const createResponse = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: planData.title,
          objective: planData.objective,
          clientName: planData.clientName,
          blocks: planData.blocks,
        }),
      })

      if (!createResponse.ok) throw new Error("Failed to create plan")

      const { plan } = await createResponse.json()

      // Add the transcript as a reference
      if (planData.transcriptReference) {
        await fetch(`/api/plans/${plan.id}/references`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: planData.transcriptReference.title,
            content: planData.transcriptReference.content,
          }),
        })
      }

      router.push(`/plans/${plan.id}`)
    } catch (error) {
      console.error("Error creating plan from transcript:", error)
      alert("Failed to create plan. Please try again.")
    } finally {
      setIsCreating(false)
      setGenerating(false)
    }
  }

  if (mode === "choice") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Create New Marketing Plan</h1>
            <p className="text-lg text-muted-foreground">Choose how you'd like to get started</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* AI Wizard Option */}
            <Card
              className="relative overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary group"
              onClick={() => setMode("wizard")}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-[100px]" />
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl">AI-Powered Wizard</CardTitle>
                <CardDescription className="text-sm">Generate a plan with AI assistance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Perfect for:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>Quickly generating structured proposals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>Getting AI suggestions for tactics</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Button className="w-full gap-2 group-hover:gap-3 transition-all" size="lg">
                    Start with AI <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card
              className="relative overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] border-2 hover:border-amber-500 group"
              onClick={() => setMode("transcript")}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent rounded-bl-[100px]" />
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl">From Transcript</CardTitle>
                <CardDescription className="text-sm">Extract tactics from a call or meeting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Perfect for:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span>Converting discovery calls into plans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span>Extracting action items from meetings</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Button
                    className="w-full gap-2 group-hover:gap-3 transition-all bg-amber-500 hover:bg-amber-600"
                    size="lg"
                  >
                    From Transcript <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Blank Plan Option */}
            <Card
              className="relative overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary group"
              onClick={handleCreateBlank}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-200/50 to-transparent rounded-bl-[100px]" />
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileEdit className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl">Start from Scratch</CardTitle>
                <CardDescription className="text-sm">Begin with a blank canvas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Perfect for:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 flex-shrink-0" />
                    <span>Building highly customized plans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 flex-shrink-0" />
                    <span>Using your own templates</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 group-hover:gap-3 transition-all"
                    size="lg"
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      "Creating..."
                    ) : (
                      <>
                        Start Blank <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (mode === "wizard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <SetupWizard onComplete={handleComplete} />
      </div>
    )
  }

  if (mode === "transcript") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50">
        <TranscriptWizard onComplete={handleTranscriptComplete} onBack={() => setMode("choice")} />
      </div>
    )
  }

  return null
}

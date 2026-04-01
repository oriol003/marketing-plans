"use client"

import { useEffect, useState } from "react"
import { usePlanStore } from "@/lib/store"
import { PlanEditor } from "@/components/plan-editor"
import { PlanOutline } from "@/components/plan-outline"
import { ReferencesPanel } from "@/components/references-panel"
import { PlanSettings } from "@/components/plan-settings"
import { ShareDialog } from "@/components/share-dialog"
import { ReferenceAnalyzer } from "@/components/reference-analyzer"
import { PlanChatbot } from "@/components/plan-chatbot"
import type { MarketingPlan } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, List, ArrowLeft, Save, BookOpen, Settings, Search, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function PlanEditorWrapper({ plan }: { plan: MarketingPlan }) {
  const { setCurrentPlan, currentPlan } = usePlanStore()
  const [activeTab, setActiveTab] = useState("editor")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    try {
      setCurrentPlan(plan)
      setError(null)
    } catch (err) {
      console.error("[v0] Error setting current plan:", err)
      setError(err instanceof Error ? err.message : "Failed to load plan")
    }
  }, [plan, setCurrentPlan])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Plan</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push("/plans")}>Return to Plans</Button>
        </div>
      </div>
    )
  }

  const handleSavePlan = async () => {
    if (!currentPlan) return

    console.log("[v0] handleSavePlan - Current plan blocks:", currentPlan.blocks.length)
    console.log("[v0] handleSavePlan - Current version:", currentPlan.version)

    setIsSaving(true)
    try {
      console.log("[v0] Sending save request with", currentPlan.blocks.length, "blocks")

      const response = await fetch(`/api/plans/${currentPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentPlan.title,
          objective: currentPlan.objective,
          clientName: currentPlan.clientName,
          logo: currentPlan.logo,
          version: currentPlan.version,
          blocks: currentPlan.blocks,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Save failed:", errorData)

        if (errorData.error?.includes("CONFLICT")) {
          toast({
            title: "Conflict Detected",
            description: "This plan was modified in another tab. Refreshing to get the latest version...",
            variant: "destructive",
          })
          setTimeout(() => {
            window.location.reload()
          }, 2000)
          return
        }

        throw new Error(errorData.error || "Failed to save plan")
      }

      const { plan: savedPlan } = await response.json()
      console.log("[v0] Save successful! Saved plan has", savedPlan.blocks.length, "blocks")
      console.log("[v0] New version:", savedPlan.version)

      setCurrentPlan(savedPlan)

      toast({
        title: "Plan saved",
        description: "Your changes have been saved successfully.",
      })

      router.refresh()
    } catch (error) {
      console.error("Error saving plan:", error)

      if (error instanceof Error && !error.message.includes("CONFLICT")) {
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Failed to save your changes. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/plans")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Plans
            </Button>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="border-l pl-4">
              <TabsList className="bg-transparent h-10">
                <TabsTrigger value="outline" className="gap-2">
                  <List className="w-4 h-4" />
                  Outline
                </TabsTrigger>
                <TabsTrigger value="editor" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="references" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  References
                </TabsTrigger>
                <TabsTrigger value="analyze" className="gap-2">
                  <Search className="w-4 h-4" />
                  Analyze
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <ShareDialog planId={plan.id} />
            <Button onClick={handleSavePlan} disabled={isSaving} size="sm" className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsContent value="outline" className="h-full m-0 overflow-y-auto">
            <PlanOutline />
          </TabsContent>
          <TabsContent value="editor" className="h-full m-0">
            <PlanEditor />
          </TabsContent>
          <TabsContent value="references" className="h-full m-0 overflow-y-auto">
            <ReferencesPanel planId={plan.id} />
          </TabsContent>
          <TabsContent value="analyze" className="h-full m-0 overflow-y-auto">
            <ReferenceAnalyzer planId={plan.id} />
          </TabsContent>
          <TabsContent value="settings" className="h-full m-0 overflow-y-auto">
            <PlanSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 z-40"
        size="icon"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </Button>

      {/* Chatbot Sidebar */}
      <PlanChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}

"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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
import { FileText, List, ArrowLeft, Save, BookOpen, Settings, Search, MessageSquare, Check, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function PlanEditorWrapper({ plan }: { plan: MarketingPlan }) {
  const { setCurrentPlan, currentPlan } = usePlanStore()
  const [activeTab, setActiveTab] = useState("editor")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const autoSaveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      initialBlocksRef.current = JSON.stringify(savedPlan.blocks)

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

  // ─── Debounced auto-save: saves 3s after last block change ───
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialBlocksRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)

  // Capture initial blocks snapshot so we don't auto-save on mount
  useEffect(() => {
    if (currentPlan && initialBlocksRef.current === null) {
      initialBlocksRef.current = JSON.stringify(currentPlan.blocks)
    }
  }, [currentPlan])

  const autoSave = useCallback(async () => {
    if (!currentPlan || isSavingRef.current) return
    isSavingRef.current = true
    setIsSaving(true)
    setAutoSaveStatus("saving")
    try {
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
      if (response.ok) {
        const { plan: savedPlan } = await response.json()
        setCurrentPlan(savedPlan)
        initialBlocksRef.current = JSON.stringify(savedPlan.blocks)
        setAutoSaveStatus("saved")
        // Clear "saved" after 3s
        if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current)
        autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 3000)
        console.log("[auto-save] Saved successfully, version:", savedPlan.version)
      } else {
        console.error("[auto-save] Failed:", response.status)
        setAutoSaveStatus("error")
      }
    } catch (err) {
      console.error("[auto-save] Error:", err)
      setAutoSaveStatus("error")
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [currentPlan, setCurrentPlan])

  useEffect(() => {
    if (!currentPlan || initialBlocksRef.current === null) return
    const currentSnapshot = JSON.stringify(currentPlan.blocks)
    if (currentSnapshot === initialBlocksRef.current) return

    // Blocks changed — schedule auto-save
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave()
    }, 3000)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [currentPlan?.blocks, autoSave])

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b bg-[#1a1d21]">
        <div className="flex items-center h-12 px-3 gap-3">
          {/* Left: Logo + Back */}
          <div className="flex items-center gap-3 shrink-0">
            <Image src="/logo-codesm.svg" alt="code[SM]" width={90} height={19} className="h-[19px] w-auto" />
            <Button variant="ghost" size="sm" onClick={() => router.push("/plans")} className="gap-1.5 text-xs h-8 px-2 text-[#9a9da1] hover:text-white hover:bg-[#222529]">
              <ArrowLeft className="w-3.5 h-3.5" />
              Plans
            </Button>
          </div>

          {/* Center: Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex justify-center">
            <TabsList className="bg-[#222529] h-9 border-0">
              <TabsTrigger value="outline" className="gap-1.5 text-xs h-7 px-3 text-[#9a9da1] data-[state=active]:bg-[#2a2d31] data-[state=active]:text-white">
                <List className="w-3.5 h-3.5" />
                Outline
              </TabsTrigger>
              <TabsTrigger value="editor" className="gap-1.5 text-xs h-7 px-3 text-[#9a9da1] data-[state=active]:bg-[#2a2d31] data-[state=active]:text-white">
                <FileText className="w-3.5 h-3.5" />
                Editor
              </TabsTrigger>
              <TabsTrigger value="references" className="gap-1.5 text-xs h-7 px-3 text-[#9a9da1] data-[state=active]:bg-[#2a2d31] data-[state=active]:text-white">
                <BookOpen className="w-3.5 h-3.5" />
                References
              </TabsTrigger>
              <TabsTrigger value="analyze" className="gap-1.5 text-xs h-7 px-3 text-[#9a9da1] data-[state=active]:bg-[#2a2d31] data-[state=active]:text-white">
                <Search className="w-3.5 h-3.5" />
                Analyze
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs h-7 px-3 text-[#9a9da1] data-[state=active]:bg-[#2a2d31] data-[state=active]:text-white">
                <Settings className="w-3.5 h-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right: Auto-save status + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Auto-save indicator */}
            <span className="text-xs flex items-center gap-1.5">
              {autoSaveStatus === "saving" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#9a9da1]" />
                  <span className="text-[#9a9da1]">Saving...</span>
                </>
              )}
              {autoSaveStatus === "saved" && (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Saved</span>
                </>
              )}
              {autoSaveStatus === "error" && (
                <span className="text-red-400">Save failed</span>
              )}
            </span>
            <ShareDialog planId={plan.id} />
            <Button onClick={handleSavePlan} disabled={isSaving} size="sm" className="gap-1.5 h-8 text-xs bg-[#2a2d31] text-white hover:bg-[#363a3f] border-0">
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save"}
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

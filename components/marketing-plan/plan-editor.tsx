"use client"

import { useState, useEffect } from "react"
import { Block, PlanType, WizardData } from "@/types/marketing-plan"
import { BlockEditor } from "./block-editor"
import { Button } from "@/components/ui/button"
import { Plus, Download, LayoutTemplate } from 'lucide-react'
import { generateBlockContent } from "@/app/actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"

interface PlanEditorProps {
  initialPlan: PlanType
}

export function PlanEditor({ initialPlan }: PlanEditorProps) {
  const [plan, setPlan] = useState<PlanType>(initialPlan)
  const [activeTab, setActiveTab] = useState("edit")

  // Auto-generate content for empty blocks on mount
  useEffect(() => {
    const generateEmptyBlocks = async () => {
      const emptyBlocks = plan.blocks.filter((b) => !b.content && !b.isGenerating)
      
      if (emptyBlocks.length === 0) return

      // Mark as generating
      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => 
          emptyBlocks.find((eb) => eb.id === b.id) ? { ...b, isGenerating: true } : b
        ),
      }))

      // Generate in parallel
      await Promise.all(
        emptyBlocks.map(async (block) => {
          try {
            const content = await generateBlockContent(block.title, "Generate content based on plan context", {
              clientName: plan.clientName,
              goals: plan.goals,
              audience: plan.audience,
              previousBlocks: plan.blocks.slice(0, plan.blocks.indexOf(block)).map(b => ({ title: b.title, content: b.content }))
            })
            
            setPlan((prev) => ({
              ...prev,
              blocks: prev.blocks.map((b) => (b.id === block.id ? { ...b, content, isGenerating: false } : b)),
            }))
          } catch (error) {
            console.error("Failed to generate block content", error)
            setPlan((prev) => ({
              ...prev,
              blocks: prev.blocks.map((b) => (b.id === block.id ? { ...b, isGenerating: false } : b)),
            }))
          }
        })
      )
    }

    generateEmptyBlocks()
  }, []) // Run once on mount

  const handleUpdateBlock = (id: string, updates: Partial<Block>) => {
    setPlan((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }))
  }

  const handleDeleteBlock = (id: string) => {
    setPlan((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }))
  }

  const handleAddBlock = (type: "text" | "tactic") => {
    const newBlock: Block = {
      id: Math.random().toString(36).substring(7),
      type,
      title: type === "text" ? "New Section" : "New Tactic",
      content: "",
      tacticData: type === "tactic" ? { hours: 0 } : undefined,
    }
    setPlan((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }))
  }

  const handleRegenerateBlock = async (id: string) => {
    const block = plan.blocks.find((b) => b.id === id)
    if (!block) return

    setPlan((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, isGenerating: true } : b)),
    }))

    try {
      const content = await generateBlockContent(block.title, "Regenerate this section", {
        clientName: plan.clientName,
        goals: plan.goals,
        audience: plan.audience,
        previousBlocks: plan.blocks.slice(0, plan.blocks.indexOf(block)).map(b => ({ title: b.title, content: b.content }))
      })

      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? { ...b, content, isGenerating: false } : b)),
      }))
    } catch (error) {
      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? { ...b, isGenerating: false } : b)),
      }))
    }
  }

  const totalHours = plan.blocks.reduce((sum, block) => sum + (block.tacticData?.hours || 0), 0)

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{plan.clientName}</h1>
          <p className="text-muted-foreground">Marketing Plan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="edit">Edit Plan</TabsTrigger>
          <TabsTrigger value="timeline">Timeline & Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-8">
          <div className="space-y-4">
            {plan.blocks.map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                onUpdate={handleUpdateBlock}
                onDelete={handleDeleteBlock}
                onRegenerate={handleRegenerateBlock}
              />
            ))}
          </div>

          <div className="flex justify-center gap-4 py-8 border-t border-dashed">
            <Button variant="outline" onClick={() => handleAddBlock("text")}>
              <Plus className="mr-2 h-4 w-4" /> Add Text Section
            </Button>
            <Button variant="outline" onClick={() => handleAddBlock("tactic")}>
              <LayoutTemplate className="mr-2 h-4 w-4" /> Add Tactic
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalHours} Hours</div>
                <p className="text-muted-foreground">Total Estimated Production Time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Production Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plan.blocks
                    .filter((b) => b.type === "tactic" && b.tacticData?.productionStartDate)
                    .sort((a, b) => 
                      new Date(a.tacticData!.productionStartDate!).getTime() - 
                      new Date(b.tacticData!.productionStartDate!).getTime()
                    )
                    .map((block) => (
                      <div key={block.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="font-medium">{block.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {block.tacticData?.hours}h
                          </div>
                        </div>
                        <div className="text-sm">
                          {block.tacticData?.productionStartDate && format(new Date(block.tacticData.productionStartDate), "MMM d")} 
                          {" - "}
                          {block.tacticData?.productionEndDate && format(new Date(block.tacticData.productionEndDate), "MMM d")}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

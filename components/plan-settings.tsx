"use client"

import type React from "react"

import { useState, useRef } from "react"
import { usePlanStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Upload, X, ImageIcon, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function PlanSettings() {
  const { currentPlan, updatePlan } = usePlanStore()
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startDate, setStartDate] = useState(currentPlan?.startDate || "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  if (!currentPlan) {
    return (
      <div className="container mx-auto py-12 px-4">
        <p className="text-muted-foreground">No plan loaded</p>
      </div>
    )
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, SVG, etc.)",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

      const { url } = await response.json()

      updatePlan({
        ...currentPlan,
        logo: url,
      })

      toast({
        title: "Logo uploaded",
        description: "Customer logo has been updated successfully.",
      })
    } catch (error) {
      console.error("Error uploading logo:", error)
      toast({
        title: "Upload failed",
        description: "Failed to upload the logo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleRemoveLogo = () => {
    updatePlan({
      ...currentPlan,
      logo: undefined,
    })
    toast({
      title: "Logo removed",
      description: "Customer logo has been removed.",
    })
  }

  const handleStartDateChange = async (newStartDate: string) => {
    if (!newStartDate) {
      setStartDate("")
      return
    }

    const findEarliestDate = (blocks: typeof currentPlan.blocks): string | null => {
      let earliest: string | null = null

      for (const block of blocks) {
        if (block.type === "tactic" && block.startDate) {
          if (!earliest || new Date(block.startDate) < new Date(earliest)) {
            earliest = block.startDate
          }
        }
        if (block.children) {
          const childEarliest = findEarliestDate(block.children)
          if (childEarliest && (!earliest || new Date(childEarliest) < new Date(earliest))) {
            earliest = childEarliest
          }
        }
      }

      return earliest
    }

    const earliestDate = findEarliestDate(currentPlan.blocks)

    if (!earliestDate) {
      setStartDate(newStartDate)
      updatePlan({
        ...currentPlan,
        startDate: newStartDate,
      })

      toast({
        title: "Start date updated",
        description: "Plan start date has been set.",
      })
      return
    }

    const earliestDateObj = new Date(earliestDate)
    const newStartDateObj = new Date(newStartDate)
    const daysDiff = Math.floor((newStartDateObj.getTime() - earliestDateObj.getTime()) / (1000 * 60 * 60 * 24))

    const adjustDates = (blocks: typeof currentPlan.blocks): typeof currentPlan.blocks => {
      return blocks.map((block) => {
        if (block.type === "tactic" && block.startDate) {
          const oldStart = new Date(block.startDate)
          const oldEnd = new Date(block.endDate)

          const newStart = new Date(oldStart)
          newStart.setDate(oldStart.getDate() + daysDiff)

          const newEnd = new Date(oldEnd)
          newEnd.setDate(oldEnd.getDate() + daysDiff)

          return {
            ...block,
            startDate: newStart.toISOString().split("T")[0],
            endDate: newEnd.toISOString().split("T")[0],
          }
        }

        if (block.children) {
          return {
            ...block,
            children: adjustDates(block.children),
          }
        }

        return block
      })
    }

    const updatedBlocks = adjustDates(currentPlan.blocks)

    setStartDate(newStartDate)
    updatePlan({
      ...currentPlan,
      startDate: newStartDate,
      blocks: updatedBlocks,
    })

    toast({
      title: "Dates adjusted",
      description: `All tactic dates have been shifted by ${Math.abs(daysDiff)} days to align with the new start date.`,
    })
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plan Settings</h2>
          <p className="text-muted-foreground mt-2">Customize your marketing plan settings and branding</p>
        </div>

        {/* Plan Start Date Section */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="startDate" className="text-base font-semibold">
              Plan Start Date
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Set the start date for your marketing plan. All tactic dates will adjust relative to this date.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="pl-10"
              />
            </div>
            {startDate && (
              <Button variant="ghost" size="sm" onClick={() => handleStartDateChange("")} className="gap-2">
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Customer Logo Section */}
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label className="text-base font-semibold">Customer Logo</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your customer's logo to display on the plan cover and exports
            </p>
          </div>

          {currentPlan.logo ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-6 bg-slate-50 flex items-center justify-center">
                <img
                  src={currentPlan.logo || "/placeholder.svg"}
                  alt="Customer logo"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Replace Logo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRemoveLogo}
                  className="gap-2 text-destructive hover:text-destructive bg-transparent"
                >
                  <X className="w-4 h-4" />
                  Remove Logo
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{isDragging ? "Drop logo here" : "Drag and drop logo here"}</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, SVG up to 5MB</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {isUploading ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
        </div>

        {/* Future settings can be added here */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">More settings options coming soon...</p>
        </div>
      </div>
    </div>
  )
}

"use client"

import type React from "react"

import { useMemo, useState, useEffect } from "react"
import type { TimelineBlock as TimelineBlockType } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Calendar } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { format, parseISO, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, addDays } from "date-fns"

// Added client plan types and configuration
type ClientPlan = "custom" | "20" | "40" | "60" | "80"

interface ClientPlanConfig {
  label: string
  hoursPerMonth: number | null
}

const CLIENT_PLANS: Record<ClientPlan, ClientPlanConfig> = {
  custom: { label: "Custom (No Limit)", hoursPerMonth: null },
  "20": { label: "20 Hours/Month Plan", hoursPerMonth: 20 },
  "40": { label: "40 Hours/Month Plan", hoursPerMonth: 40 },
  "60": { label: "60 Hours/Month Plan", hoursPerMonth: 60 },
  "80": { label: "80 Hours/Month Plan", hoursPerMonth: 80 },
}

interface TimelineBlockProps {
  block: TimelineBlockType
  dragHandleProps?: any
}

function flattenTactics(blocks: any[]): any[] {
  const tactics: any[] = []

  function traverse(blockList: any[]) {
    blockList.forEach((block) => {
      if (block.type === "tactic") {
        tactics.push(block)
      }
      if (block.children && block.children.length > 0) {
        traverse(block.children)
      }
    })
  }

  traverse(blocks)
  return tactics
}

export function TimelineBlock({ block, dragHandleProps }: TimelineBlockProps) {
  const { currentPlan, deleteBlock, updateBlock } = usePlanStore()
  const [dragState, setDragState] = useState<{
    tacticId: string | null
    edge: "start" | "end" | "move" | null
    originalLeft: number
    originalWidth: number
    startX: number
  } | null>(null)

  const timelineData = useMemo(() => {
    if (!currentPlan)
      return { tactics: [], startDate: null, endDate: null, totalDays: 0, months: [], groupedTactics: [] }

    const tactics = flattenTactics(currentPlan.blocks)
    if (tactics.length === 0)
      return { tactics: [], startDate: null, endDate: null, totalDays: 0, months: [], groupedTactics: [] }

    const dates = tactics.flatMap((t) => [parseISO(t.startDate), parseISO(t.endDate)])

    const startDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const endDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    const totalDays = differenceInDays(endDate, startDate) + 1

    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    const groupedTactics: Array<{ sectionTitle: string; sectionIcon: string; tactics: any[] }> = []

    currentPlan.blocks.forEach((block) => {
      if (block.type === "section" && block.children && block.children.length > 0) {
        const sectionTactics = block.children
          .filter((child: any) => child.type === "tactic")
          .map((tactic: any) => ({
            id: tactic.id,
            title: tactic.title,
            startDate: parseISO(tactic.startDate),
            endDate: parseISO(tactic.endDate),
            icon: tactic.icon || "Package",
            hours: tactic.hours || 0,
          }))

        if (sectionTactics.length > 0) {
          groupedTactics.push({
            sectionTitle: block.title,
            sectionIcon: block.icon || "Folder",
            tactics: sectionTactics,
          })
        }
      }
    })

    return {
      tactics: tactics.map((t) => ({
        id: t.id,
        title: t.title,
        startDate: parseISO(t.startDate),
        endDate: parseISO(t.endDate),
        icon: t.icon || "Package",
        hours: t.hours || 0,
      })),
      startDate,
      endDate,
      totalDays,
      months,
      groupedTactics, // New grouped structure
    }
  }, [currentPlan])

  const getBarPosition = (tacticStart: Date, tacticEnd: Date) => {
    if (!timelineData.startDate || timelineData.totalDays === 0) return { left: 0, width: 100 }

    const daysFromStart = differenceInDays(tacticStart, timelineData.startDate)
    const tacticDuration = differenceInDays(tacticEnd, tacticStart) + 1

    const left = (daysFromStart / timelineData.totalDays) * 100
    const width = (tacticDuration / timelineData.totalDays) * 100

    return { left: Math.max(0, left), width: Math.max(1, width) }
  }

  const getMonthWidth = (month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
    return (daysInMonth / timelineData.totalDays) * 100
  }

  const handleMouseDown = (
    e: React.MouseEvent,
    tacticId: string,
    edge: "start" | "end" | "move",
    left: number,
    width: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    setDragState({
      tacticId,
      edge,
      originalLeft: left,
      originalWidth: width,
      startX: e.clientX,
    })
  }

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !timelineData.startDate) return

      const containerWidth = e.currentTarget ? (e.currentTarget as any).innerWidth : window.innerWidth
      const deltaX = e.clientX - dragState.startX
      const deltaPercent = (deltaX / (containerWidth * 0.6)) * 100 // Approximate timeline width
      const deltaDays = Math.round((deltaPercent / 100) * timelineData.totalDays)

      const tactic = timelineData.tactics.find((t) => t.id === dragState.tacticId)
      if (!tactic) return

      let newStartDate = tactic.startDate
      let newEndDate = tactic.endDate

      if (dragState.edge === "start") {
        newStartDate = addDays(tactic.startDate, deltaDays)
        if (newStartDate >= tactic.endDate) {
          newStartDate = addDays(tactic.endDate, -1)
        }
      } else if (dragState.edge === "end") {
        newEndDate = addDays(tactic.endDate, deltaDays)
        if (newEndDate <= tactic.startDate) {
          newEndDate = addDays(tactic.startDate, 1)
        }
      } else if (dragState.edge === "move") {
        newStartDate = addDays(tactic.startDate, deltaDays)
        newEndDate = addDays(tactic.endDate, deltaDays)
      }

      const newDuration = differenceInDays(newEndDate, newStartDate) + 1

      updateBlock(dragState.tacticId, {
        startDate: format(newStartDate, "yyyy-MM-dd"),
        endDate: format(newEndDate, "yyyy-MM-dd"),
        duration: newDuration,
      })
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragState, timelineData, updateBlock])

  return (
    <Card className="group relative border-l-4 border-l-accent hover:shadow-md transition-all">
      <div className="hidden" {...dragHandleProps} />

      <CardHeader className="pb-3 pl-12 pr-4 pt-6 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-xl">{block.title}</h3>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteBlock(block.id)}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pl-12 pr-4 pb-6">
        {timelineData.tactics.length > 0 ? (
          <div className="space-y-4">
            <div className="flex border-b pb-3">
              <div className="w-48 flex-shrink-0 text-sm font-medium text-muted-foreground">Tactic</div>
              <div className="flex-1 flex">
                {timelineData.months.map((month, idx) => (
                  <div
                    key={idx}
                    className="text-center text-sm font-medium border-l px-2 py-1"
                    style={{ width: `${getMonthWidth(month)}%` }}
                  >
                    <div className="text-foreground">{format(month, "MMM")}</div>
                    <div className="text-xs text-muted-foreground">{format(month, "yyyy")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {timelineData.groupedTactics.map((group, groupIndex) => {
                const SectionIcon = (LucideIcons as any)[group.sectionIcon] || LucideIcons.Folder

                return (
                  <div key={groupIndex} className="space-y-2">
                    {/* Section Header */}
                    <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-md border-l-4 border-primary">
                      <SectionIcon className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{group.sectionTitle}</span>
                    </div>

                    {/* Tactics in this section */}
                    {group.tactics.map((tactic) => {
                      const IconComponent = (LucideIcons as any)[tactic.icon] || LucideIcons.Package
                      const { left, width } = getBarPosition(tactic.startDate, tactic.endDate)
                      const duration = differenceInDays(tactic.endDate, tactic.startDate) + 1

                      return (
                        <div key={tactic.id} className="flex items-center min-h-[48px]">
                          <div className="w-48 flex-shrink-0 flex items-center gap-2 pr-4">
                            <div className="p-1.5 rounded bg-primary/10 text-primary flex-shrink-0">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{tactic.title}</div>
                              <div className="text-xs text-muted-foreground">{tactic.hours}h</div>
                            </div>
                          </div>

                          <div className="flex-1 relative">
                            <div className="absolute inset-0 flex">
                              {timelineData.months.map((month, idx) => (
                                <div
                                  key={idx}
                                  className="border-l h-full"
                                  style={{ width: `${getMonthWidth(month)}%` }}
                                />
                              ))}
                            </div>

                            <div className="relative h-full flex items-center py-2">
                              <div
                                className="absolute h-8 bg-gradient-to-r from-primary/90 to-primary rounded shadow-sm flex items-center px-3 transition-all hover:shadow-md cursor-move group/bar"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  minWidth: "60px",
                                }}
                                onMouseDown={(e) => handleMouseDown(e, tactic.id, "move", left, width)}
                              >
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-primary-foreground/20 transition-opacity"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    handleMouseDown(e, tactic.id, "start", left, width)
                                  }}
                                />

                                <span className="text-xs font-medium text-primary-foreground truncate pointer-events-none">
                                  {duration}d
                                </span>

                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-primary-foreground/20 transition-opacity"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    handleMouseDown(e, tactic.id, "end", left, width)
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div className="border-t pt-3 flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(timelineData.startDate!, "MMM dd, yyyy")} → {format(timelineData.endDate!, "MMM dd, yyyy")}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">{timelineData.tactics.length}</span> tactics ·
                <span className="font-medium text-foreground ml-1">{timelineData.totalDays}</span> days
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No tactics added yet. Add tactics with dates to see the timeline.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

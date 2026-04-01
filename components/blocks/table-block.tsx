"use client"

import React, { useMemo, useState } from "react"
import type { TableBlock as TableBlockType, TacticBlock } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Clock, TableIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TableBlockProps {
  block: TableBlockType
  dragHandleProps?: any
}

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

function distributeHoursAcrossMonths(tactic: TacticBlock): Record<string, number> {
  const startDate = new Date(tactic.startDate)
  const endDate = new Date(tactic.endDate)
  const totalHours = tactic.hours || 0

  // Calculate the number of days the tactic spans
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  // Generate all months covered by this tactic
  const monthlyHours: Record<string, number> = {}
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

    // Calculate days in this month that fall within the tactic's date range
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const rangeStart =
      currentDate.getTime() === startDate.getTime() ? startDate : monthStart > startDate ? monthStart : startDate
    const rangeEnd = monthEnd < endDate ? monthEnd : endDate

    const daysInMonth = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Distribute hours proportionally
    monthlyHours[monthKey] = (daysInMonth / totalDays) * totalHours

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1)
    currentDate.setDate(1)
  }

  return monthlyHours
}

export function TableBlock({ block, dragHandleProps }: TableBlockProps) {
  const { currentPlan, deleteBlock, updateBlock } = usePlanStore()
  const [editingCell, setEditingCell] = useState<{ tacticId: string; month: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [clientPlan, setClientPlan] = useState<ClientPlan>("custom")

  const tacticData = useMemo(() => {
    if (!currentPlan) return { tactics: [], months: [], totalHours: 0, groupedTactics: [] }

    const flattenBlocks = (blocks: any[]): any[] => {
      const flat: any[] = []
      blocks.forEach((block) => {
        flat.push(block)
        if (block.children && block.children.length > 0) {
          flat.push(...flattenBlocks(block.children))
        }
      })
      return flat
    }

    const allBlocks = flattenBlocks(currentPlan.blocks)
    const tactics = allBlocks.filter((b) => b.type === "tactic") as TacticBlock[]

    const monthsSet = new Set<string>()
    const groupedTactics: Array<{ sectionTitle: string; sectionIcon: string; tactics: any[] }> = []

    currentPlan.blocks.forEach((block) => {
      if (block.type === "section" && block.children && block.children.length > 0) {
        const sectionTactics = block.children
          .filter((child: any) => child.type === "tactic")
          .map((tactic: any) => {
            const monthlyHours = distributeHoursAcrossMonths(tactic)
            Object.keys(monthlyHours).forEach((month) => monthsSet.add(month))

            return {
              id: tactic.id,
              title: tactic.title,
              icon: tactic.icon || "Package",
              monthlyHours,
              totalHours: tactic.hours || 0,
            }
          })

        if (sectionTactics.length > 0) {
          groupedTactics.push({
            sectionTitle: block.title,
            sectionIcon: block.icon || "Folder",
            tactics: sectionTactics,
          })
        }
      }
    })

    const months = Array.from(monthsSet).sort()

    const monthlyTotals: Record<string, number> = {}
    months.forEach((month) => {
      monthlyTotals[month] = groupedTactics.reduce((sum, group) => {
        return (
          sum +
          group.tactics.reduce((tacticSum, tactic) => {
            return tacticSum + (tactic.monthlyHours[month] || 0)
          }, 0)
        )
      }, 0)
    })

    const totalHours = tactics.reduce((sum, tactic) => sum + (tactic.hours || 0), 0)

    return {
      tactics: groupedTactics.flatMap((g) => g.tactics), // Flat list for backward compatibility
      months,
      monthlyTotals,
      totalHours,
      groupedTactics, // New grouped structure
    }
  }, [currentPlan])

  const handleCellClick = (tacticId: string, month: string, currentValue: number) => {
    setEditingCell({ tacticId, month })
    setEditValue(String(Math.round(currentValue)))
  }

  const handleCellBlur = () => {
    if (!editingCell || !currentPlan) {
      setEditingCell(null)
      return
    }

    const flattenBlocks = (blocks: any[]): any[] => {
      const flat: any[] = []
      blocks.forEach((block) => {
        flat.push(block)
        if (block.children && block.children.length > 0) {
          flat.push(...flattenBlocks(block.children))
        }
      })
      return flat
    }

    const allBlocks = flattenBlocks(currentPlan.blocks)
    const tactic = allBlocks.find((b) => b.id === editingCell.tacticId && b.type === "tactic") as TacticBlock

    if (!tactic) {
      setEditingCell(null)
      return
    }

    const newHours = Number.parseInt(editValue) || 0

    updateBlock(editingCell.tacticId, {
      hours: newHours,
    })

    setEditingCell(null)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellBlur()
    } else if (e.key === "Escape") {
      setEditingCell(null)
    }
  }

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-")
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, 1)
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }

  const autoDistributeHours = () => {
    const planConfig = CLIENT_PLANS[clientPlan]
    if (!planConfig.hoursPerMonth || !currentPlan) return

    const hoursPerMonth = planConfig.hoursPerMonth
    const flattenBlocks = (blocks: any[]): any[] => {
      const flat: any[] = []
      blocks.forEach((block) => {
        flat.push(block)
        if (block.children && block.children.length > 0) {
          flat.push(...flattenBlocks(block.children))
        }
      })
      return flat
    }

    const allBlocks = flattenBlocks(currentPlan.blocks)
    const tactics = allBlocks.filter((b) => b.type === "tactic") as TacticBlock[]

    tactics.forEach((tactic) => {
      const monthlyHours = distributeHoursAcrossMonths(tactic)
      const months = Object.keys(monthlyHours)

      if (months.length === 0) return

      const targetPerMonth = Math.min(hoursPerMonth, Math.floor(tactic.hours / months.length))

      const totalAllocated = targetPerMonth * months.length

      if (totalAllocated !== tactic.hours) {
        const newHours = targetPerMonth * months.length
        updateBlock(tactic.id, { hours: newHours })
      }
    })
  }

  return (
    <Card className="group relative border-l-4 border-l-accent hover:shadow-md transition-all">
      <div className="hidden" {...dragHandleProps} />

      <CardHeader className="pb-2 pl-12 pr-4 pt-4 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <TableIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-lg">{block.title}</h3>
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

      <CardContent className="pl-12 pr-4 pb-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <div className="text-sm text-muted-foreground">Production hours summary by month</div>
          <div className="flex items-center gap-2">
            <Select value={clientPlan} onValueChange={(value: ClientPlan) => setClientPlan(value)}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_PLANS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientPlan !== "custom" && (
              <Button size="sm" variant="outline" onClick={autoDistributeHours} className="h-9 bg-transparent">
                Auto-Distribute
              </Button>
            )}
          </div>
        </div>

        {clientPlan !== "custom" && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <strong>Plan Limit:</strong> {CLIENT_PLANS[clientPlan].hoursPerMonth} hours per month maximum. Click
            "Auto-Distribute" to evenly allocate hours within plan limits.
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="min-w-[200px]">Tactic</TableHead>
                {tacticData.months.map((month) => (
                  <TableHead key={month} className="text-right min-w-[100px]">
                    {formatMonth(month)}
                  </TableHead>
                ))}
                <TableHead className="text-right font-semibold min-w-[100px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tacticData.groupedTactics.map((group, groupIndex) => {
                const SectionIcon = (LucideIcons as any)[group.sectionIcon] || LucideIcons.Folder

                return (
                  <React.Fragment key={groupIndex}>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={2 + tacticData.months.length + 1} className="py-3">
                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                          <SectionIcon className="w-4 h-4 text-primary" />
                          {group.sectionTitle}
                        </div>
                      </TableCell>
                    </TableRow>

                    {group.tactics.map((tactic) => {
                      const IconComponent = (LucideIcons as any)[tactic.icon] || LucideIcons.Package

                      return (
                        <TableRow key={tactic.id}>
                          <TableCell>
                            <div className="p-1.5 rounded bg-primary/10 text-primary w-fit">
                              <IconComponent className="w-4 h-4" />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{tactic.title}</TableCell>
                          {tacticData.months.map((month) => (
                            <TableCell key={month} className="text-right">
                              {tactic.monthlyHours[month] ? `${Math.round(tactic.monthlyHours[month])}h` : "-"}
                            </TableCell>
                          ))}
                          <TableCell
                            className="text-right font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleCellClick(tactic.id, "total", tactic.totalHours)}
                          >
                            {editingCell?.tacticId === tactic.id && editingCell?.month === "total" ? (
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleCellKeyDown}
                                className="h-8 w-20 text-right"
                                autoFocus
                              />
                            ) : (
                              `${tactic.totalHours}h`
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </React.Fragment>
                )
              })}

              <TableRow className="bg-muted/50 font-semibold">
                <TableCell></TableCell>
                <TableCell>Total Production Hours</TableCell>
                {tacticData.months.map((month) => (
                  <TableCell key={month} className="text-right">
                    {Math.round(tacticData.monthlyTotals[month])}h
                  </TableCell>
                ))}
                <TableCell className="text-right flex items-center justify-end gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {tacticData.totalHours}h
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {tacticData.tactics.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No tactics added yet. Add tactics to see the hours summary.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import React, { useMemo, useState } from "react"
import type { TableBlock as TableBlockType, TacticBlock } from "@/lib/types"
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

  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  const monthly: Array<{ key: string; days: number }> = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const rangeStart = monthStart < startDate ? startDate : monthStart
    const rangeEnd = monthEnd > endDate ? endDate : monthEnd
    const daysInMonth = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    monthly.push({ key: monthKey, days: daysInMonth })
    currentDate.setMonth(currentDate.getMonth() + 1)
    currentDate.setDate(1)
  }

  // Smart rounding: largest remainder method to preserve total
  const rawShares = monthly.map(m => (m.days / totalDays) * totalHours)
  const floored = rawShares.map(v => Math.floor(v))
  let remainder = totalHours - floored.reduce((s, v) => s + v, 0)

  const indexed = rawShares.map((v, i) => ({ i, frac: v - Math.floor(v) }))
  indexed.sort((a, b) => b.frac - a.frac)
  for (const item of indexed) {
    if (remainder <= 0) break
    floored[item.i] += 1
    remainder -= 1
  }

  const monthlyHours: Record<string, number> = {}
  monthly.forEach((m, i) => { monthlyHours[m.key] = floored[i] })
  return monthlyHours
}

export function TableBlock({ block, dragHandleProps }: TableBlockProps) {
  const { currentPlan, deleteBlock, updateBlock } = usePlanStore()
  const [editingCell, setEditingCell] = useState<{ tacticId: string; month: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [clientPlan, setClientPlan] = useState<ClientPlan>("custom")

  const tacticData = useMemo(() => {
    if (!currentPlan) return { tactics: [], months: [], totalHours: 0, groupedTactics: [], monthlyTotals: {} as Record<string, number> }

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
            const hasManualHours = tactic.hoursByMonth && Object.values(tactic.hoursByMonth).some((v: any) => v > 0)
            const monthlyHours = hasManualHours ? tactic.hoursByMonth : distributeHoursAcrossMonths(tactic)
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
      tactics: groupedTactics.flatMap((g) => g.tactics),
      months,
      monthlyTotals,
      totalHours,
      groupedTactics,
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
    updateBlock(editingCell.tacticId, { hours: newHours })
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
    <div className="relative group py-8 border-b border-border/30 last:border-b-0">
      <div className="hidden" {...dragHandleProps} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1DB5C4]/10">
            <TableIcon className="w-5 h-5 text-[#1DB5C4]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg text-[#2A3441]">{block.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Production hours summary by month</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={clientPlan} onValueChange={(value: ClientPlan) => setClientPlan(value)}>
            <SelectTrigger className="w-[180px] h-8 text-xs border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CLIENT_PLANS).map(([key, config]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientPlan !== "custom" && (
            <Button size="sm" variant="outline" onClick={autoDistributeHours} className="h-8 text-xs">
              Auto-Distribute
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteBlock(block.id)}
            className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {clientPlan !== "custom" && (
        <div className="mb-4 px-4 py-2.5 bg-[#1DB5C4]/5 border border-[#1DB5C4]/20 rounded-lg text-xs text-[#1DB5C4]">
          <strong>Plan Limit:</strong> {CLIENT_PLANS[clientPlan].hoursPerMonth} hours/month max. Click "Auto-Distribute" to allocate within limits.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-border/40 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[36px] py-2.5"></TableHead>
              <TableHead className="min-w-[180px] py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</TableHead>
              {tacticData.months.map((month) => (
                <TableHead key={month} className="text-center min-w-[70px] py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatMonth(month)}
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold min-w-[70px] py-2.5 text-xs uppercase tracking-wide text-[#2A3441]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tacticData.groupedTactics.map((group, groupIndex) => {
              const SectionIcon = (LucideIcons as any)[group.sectionIcon] || LucideIcons.Folder

              return (
                <React.Fragment key={groupIndex}>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 border-t border-border/30">
                    <TableCell colSpan={2 + tacticData.months.length + 1} className="py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#2A3441] uppercase tracking-wide">
                        <SectionIcon className="w-3.5 h-3.5 text-[#FF9500]" />
                        {group.sectionTitle}
                      </div>
                    </TableCell>
                  </TableRow>

                  {group.tactics.map((tactic) => {
                    const IconComponent = (LucideIcons as any)[tactic.icon] || LucideIcons.Package

                    return (
                      <TableRow key={tactic.id} className="hover:bg-muted/10">
                        <TableCell className="py-2">
                          <div className="w-6 h-6 rounded flex items-center justify-center bg-[#1DB5C4]/8">
                            <IconComponent className="w-3 h-3 text-[#1DB5C4]" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-[#2A3441] py-2">{tactic.title}</TableCell>
                        {tacticData.months.map((month) => (
                          <TableCell key={month} className="text-center text-sm py-2 text-muted-foreground">
                            {tactic.monthlyHours[month] ? (
                              <span className="text-foreground">{Math.round(tactic.monthlyHours[month])}</span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell
                          className="text-center font-semibold text-sm py-2 cursor-pointer hover:bg-muted/30 transition-colors text-[#2A3441]"
                          onClick={() => handleCellClick(tactic.id, "total", tactic.totalHours)}
                        >
                          {editingCell?.tacticId === tactic.id && editingCell?.month === "total" ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              className="h-7 w-16 text-center mx-auto text-sm"
                              autoFocus
                            />
                          ) : (
                            tactic.totalHours
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </React.Fragment>
              )
            })}

            {/* Totals row */}
            <TableRow className="bg-[#2A3441]/5 hover:bg-[#2A3441]/5 border-t-2 border-border/50">
              <TableCell></TableCell>
              <TableCell className="font-semibold text-sm text-[#2A3441] py-3">Total Hours</TableCell>
              {tacticData.months.map((month) => (
                <TableCell key={month} className="text-center font-semibold text-sm py-3 text-[#2A3441]">
                  {Math.round(tacticData.monthlyTotals[month])}
                </TableCell>
              ))}
              <TableCell className="text-center py-3">
                <div className="inline-flex items-center gap-1.5 font-bold text-sm text-[#1DB5C4]">
                  <Clock className="w-3.5 h-3.5" />
                  {tacticData.totalHours}h
                </div>
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
    </div>
  )
}

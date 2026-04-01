"use client"

import { useMemo } from "react"
import type { BudgetSummaryBlock as BudgetSummaryBlockType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Trash2, DollarSign } from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { formatMonthKey } from "@/lib/utils"

interface BudgetSummaryBlockProps {
  block: BudgetSummaryBlockType
  dragHandleProps?: any
  accentColor?: string
}

function flattenTactics(blocks: any[]): any[] {
  const tactics: any[] = []
  function traverse(blockList: any[]) {
    blockList.forEach((block) => {
      if (block.type === "tactic") tactics.push(block)
      if (block.children?.length > 0) traverse(block.children)
    })
  }
  traverse(blocks)
  return tactics
}

export function BudgetSummaryBlock({ block, dragHandleProps, accentColor = "#FF9500" }: BudgetSummaryBlockProps) {
  const { currentPlan, deleteBlock } = usePlanStore()

  const budgetData = useMemo(() => {
    if (!currentPlan) return { tactics: [], months: [], grandTotal: 0 }

    const tactics = flattenTactics(currentPlan.blocks)
    const budgetTactics = tactics.filter(
      (t) => t.budgetEnabled && (t.budgetMode === "fixed" || (!t.budgetMode && t.budgetByMonth))
    )

    // Collect all months across all tactics with monthly budgets
    const allMonths = new Set<string>()
    budgetTactics.forEach((t) => {
      if (t.budgetByMonth) {
        Object.keys(t.budgetByMonth).forEach((m) => allMonths.add(m))
      }
    })

    const months = [...allMonths].sort()

    // Also include scenario-budget tactics
    const scenarioTactics = tactics.filter(
      (t) => t.budgetEnabled && t.budgetMode === "scenario" && t.budgetTiers
    )

    // Build rows
    const rows: Array<{
      id: string
      title: string
      mode: "fixed" | "scenario"
      monthlyBudget?: Record<string, number>
      tiers?: Record<string, { amount: number; scope: string }>
      total: number
    }> = []

    budgetTactics.forEach((t) => {
      const monthly = t.budgetByMonth || {}
      const total = Object.values(monthly).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0)
      rows.push({
        id: t.id,
        title: t.title,
        mode: "fixed",
        monthlyBudget: monthly,
        total,
      })
    })

    scenarioTactics.forEach((t) => {
      const rec = t.budgetTiers?.recommended || t.budgetTiers?.minimum
      rows.push({
        id: t.id,
        title: t.title,
        mode: "scenario",
        tiers: t.budgetTiers,
        total: rec?.amount || 0,
      })
    })

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

    return { tactics: rows, months, grandTotal }
  }, [currentPlan])

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    budgetData.months.forEach((m) => {
      totals[m] = budgetData.tactics
        .filter((t) => t.mode === "fixed")
        .reduce((sum, t) => sum + (t.monthlyBudget?.[m] || 0), 0)
    })
    return totals
  }, [budgetData])

  return (
    <div className="group relative">
      <div className="hidden" {...dragHandleProps} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
            <DollarSign className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <h3 className="font-heading font-bold text-xl" style={{ color: '#2A3441' }}>{block.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={() => deleteBlock(block.id)} className="h-8 w-8 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {budgetData.tactics.length > 0 ? (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Tactic</th>
                {budgetData.months.map((m) => (
                  <th key={m} className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
                    {formatMonthKey(m)}
                  </th>
                ))}
                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Total</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {budgetData.tactics.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-3 font-medium text-foreground/80 text-[12px] max-w-[200px] truncate">{row.title}</td>
                  {budgetData.months.map((m) => (
                    <td key={m} className="py-3 px-3 text-right text-[12px] text-foreground/70 tabular-nums">
                      {row.mode === "fixed" && row.monthlyBudget?.[m]
                        ? `$${row.monthlyBudget[m].toLocaleString()}`
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right font-semibold text-foreground text-[12px] tabular-nums">
                    ${row.total.toLocaleString()}
                    {row.mode === "scenario" && <span className="text-muted-foreground/50 font-normal">/mo</span>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: row.mode === "fixed" ? "#1DB5C415" : "#FF950015",
                        color: row.mode === "fixed" ? "#1DB5C4" : "#FF9500",
                      }}
                    >
                      {row.mode === "fixed" ? "Monthly" : "Scenario"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-border/40">
                <td className="py-3 px-3 font-bold text-foreground text-[12px] uppercase tracking-wide">Total</td>
                {budgetData.months.map((m) => (
                  <td key={m} className="py-3 px-3 text-right font-bold text-foreground text-[12px] tabular-nums">
                    {monthlyTotals[m] > 0 ? `$${monthlyTotals[m].toLocaleString()}` : <span className="text-muted-foreground/30">—</span>}
                  </td>
                ))}
                <td className="py-3 px-3 text-right font-bold text-[13px] tabular-nums" style={{ color: accentColor }}>
                  ${budgetData.grandTotal.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No budget data yet. Add monthly budgets or budget tiers to your tactics to see the summary.
        </p>
      )}
    </div>
  )
}

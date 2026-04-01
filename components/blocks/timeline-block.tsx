"use client"

import type React from "react"
import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import type { TimelineBlock as TimelineBlockType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Trash2, Calendar, GripVertical } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { usePlanStore } from "@/lib/store"
import { format, parseISO, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, addDays } from "date-fns"

interface TimelineBlockProps {
  block: TimelineBlockType
  dragHandleProps?: any
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

export function TimelineBlock({ block, dragHandleProps }: TimelineBlockProps) {
  const { currentPlan, deleteBlock, updateBlock } = usePlanStore()
  const timelineRef = useRef<HTMLDivElement>(null)
  const [nameColWidth, setNameColWidth] = useState(180)
  const [isResizingCol, setIsResizingCol] = useState(false)
  const [hoveredBar, setHoveredBar] = useState<{ id: string; type: 'production' | 'flight'; idx?: number } | null>(null)

  const [dragState, setDragState] = useState<{
    tacticId: string
    edge: "start" | "end" | "move"
    startX: number
    origStart: Date
    origEnd: Date
    currentStart: Date
    currentEnd: Date
  } | null>(null)

  const timelineData = useMemo(() => {
    if (!currentPlan)
      return { tactics: [], startDate: null, endDate: null, totalDays: 0, months: [], groupedTactics: [] }

    const tactics = flattenTactics(currentPlan.blocks)
    if (tactics.length === 0)
      return { tactics: [], startDate: null, endDate: null, totalDays: 0, months: [], groupedTactics: [] }

    const allDates: Date[] = []
    tactics.forEach((t) => {
      allDates.push(parseISO(t.startDate), parseISO(t.endDate))
      if (t.mediaFlights) {
        t.mediaFlights.forEach((f: any) => {
          allDates.push(parseISO(f.startDate), parseISO(f.endDate))
        })
      }
    })

    const startDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const endDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    const totalDays = differenceInDays(endDate, startDate) + 1
    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    const groupedTactics: Array<{ sectionTitle: string; sectionIcon: string; sectionColor: string; tactics: any[] }> = []

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
            mediaFlights: (tactic.mediaFlights || []).map((f: any) => ({
              startDate: parseISO(f.startDate),
              endDate: parseISO(f.endDate),
              label: f.label || "",
            })),
          }))

        if (sectionTactics.length > 0) {
          groupedTactics.push({
            sectionTitle: block.title,
            sectionIcon: block.icon || "Folder",
            sectionColor: block.color || "#FF9500",
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
      groupedTactics,
    }
  }, [currentPlan])

  const getBarPosition = useCallback((tacticStart: Date, tacticEnd: Date) => {
    if (!timelineData.startDate || timelineData.totalDays === 0) return { left: 0, width: 100 }
    const daysFromStart = differenceInDays(tacticStart, timelineData.startDate)
    const tacticDuration = differenceInDays(tacticEnd, tacticStart) + 1
    const left = (daysFromStart / timelineData.totalDays) * 100
    const width = (tacticDuration / timelineData.totalDays) * 100
    return { left: Math.max(0, left), width: Math.max(0.5, width) }
  }, [timelineData])

  const getMonthWidth = useCallback((month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
    return (daysInMonth / timelineData.totalDays) * 100
  }, [timelineData])

  // Column resize
  const handleColResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = nameColWidth

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      setNameColWidth(Math.max(120, Math.min(400, startWidth + delta)))
    }
    const onUp = () => {
      setIsResizingCol(false)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    setIsResizingCol(true)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // Bar drag
  const handleBarMouseDown = (e: React.MouseEvent, tacticId: string, edge: "start" | "end" | "move", tactic: any) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState({
      tacticId,
      edge,
      startX: e.clientX,
      origStart: tactic.startDate,
      origEnd: tactic.endDate,
      currentStart: tactic.startDate,
      currentEnd: tactic.endDate,
    })
  }

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !timelineData.startDate || !timelineRef.current) return

      const timelineEl = timelineRef.current
      const rect = timelineEl.getBoundingClientRect()
      const timelineWidth = rect.width - nameColWidth
      if (timelineWidth <= 0) return

      const deltaX = e.clientX - dragState.startX
      const deltaDays = Math.round((deltaX / timelineWidth) * timelineData.totalDays)

      let newStart = dragState.origStart
      let newEnd = dragState.origEnd

      if (dragState.edge === "start") {
        newStart = addDays(dragState.origStart, deltaDays)
        if (newStart >= dragState.origEnd) newStart = addDays(dragState.origEnd, -1)
      } else if (dragState.edge === "end") {
        newEnd = addDays(dragState.origEnd, deltaDays)
        if (newEnd <= dragState.origStart) newEnd = addDays(dragState.origStart, 1)
      } else {
        newStart = addDays(dragState.origStart, deltaDays)
        newEnd = addDays(dragState.origEnd, deltaDays)
      }

      setDragState(prev => prev ? { ...prev, currentStart: newStart, currentEnd: newEnd } : null)

      updateBlock(dragState.tacticId, {
        startDate: format(newStart, "yyyy-MM-dd"),
        endDate: format(newEnd, "yyyy-MM-dd"),
      })
    }

    const handleMouseUp = () => setDragState(null)

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragState, timelineData, updateBlock, nameColWidth])

  const formatBarDate = (d: Date) => format(d, "MMM d")

  return (
    <div className="group relative" ref={timelineRef}>
      <div className="hidden" {...dragHandleProps} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#FF9500]" />
          </div>
          <h3 className="font-heading font-bold text-xl" style={{ color: '#2A3441' }}>{block.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={() => deleteBlock(block.id)} className="h-8 w-8 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {timelineData.tactics.length > 0 ? (
        <div className="overflow-x-auto -mx-2 px-2">
          <div style={{ minWidth: `${nameColWidth + 500}px` }}>
            {/* Column headers */}
            <div className="border-b border-border/50">
              {/* Year row */}
              <div className="flex">
                <div style={{ width: nameColWidth, minWidth: nameColWidth }} className="flex-shrink-0" />
                <div className="flex-1 flex">
                  {(() => {
                    const yearGroups: Array<{ year: string; width: number }> = []
                    let curYear = ""
                    let curW = 0
                    timelineData.months.forEach((month) => {
                      const year = format(month, "yyyy")
                      const w = getMonthWidth(month)
                      if (year === curYear) { curW += w }
                      else { if (curYear) yearGroups.push({ year: curYear, width: curW }); curYear = year; curW = w }
                    })
                    if (curYear) yearGroups.push({ year: curYear, width: curW })
                    return yearGroups.map((yg, idx) => (
                      <div
                        key={idx}
                        className="text-center text-[11px] font-bold text-foreground/60 border-l first:border-l-0 border-border/30 py-1.5 uppercase tracking-widest"
                        style={{ width: `${yg.width}%` }}
                      >
                        {yg.year}
                      </div>
                    ))
                  })()}
                </div>
              </div>
              {/* Month row */}
              <div className="flex">
                <div
                  style={{ width: nameColWidth, minWidth: nameColWidth }}
                  className="flex-shrink-0 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest self-end pb-2 pr-2 relative"
                >
                  Tactic
                  {/* Column resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center hover:bg-border/30 transition-colors z-10"
                    onMouseDown={handleColResizeStart}
                  >
                    <div className={`w-px h-3/5 ${isResizingCol ? 'bg-primary' : 'bg-border/60'}`} />
                  </div>
                </div>
                <div className="flex-1 flex">
                  {timelineData.months.map((month, idx) => (
                    <div
                      key={idx}
                      className="text-center text-[10px] font-medium text-muted-foreground/50 border-l border-border/30 px-1 py-2"
                      style={{ width: `${getMonthWidth(month)}%` }}
                    >
                      {format(month, "MMM")}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Grouped tactics */}
            <div>
              {timelineData.groupedTactics.map((group, groupIndex) => {
                const SectionIcon = (LucideIcons as any)[group.sectionIcon] || LucideIcons.Folder
                return (
                  <div key={groupIndex}>
                    {/* Section Header */}
                    <div className="flex items-center border-b border-border/30 bg-muted/20">
                      <div style={{ width: nameColWidth, minWidth: nameColWidth }} className="flex-shrink-0 flex items-center gap-2 py-2 pl-1 pr-2">
                        <SectionIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.sectionColor }} />
                        <span className="font-semibold text-[11px] text-foreground truncate">{group.sectionTitle}</span>
                      </div>
                      <div className="flex-1 relative h-8">
                        <div className="absolute inset-0 flex pointer-events-none">
                          {timelineData.months.map((month, idx) => (
                            <div key={idx} className="border-l border-border/10 h-full" style={{ width: `${getMonthWidth(month)}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tactics */}
                    {group.tactics.map((tactic) => {
                      const IconComp = (LucideIcons as any)[tactic.icon] || LucideIcons.Package
                      const isDragging = dragState !== null && dragState.tacticId === tactic.id
                      const displayStart = isDragging ? dragState!.currentStart : tactic.startDate
                      const displayEnd = isDragging ? dragState!.currentEnd : tactic.endDate
                      const { left, width } = getBarPosition(displayStart, displayEnd)
                      const duration = differenceInDays(displayEnd, displayStart) + 1
                      const hasFlights = tactic.mediaFlights?.length > 0
                      const isHoveredProd = hoveredBar?.id === tactic.id && hoveredBar?.type === 'production'

                      return (
                        <div key={tactic.id} className="flex items-center border-b border-border/10 hover:bg-muted/10 transition-colors" style={{ minHeight: hasFlights ? '52px' : '38px' }}>
                          <div style={{ width: nameColWidth, minWidth: nameColWidth }} className="flex-shrink-0 flex items-center gap-1.5 pr-2 pl-4 overflow-hidden">
                            <IconComp className="w-3 h-3 flex-shrink-0" style={{ color: group.sectionColor, opacity: 0.6 }} />
                            <span className="text-[11px] font-medium truncate text-foreground/75">{tactic.title}</span>
                          </div>

                          <div className="flex-1 relative">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {timelineData.months.map((month, idx) => (
                                <div key={idx} className="border-l border-border/10 h-full" style={{ width: `${getMonthWidth(month)}%` }} />
                              ))}
                            </div>

                            <div className="relative flex flex-col justify-center gap-0.5 py-1">
                              {/* Production bar */}
                              <div className="relative h-[22px] flex items-center">
                                <div
                                  className="absolute h-[20px] rounded flex items-center justify-between px-1.5 cursor-move group/bar shadow-sm transition-shadow hover:shadow-md"
                                  style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    minWidth: "36px",
                                    background: 'linear-gradient(135deg, #FF9500, #FF9500CC)',
                                  }}
                                  onMouseDown={(e) => handleBarMouseDown(e, tactic.id, "move", tactic)}
                                  onMouseEnter={() => setHoveredBar({ id: tactic.id, type: 'production' })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                >
                                  {/* Left resize handle */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 opacity-0 group-hover/bar:opacity-100"
                                    onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, tactic.id, "start", tactic) }}
                                  >
                                    <div className="w-full h-full rounded-l hover:bg-white/30 transition-colors" />
                                  </div>

                                  {/* Bar content — show dates while dragging, otherwise duration */}
                                  <span className="text-[9px] font-semibold text-white truncate pointer-events-none flex-1 text-center">
                                    {isDragging
                                      ? `${formatBarDate(dragState!.currentStart)} — ${formatBarDate(dragState!.currentEnd)}`
                                      : `${duration}d`
                                    }
                                  </span>

                                  {/* Right resize handle */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 opacity-0 group-hover/bar:opacity-100"
                                    onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, tactic.id, "end", tactic) }}
                                  >
                                    <div className="w-full h-full rounded-r hover:bg-white/30 transition-colors" />
                                  </div>

                                  {/* Tooltip */}
                                  {isHoveredProd && !isDragging && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-foreground text-background rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap z-30 shadow-lg pointer-events-none">
                                      <div className="font-semibold mb-0.5">{tactic.title}</div>
                                      <div className="text-background/70">{formatBarDate(tactic.startDate)} — {formatBarDate(tactic.endDate)} · {duration}d</div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Media flight bars */}
                              {tactic.mediaFlights.map((flight: any, fIdx: number) => {
                                const flightPos = getBarPosition(flight.startDate, flight.endDate)
                                const flightDays = differenceInDays(flight.endDate, flight.startDate) + 1
                                const isHoveredFlight = hoveredBar?.id === tactic.id && hoveredBar?.type === 'flight' && hoveredBar?.idx === fIdx

                                return (
                                  <div key={fIdx} className="relative h-[16px] flex items-center">
                                    <div
                                      className="absolute h-[14px] rounded flex items-center px-1.5 shadow-sm"
                                      style={{
                                        left: `${flightPos.left}%`,
                                        width: `${flightPos.width}%`,
                                        minWidth: "28px",
                                        background: 'linear-gradient(135deg, #1DB5C4, #1DB5C4BB)',
                                      }}
                                      onMouseEnter={() => setHoveredBar({ id: tactic.id, type: 'flight', idx: fIdx })}
                                      onMouseLeave={() => setHoveredBar(null)}
                                    >
                                      <span className="text-[8px] font-medium text-white truncate pointer-events-none">
                                        {flight.label || `${flightDays}d`}
                                      </span>

                                      {isHoveredFlight && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-foreground text-background rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap z-30 shadow-lg pointer-events-none">
                                          <div className="font-semibold mb-0.5">{flight.label || "Media Flight"}</div>
                                          <div className="text-background/70">{formatBarDate(flight.startDate)} — {formatBarDate(flight.endDate)} · {flightDays}d</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Legend + Summary */}
            <div className="border-t border-border/40 pt-3 mt-1 flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-2 rounded-sm bg-[#FF9500]" />
                  <span>Production</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-2 rounded-sm bg-[#1DB5C4]" />
                  <span>Media Flight</span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground/40">
                {timelineData.tactics.length} tactics · {timelineData.totalDays} days ·{" "}
                {format(timelineData.startDate!, "MMM d, yyyy")} — {format(timelineData.endDate!, "MMM d, yyyy")}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No tactics added yet. Add tactics with dates to see the timeline.
        </p>
      )}
    </div>
  )
}

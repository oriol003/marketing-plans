"use client"

import { Block } from "@/types/marketing-plan"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarIcon, Loader2, RefreshCw, Trash2, GripVertical } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import * as Icons from "lucide-react"

interface BlockEditorProps {
  block: Block
  onUpdate: (id: string, updates: Partial<Block>) => void
  onDelete: (id: string) => void
  onRegenerate: (id: string) => void
}

export function BlockEditor({ block, onUpdate, onDelete, onRegenerate }: BlockEditorProps) {
  const IconComponent = block.tacticData?.icon ? (Icons[block.tacticData.icon as keyof typeof Icons] as any) : null

  return (
    <Card className="mb-6 group relative border-l-4 border-l-transparent hover:border-l-primary transition-all">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 cursor-grab">
        <GripVertical className="h-5 w-5" />
      </div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="h-5 w-5 text-muted-foreground" />}
          <Input
            value={block.title}
            onChange={(e) => onUpdate(block.id, { title: e.target.value })}
            className="font-semibold text-lg border-none shadow-none px-0 h-auto focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRegenerate(block.id)}
            disabled={block.isGenerating}
          >
            {block.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(block.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {block.type === "tactic" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Production Hours</Label>
              <Input
                type="number"
                value={block.tacticData?.hours || ""}
                onChange={(e) =>
                  onUpdate(block.id, {
                    tacticData: { ...block.tacticData, hours: parseFloat(e.target.value) },
                  })
                }
                className="h-8"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Production Dates</Label>
              <div className="flex gap-2">
                <DatePicker
                  date={block.tacticData?.productionStartDate ? new Date(block.tacticData.productionStartDate) : undefined}
                  onSelect={(date) =>
                    onUpdate(block.id, {
                      tacticData: { ...block.tacticData, productionStartDate: date?.toISOString() },
                    })
                  }
                  placeholder="Start"
                />
                <DatePicker
                  date={block.tacticData?.productionEndDate ? new Date(block.tacticData.productionEndDate) : undefined}
                  onSelect={(date) =>
                    onUpdate(block.id, {
                      tacticData: { ...block.tacticData, productionEndDate: date?.toISOString() },
                    })
                  }
                  placeholder="End"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Flight Dates</Label>
              <div className="flex gap-2">
                <DatePicker
                  date={block.tacticData?.flightStartDate ? new Date(block.tacticData.flightStartDate) : undefined}
                  onSelect={(date) =>
                    onUpdate(block.id, {
                      tacticData: { ...block.tacticData, flightStartDate: date?.toISOString() },
                    })
                  }
                  placeholder="Start"
                />
                <DatePicker
                  date={block.tacticData?.flightEndDate ? new Date(block.tacticData.flightEndDate) : undefined}
                  onSelect={(date) =>
                    onUpdate(block.id, {
                      tacticData: { ...block.tacticData, flightEndDate: date?.toISOString() },
                    })
                  }
                  placeholder="End"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dependencies</Label>
              <Input
                value={block.tacticData?.dependencies || ""}
                onChange={(e) =>
                  onUpdate(block.id, {
                    tacticData: { ...block.tacticData, dependencies: e.target.value },
                  })
                }
                className="h-8"
                placeholder="e.g. Brand Identity"
              />
            </div>
          </div>
        )}

        <Textarea
          value={block.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          className="min-h-[200px] font-mono text-sm"
          placeholder={block.isGenerating ? "Generating content..." : "Enter content here..."}
        />
      </CardContent>
    </Card>
  )
}

function DatePicker({ date, onSelect, placeholder }: { date?: Date; onSelect: (date?: Date) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn("w-full h-8 justify-start text-left font-normal px-2", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-3 w-3" />
          {date ? format(date, "MMM d") : <span className="text-xs">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

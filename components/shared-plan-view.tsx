"use client"

import { useState, useEffect } from "react"
import type { MarketingPlan, Block } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Check, MessageSquare, Menu, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CoverBlock as CoverBlockComponent } from "@/components/blocks/cover-block"
import { TextBlock as TextBlockComponent } from "@/components/blocks/text-block"
import { TacticBlock as TacticBlockComponent } from "@/components/blocks/tactic-block"
import { SectionBlock as SectionBlockComponent } from "@/components/blocks/section-block"
import { TableBlock as TableBlockComponent } from "@/components/blocks/table-block"
import { TimelineBlock as TimelineBlockComponent } from "@/components/blocks/timeline-block"
import { AudienceBlock as AudienceBlockComponent } from "@/components/blocks/audience-block"
import { getIconComponent } from "@/lib/utils"

interface ShareData {
  id: string
  approval_status: string
  approver_name?: string
  approver_email?: string
  approval_notes?: string
  approved_at?: string
}

interface NavigationItem {
  id: string
  title: string
  icon?: string
  type: string
  depth: number
}

export function SharedPlanView({
  plan,
  share,
  token,
}: {
  plan: MarketingPlan
  share: ShareData
  token: string
}) {
  const [approvalDialog, setApprovalDialog] = useState<"approve" | "changes" | null>(null)
  const [approverName, setApproverName] = useState("")
  const [approverEmail, setApproverEmail] = useState("")
  const [approvalNotes, setApprovalNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(true)
  const { toast } = useToast()

  const navigationItems: NavigationItem[] = []
  const buildNavigation = (blocks: Block[], depth = 0) => {
    blocks.forEach((block) => {
      if (block.type === "section" || block.type === "text" || block.type === "tactic") {
        navigationItems.push({
          id: block.id,
          title: block.title || "Untitled",
          icon: block.type === "section" || block.type === "tactic" ? block.icon : undefined,
          type: block.type,
          depth,
        })
      }
      if (block.children && block.children.length > 0) {
        buildNavigation(block.children, depth + 1)
      }
    })
  }
  buildNavigation(plan.blocks)

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("[data-block-id]")
      let currentSection = null

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect()
        if (rect.top <= 150 && rect.bottom >= 150) {
          currentSection = section.getAttribute("data-block-id")
        }
      })

      if (currentSection) {
        setActiveSection(currentSection)
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll() // Initial check

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (blockId: string) => {
    const element = document.querySelector(`[data-block-id="${blockId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleApproval = async (status: "approved" | "changes_requested") => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/shares/${token}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalStatus: status,
          approverName,
          approverEmail,
          approvalNotes: status === "changes_requested" ? approvalNotes : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit approval")
      }

      toast({
        title: status === "approved" ? "Plan Approved!" : "Changes Requested",
        description:
          status === "approved"
            ? "The plan owner has been notified of your approval."
            : "The plan owner has been notified of your requested changes.",
      })

      setApprovalDialog(null)

      setTimeout(() => window.location.reload(), 1500)
    } catch (error) {
      console.error("Error submitting approval:", error)
      toast({
        title: "Error",
        description: "Failed to submit your response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderBlock = (block: Block, index: number) => {
    const blockProps = {
      block,
      planId: plan.id,
      isReadOnly: true,
      allBlocks: plan.blocks,
    }

    return (
      <div data-block-id={block.id} key={block.id}>
        {(() => {
          switch (block.type) {
            case "cover":
              return <CoverBlockComponent {...blockProps} />
            case "text":
              return <TextBlockComponent {...blockProps} />
            case "tactic":
              return <TacticBlockComponent {...blockProps} />
            case "section":
              return <SectionBlockComponent {...blockProps} />
            case "table":
              return <TableBlockComponent {...blockProps} />
            case "timeline":
              return <TimelineBlockComponent {...blockProps} />
            case "audience":
              return <AudienceBlockComponent {...blockProps} />
            default:
              return null
          }
        })()}
      </div>
    )
  }

  const renderAllBlocks = (blocks: Block[]) => {
    return blocks.map((block, index) => (
      <div key={block.id} className="mb-8">
        {renderBlock(block, index)}
        {block.children && block.children.length > 0 && (
          <div className="ml-4 space-y-6 mt-6">{renderAllBlocks(block.children)}</div>
        )}
      </div>
    ))
  }

  const isAlreadyResponded = share.approval_status !== "pending"

  return (
    <div className="min-h-screen bg-background">
      <div
        className={`fixed left-0 top-0 h-screen bg-card border-r shadow-lg transition-transform duration-300 z-40 flex flex-col ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "320px" }}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Contents</h2>
          <Button variant="ghost" size="sm" onClick={() => setNavOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon ? getIconComponent(item.icon) : null
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
                style={{ paddingLeft: `${12 + item.depth * 16}px` }}
              >
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{item.title}</span>
                </div>
              </button>
            )
          })}
        </div>

        {!isAlreadyResponded ? (
          <div className="p-4 border-t space-y-3">
            <h3 className="font-semibold text-base mb-2">Review Plan</h3>
            <Button
              onClick={() => setApprovalDialog("approve")}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              size="default"
            >
              <Check className="w-4 h-4" />
              Approve Plan
            </Button>
            <Button onClick={() => setApprovalDialog("changes")} variant="outline" className="w-full gap-2">
              <MessageSquare className="w-4 h-4" />
              Request Changes
            </Button>
          </div>
        ) : (
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {share.approval_status === "approved" ? (
                <>
                  <Check className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-600">Approved</p>
                    {share.approver_name && <p className="text-xs text-muted-foreground">by {share.approver_name}</p>}
                  </div>
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-orange-600">Changes Requested</p>
                    {share.approver_name && <p className="text-xs text-muted-foreground">by {share.approver_name}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {!navOpen && (
        <Button
          onClick={() => setNavOpen(true)}
          className="fixed left-4 top-4 z-40 shadow-lg"
          size="sm"
          variant="outline"
        >
          <Menu className="w-4 h-4 mr-2" />
          Contents
        </Button>
      )}

      <div className={`transition-all duration-300 ${navOpen ? "ml-[320px]" : "ml-0"}`}>
        <div className="max-w-4xl mx-auto px-8 py-12">
          <div className="prose prose-lg max-w-none">{renderAllBlocks(plan.blocks)}</div>
        </div>
      </div>

      <Dialog open={approvalDialog !== null} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalDialog === "approve" ? "Approve Marketing Plan" : "Request Changes"}</DialogTitle>
            <DialogDescription>
              {approvalDialog === "approve"
                ? "Confirm that you approve this marketing plan."
                : "Let the plan owner know what changes you would like to see."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
              />
            </div>

            {approvalDialog === "changes" && (
              <div className="space-y-2">
                <Label htmlFor="notes">What changes would you like?</Label>
                <Textarea
                  id="notes"
                  placeholder="Please describe the changes you'd like to see..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleApproval(approvalDialog === "approve" ? "approved" : "changes_requested")}
              disabled={!approverName || isSubmitting}
              className={approvalDialog === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isSubmitting ? "Submitting..." : approvalDialog === "approve" ? "Approve" : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

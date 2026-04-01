"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Share2, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ShareDialog({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const generateShareLink = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate share link")
      }

      const { share } = await response.json()
      const url = `${window.location.origin}/share/${share.share_token}`
      setShareUrl(url)

      toast({
        title: "Share link generated",
        description: "You can now share this link with others.",
      })
    } catch (error) {
      console.error("Error generating share link:", error)
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast({
      title: "Copied!",
      description: "Share link copied to clipboard.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Marketing Plan</DialogTitle>
          <DialogDescription>Generate a public link to share this plan for review and approval.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <Button onClick={generateShareLink} disabled={isGenerating} className="w-full" size="lg">
              {isGenerating ? "Generating..." : "Generate Share Link"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="share-url">Share Link</Label>
              <div className="flex gap-2">
                <Input id="share-url" value={shareUrl} readOnly className="flex-1" />
                <Button onClick={copyToClipboard} variant="outline" size="icon">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Anyone with this link can view and respond to the plan.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

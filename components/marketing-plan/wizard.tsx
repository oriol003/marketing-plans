"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { WizardData } from "@/types/marketing-plan"
import { Loader2 } from 'lucide-react'

interface WizardProps {
  onSubmit: (data: WizardData) => void
  isGenerating: boolean
}

const TACTICS = [
  "Social Media Marketing",
  "Email Marketing",
  "SEO & Content Strategy",
  "PPC Advertising",
  "Brand Identity",
  "Website Development",
  "Video Production",
  "Public Relations",
  "Influencer Marketing",
]

export function Wizard({ onSubmit, isGenerating }: WizardProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    clientName: "",
    goals: "",
    audience: "",
    selectedTactics: [],
  })

  const handleNext = () => setStep(step + 1)
  const handleBack = () => setStep(step - 1)

  const toggleTactic = (tactic: string) => {
    setData((prev) => ({
      ...prev,
      selectedTactics: prev.selectedTactics.includes(tactic)
        ? prev.selectedTactics.filter((t) => t !== tactic)
        : [...prev.selectedTactics, tactic],
    }))
  }

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Create New Marketing Plan</CardTitle>
          <CardDescription>Step {step} of 3</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="clientName">Client / Project Name</Label>
                <Input
                  id="clientName"
                  value={data.clientName}
                  onChange={(e) => setData({ ...data, clientName: e.target.value })}
                  placeholder="e.g. RGV Business Journal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals">Campaign Goals</Label>
                <Textarea
                  id="goals"
                  value={data.goals}
                  onChange={(e) => setData({ ...data, goals: e.target.value })}
                  placeholder="What are the primary objectives? (e.g. Increase brand awareness, drive subscriptions)"
                  className="h-32"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Textarea
                  id="audience"
                  value={data.audience}
                  onChange={(e) => setData({ ...data, audience: e.target.value })}
                  placeholder="Who are we trying to reach? (e.g. Business owners in the Rio Grande Valley)"
                  className="h-32"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label>Select Tactics</Label>
              <div className="grid grid-cols-2 gap-4">
                {TACTICS.map((tactic) => (
                  <div key={tactic} className="flex items-center space-x-2">
                    <Checkbox
                      id={tactic}
                      checked={data.selectedTactics.includes(tactic)}
                      onCheckedChange={() => toggleTactic(tactic)}
                    />
                    <label
                      htmlFor={tactic}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {tactic}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={isGenerating}>
              Back
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button onClick={handleNext} disabled={!data.clientName}>
              Next
            </Button>
          ) : (
            <Button onClick={() => onSubmit(data)} disabled={isGenerating || data.selectedTactics.length === 0}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Plan
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

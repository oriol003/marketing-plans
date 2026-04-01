"use server"

import { z } from "zod"
import { generateTextGemini, generateObjectGemini } from "@/lib/ai"

// Schema for the plan outline
const blockSchema = z.object({
  title: z.string(),
  type: z.enum(["text", "tactic"]),
  description: z.string().describe("Brief description of what this section should contain"),
  tacticData: z
    .object({
      icon: z.string().optional().describe("Lucide icon name suitable for this tactic"),
      hours: z.number().optional().describe("Estimated production hours"),
    })
    .optional(),
})

const planOutlineSchema = z.object({
  blocks: z.array(blockSchema),
})

export async function generatePlanOutline(data: {
  clientName: string
  goals: string
  audience: string
  selectedTactics: string[]
}) {
  const prompt = `
    Create a comprehensive marketing plan outline for a client named "${data.clientName}".
    
    Goals: ${data.goals}
    Target Audience: ${data.audience}
    Selected Tactics: ${data.selectedTactics.join(", ")}

    The plan should follow a professional structure similar to:
    1. Executive Summary (Text)
    2. Goals & Objectives (Text)
    3. Target Audience Analysis (Text)
    4. Strategy Overview (Text)
    5. [Tactic Sections] - Create a separate 'tactic' block for each selected tactic (e.g., Social Media, Email, SEO).
    6. Measurement & Analytics (Text)
    7. Timeline & Budget Summary (Text)

    For 'tactic' blocks, suggest an appropriate icon name (from Lucide icons) and estimated production hours if applicable.
  `

  const { object } = await generateObjectGemini<{ blocks: Array<z.infer<typeof blockSchema>> }>({
    prompt,
    schema: planOutlineSchema,
  })

  return object.blocks.map((block) => ({
    ...block,
    id: Math.random().toString(36).substring(7),
    content: "", // Content will be generated separately
  }))
}

export async function generateBlockContent(
  blockTitle: string,
  blockDescription: string,
  context: {
    clientName: string
    goals: string
    audience: string
    previousBlocks: { title: string; content: string }[]
  },
) {
  const prompt = `
    Write the content for the "${blockTitle}" section of a marketing plan for "${context.clientName}".
    
    Context:
    - Goals: ${context.goals}
    - Audience: ${context.audience}
    - Section Description: ${blockDescription}
    
    Previous sections context: ${context.previousBlocks.map((b) => b.title).join(", ")}

    Write professional, actionable content. Use Markdown formatting.
    Keep it concise but comprehensive.
  `

  const { text } = await generateTextGemini({
    prompt,
  })

  return text
}

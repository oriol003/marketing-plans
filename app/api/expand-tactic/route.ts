import { generateObjectGemini } from "@/lib/ai"
import { z } from "zod"

const STANDARD_CATEGORIES = [
  "Digital Marketing",
  "Content & Creative",
  "SEO & Analytics",
  "Social Media",
  "Advertising",
  "Brand & Strategy",
  "Events & PR",
  "Website & Tech",
] as const

const expandedTacticsSchema = z.object({
  tactics: z
    .array(
      z.object({
        title: z
          .string()
          .describe("Short, specific deliverable name (e.g., 'Design Event Flyer', 'Create Instagram Carousel')"),
        description: z.string().describe("One sentence describing the specific deliverable"),
        category: z.enum(STANDARD_CATEGORIES),
        what: z.string().describe("The specific tangible deliverable or asset"),
        why: z.string().describe("Why this specific deliverable matters to the campaign"),
        how: z.string().describe("How to create/execute this specific deliverable"),
        evidence: z
          .string()
          .describe(
            "How this deliverable connects to the original evidence or reference (e.g., 'Part of the event campaign mentioned at [timestamp]')",
          ),
        estimatedHours: z.number().describe("Hours for this specific deliverable (usually 1-8 hours each)"),
      }),
    )
    .describe("Array of 3-8 specific deliverables that make up the original campaign/tactic"),
})

export async function POST(request: Request) {
  try {
    const { tactic, instruction, referenceContent } = await request.json()

    if (!tactic) {
      return Response.json({ error: "Tactic is required" }, { status: 400 })
    }

    const systemPrompt = `You are a marketing operations expert who breaks down high-level campaigns and tactics into specific, actionable deliverables.

Your task is to expand a broad campaign or tactic into its component deliverables - the actual assets, tasks, and outputs that need to be created.

Guidelines:
- Break down into 3-8 specific deliverables (not sub-campaigns, but actual tangible outputs)
- Each deliverable should be something a team member can complete in 1-8 hours
- Be specific: "Design Instagram carousel for event" not "Social media content"
- Include all the actual assets: flyers, posts, landing pages, email templates, etc.
- Preserve any timeline/deadline information from the original
- Hours should sum to roughly the original estimate (or slightly more if expanding scope)
- Use the same category for related deliverables or appropriate different categories
- For the evidence field, explain how this deliverable connects to the original tactic and reference

Examples of good deliverables:
- "Design Event Promotional Flyer" (2h)
- "Create 5-Post Instagram Carousel" (3h)
- "Write Email Invitation Template" (2h)
- "Set Up Event Landing Page" (4h)
- "Create Facebook Event + Cover Image" (2h)
- "Design Digital Ad Banners (3 sizes)" (3h)`

    const userPrompt = `Break down this tactic into specific deliverables:

ORIGINAL TACTIC:
Title: ${tactic.title}
Description: ${tactic.description}
Category: ${tactic.category}
What: ${tactic.what}
Why: ${tactic.why}
How: ${tactic.how}
Estimated Hours: ${tactic.estimatedHours}h
Original Evidence: ${tactic.evidence || "N/A"}

${instruction ? `USER INSTRUCTION: ${instruction}` : ""}

${referenceContent ? `REFERENCE CONTEXT:\n${referenceContent.slice(0, 3000)}` : ""}

Break this down into specific, actionable deliverables. Each should be a concrete asset or task that can be completed independently.

For each deliverable's "evidence" field, explain how it connects to the original tactic's evidence: "${tactic.evidence || "the parent campaign"}"`

    const { object } = await generateObjectGemini<z.infer<typeof expandedTacticsSchema>>({
      schema: expandedTacticsSchema,
      systemPrompt: systemPrompt,
      prompt: userPrompt,
    })

    return Response.json({ tactics: object.tactics })
  } catch (error) {
    console.error("[expand-tactic] Error:", error)
    return Response.json({ error: "Failed to expand tactic" }, { status: 500 })
  }
}

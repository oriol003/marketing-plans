import { type NextRequest, NextResponse } from "next/server"
import { generateObjectGemini } from "@/lib/ai"
import { z } from "zod"
import { suggestIconForTactic } from "@/lib/utils"

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "tactic", "table", "timeline", "section", "cover", "audience"]),
  title: z.string(),
  order: z.number(),
  parentId: z.string().nullable().optional(),
  sourceContext: z.string().optional(),
  hours: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  aiModified: z.boolean().optional(),
})

const outlineEditSchema = z.object({
  blocks: z.array(blockSchema),
  summary: z.string(),
  changesExplanation: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const params = await req.params
    const planId = params?.id as string
    const { currentBlocks, instructions, referenceIds = [] } = await req.json()

    console.log("[v0] Edit outline request:", {
      planId,
      blockCount: currentBlocks?.length,
      instructions: instructions?.substring(0, 100),
      referenceIds,
    })

    if (!instructions?.trim()) {
      return NextResponse.json({ error: "Instructions are required" }, { status: 400 })
    }

    // Fetch references if provided
    let referenceContext = ""
    if (referenceIds.length > 0) {
      const { createServerClient } = await import("@/lib/supabase/server")
      const supabase = createServerClient()

      const { data: references } = await supabase.from("plan_references").select("*").in("id", referenceIds)

      if (references && references.length > 0) {
        referenceContext =
          "\n\nAdditional Reference Materials:\n" +
          references.map((ref) => `### ${ref.title}\n${ref.content}`).join("\n\n")
      }
    }

    // Convert current blocks to a simplified format for AI
    const blocksForAI = currentBlocks.map((block: any) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      order: block.order,
      parentId: block.parentId || null,
      sourceContext: block.sourceContext || "",
      hours: block.hours,
      startDate: block.startDate,
      endDate: block.endDate,
      icon: block.icon,
      description: block.description,
    }))

    const prompt = `You are a marketing plan editor. Your task is to carefully edit this plan outline based on the user's instructions.

IMPORTANT GUIDELINES:
- Be CONSERVATIVE: Only make changes explicitly requested by the user
- Do NOT modify blocks that are already correct
- When updating dates, ensure they are logical and sequential
- EVERY TACTIC MUST HAVE BOTH startDate AND endDate in YYYY-MM-DD format
- When adding new tactics, calculate appropriate start and end dates based on existing timeline
- When removing blocks, explain why in the changes explanation
- Set aiModified: true ONLY for blocks that you actually changed
- Keep existing IDs for blocks you modify
- Generate new UUIDs only for NEW blocks you create

Current Outline (${currentBlocks.length} blocks):
${JSON.stringify(blocksForAI, null, 2)}

User Instructions:
${instructions}
${referenceContext}

CRITICAL DATE REQUIREMENTS:
- Every tactic block MUST have both startDate and endDate
- Dates must be in YYYY-MM-DD format
- If adding new tactics, calculate dates that fit logically in the timeline
- If modifying existing tactics, preserve dates unless user explicitly asks to change them

Return the edited outline with:
1. All blocks (modified and unmodified)
2. Set aiModified: true ONLY on blocks you actually changed
3. ENSURE every tactic has startDate and endDate
4. A summary of what you changed
5. A detailed explanation of each change

Be specific and conservative - don't change things that don't need changing.`

    console.log("[v0] Calling AI to edit outline...")

    const { object } = await generateObjectGemini<z.infer<typeof outlineEditSchema>>({
      schema: outlineEditSchema,
      prompt,
      temperature: 0.3,
      maxTokens: 16000,
    })

    const processedBlocks = object.blocks.map((block) => {
      // This allows AI edits to update icons when content changes significantly
      if (block.type === "tactic" || block.type === "section") {
        const suggestedIcon = suggestIconForTactic(block.title, block.sourceContext || block.description || "")
        return {
          ...block,
          icon: suggestedIcon, // Always update to the most relevant icon
        }
      }
      return block
    })

    console.log("[v0] AI edit complete:", {
      totalBlocks: processedBlocks.length,
      modifiedBlocks: processedBlocks.filter((b) => b.aiModified).length,
      summary: object.summary,
    })

    return NextResponse.json({
      blocks: processedBlocks,
      summary: object.summary,
      changesExplanation: object.changesExplanation,
    })
  } catch (error: any) {
    console.error("[v0] Error editing outline with AI:", error)
    return NextResponse.json({ error: error.message || "Failed to edit outline" }, { status: 500 })
  }
}

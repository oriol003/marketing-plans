import { type NextRequest, NextResponse } from "next/server"
import { generateObjectGemini } from "@/lib/ai"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { suggestIconForTactic } from "@/lib/utils"


const editResultSchema = z.object({
  content: z.string().describe("The revised content for the block"),
  icon: z
    .string()
    .optional()
    .describe("The suggested icon name from lucide-react (only if explicitly requested to change)"),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const {
      blockId,
      blockTitle,
      blockContent,
      blockType,
      currentIcon,
      instructions,
      clientName,
      objective,
      referenceIds,
      includeEntirePlan, // Accept entire plan flag
      useHtml,
    } = body

    const planId = params.id

    console.log("[v0] Editing block with AI:", blockTitle, useHtml ? "(HTML mode)" : "(Markdown mode)")

    let referencesContext = ""
    if (referenceIds && referenceIds.length > 0) {
      try {
        const supabase = await createServerClient()
        const { data: references, error } = await supabase
          .from("plan_references")
          .select("title, content")
          .in("id", referenceIds)

        if (!error && references && references.length > 0) {
          referencesContext = `\n\nAdditional Reference Materials:\n${references
            .map((ref) => `### ${ref.title}\n${ref.content}`)
            .join("\n\n")}`
        }
      } catch (error) {
        console.error("[v0] Error fetching references:", error)
      }
    }

    let entirePlanContext = ""
    if (includeEntirePlan) {
      try {
        const supabase = await createServerClient()
        const { data: planData, error } = await supabase
          .from("plans")
          .select("title, objective, client_name")
          .eq("id", planId)
          .single()

        if (!error && planData) {
          const { data: blocks } = await supabase
            .from("blocks")
            .select("title, content, type, description")
            .eq("plan_id", planId)
            .order("order_index")

          if (blocks && blocks.length > 0) {
            const planOverview = blocks
              .map((b) => {
                const desc = typeof b.description === "string" ? b.description : JSON.stringify(b.description)
                return `## ${b.title} (${b.type})\n${b.content || desc || ""}`
              })
              .join("\n\n")

            entirePlanContext = `\n\nFull Marketing Plan Context:\n### ${planData.title}\nClient: ${planData.client_name}\nObjective: ${planData.objective}\n\n${planOverview}`
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching plan context:", error)
      }
    }

    const formatInstruction = useHtml
      ? "Format your response using proper HTML tags (e.g., <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>). Use semantic HTML for structure."
      : "Format your response using Markdown syntax (e.g., ## for headings, **bold**, *italic*, bullet lists)."

    const prompt = `You are editing a section of a professional marketing proposal.

Client: ${clientName}
Project Objective: ${objective}

Current content for "${blockTitle}" (current icon: ${currentIcon || "Package"}):
${blockContent}

User's editing instructions:
${instructions}${referencesContext}${entirePlanContext}

${formatInstruction}

Revise the content based on the user's instructions${referencesContext || entirePlanContext ? " and the provided context" : ""}. Keep the professional tone.

IMPORTANT: 
- Return the revised content in the "content" field
- If the user explicitly asks to change the icon, suggest an appropriate icon name from lucide-react in the "icon" field
- If no icon change is requested, leave the "icon" field undefined`

    const { object } = await generateObjectGemini<{ content: string; icon?: string }>({
      maxTokens: 8000,
      schema: editResultSchema,
      prompt,
    })

    console.log("[v0] AI editing complete for block:", blockTitle)

    let finalIcon = object.icon || currentIcon

    if (blockType === "tactic" || blockType === "section") {
      const suggestedIcon = suggestIconForTactic(blockTitle, object.content)
      finalIcon = suggestedIcon
      console.log("[v0] Auto-suggested icon for block:", blockTitle, "->", finalIcon)
    }

    return NextResponse.json({
      content: object.content,
      icon: finalIcon,
    })
  } catch (error) {
    console.error("[v0] Error editing with AI:", error)
    return NextResponse.json({ error: "Failed to edit content" }, { status: 500 })
  }
}

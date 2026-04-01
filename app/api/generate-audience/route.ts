import { generateObjectGemini } from "@/lib/ai"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const audienceSchema = z.object({
  personas: z.array(
    z.object({
      name: z.string().describe("Name of the target persona"),
      description: z.string().describe("Brief 1-2 sentence description of this audience segment"),
      incomeLevel: z.string().describe("Income level or net worth range"),
      keyFocus: z.string().describe("Primary focus area or value proposition"),
      demographics: z.array(z.string()).describe("Demographic characteristics (age, location, family status, etc.)"),
      motivations: z.array(z.string()).describe("Key motivations and pain points"),
    }),
  ),
})

export async function POST(req: Request) {
  try {
    const { prompt, count = 3, existingAudience, referenceIds, customInstructions } = await req.json()

    let referencesContext = ""
    if (referenceIds && referenceIds.length > 0) {
      const supabase = await createServerClient()
      const { data: references } = await supabase
        .from("plan_references")
        .select("title, content")
        .in("id", referenceIds)

      if (references && references.length > 0) {
        referencesContext =
          "\n\nAdditional Reference Materials:\n" + references.map((ref) => `- ${ref.title}: ${ref.content}`).join("\n")
      }
    }

    const customInstructionsText = customInstructions ? `\n\nSpecific Requirements: ${customInstructions}` : ""

    const systemPrompt = existingAudience
      ? `You are helping refine and improve an existing target audience persona. Current persona: ${JSON.stringify(existingAudience)}`
      : `You are a marketing strategist helping define target audience personas. Generate ${count} distinct, detailed personas.`

    const userPrompt = existingAudience
      ? `Improve this audience persona based on the following context: ${prompt}${referencesContext}${customInstructionsText}`
      : `Generate ${count} detailed target audience personas for: ${prompt}${referencesContext}${customInstructionsText}`

    const { object } = await generateObjectGemini<z.infer<typeof audienceSchema>>({
      schema: audienceSchema,
      systemPrompt: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8000,
    })

    return Response.json({ personas: object.personas })
  } catch (error: any) {
    console.error("Error generating audiences:", error)
    return Response.json({ error: "Failed to generate audience personas", details: error.message }, { status: 500 })
  }
}

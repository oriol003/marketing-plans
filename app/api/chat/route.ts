import { NextRequest, NextResponse } from "next/server"
import { generateTextGemini } from "@/lib/ai"

export async function POST(request: NextRequest) {
    try {
        const { message, model, planContext, blockContext, conversationHistory } = await request.json()

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 })
        }

        // Build context sections
        let contextPrompt = ""

        if (planContext) {
            contextPrompt += `
## Marketing Plan Context
- **Plan Title:** ${planContext.planTitle || "Untitled Plan"}
- **Client:** ${planContext.clientName || "Unknown"}
- **Objective:** ${planContext.objective || "Not specified"}
`
        }

        if (blockContext) {
            contextPrompt += `
## Currently Selected Block
- **Type:** ${blockContext.type}
- **Title:** ${blockContext.title || "Untitled"}
${blockContext.content ? `- **Content:** ${blockContext.content.substring(0, 500)}${blockContext.content.length > 500 ? "..." : ""}` : ""}
${blockContext.sourceContext ? `
### Source Context (from transcript analysis)
${blockContext.sourceContext}
` : ""}
${blockContext.description ? `- **Description:** ${blockContext.description}` : ""}
`
        }

        // Build conversation history
        let historyPrompt = ""
        if (conversationHistory && conversationHistory.length > 0) {
            historyPrompt = "\n## Previous Conversation\n"
            for (const msg of conversationHistory) {
                historyPrompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`
            }
        }

        const systemPrompt = `You are an expert marketing strategist assistant helping a user work on their marketing plan. 
You have deep expertise in:
- Brand strategy and positioning
- Content marketing and SEO
- Digital advertising and media buying
- Social media strategy
- Website UX and conversion optimization
- Customer journey mapping

Be helpful, concise, and actionable. When discussing tactics, reference the specific context provided.
If asked about improvements, provide specific, practical suggestions.
Format your responses using markdown for readability.`

        const fullPrompt = `${systemPrompt}

${contextPrompt}
${historyPrompt}

## Current Question
${message}

Please provide a helpful, actionable response:`

        console.log("[Chat] Using model:", model)
        console.log("[Chat] Has plan context:", !!planContext)
        console.log("[Chat] Has block context:", !!blockContext)

        const result = await generateTextGemini({
            prompt: fullPrompt,
            maxTokens: 2000,
            temperature: 0.7,
        })

        return NextResponse.json({
            response: result.text,
            model: model,
        })
    } catch (error) {
        console.error("[Chat] Error:", error)
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        )
    }
}

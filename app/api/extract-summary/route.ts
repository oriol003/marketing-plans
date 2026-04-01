import { generateObjectGemini } from "@/lib/ai"
import { z } from "zod"

// Schema for transcript summary extraction
const transcriptSummarySchema = z.object({
    companyInfo: z.object({
        name: z.string().describe("Company or client name"),
        industry: z.string().describe("Industry or sector they operate in"),
        size: z.string().describe("Company size/stage (startup, SMB, enterprise, etc.)"),
        location: z.string().optional().describe("Location if mentioned"),
        description: z.string().describe("Brief 1-2 sentence description of what the company does"),
    }),

    customerNeeds: z.array(z.object({
        need: z.string().describe("A specific need or pain point the customer expressed"),
        quote: z.string().describe("Direct quote from the client about this need"),
        priority: z.enum(["high", "medium", "low"]).describe("Perceived priority based on emphasis in conversation"),
    })).describe("List of customer needs and pain points discussed"),

    objectives: z.object({
        primaryGoal: z.string().describe("The main goal or objective the client wants to achieve"),
        secondaryGoals: z.array(z.string()).describe("Additional goals mentioned"),
        successMetrics: z.array(z.string()).describe("How they will measure success (KPIs, metrics, outcomes)"),
        timeline: z.string().optional().describe("Any timeline or deadline mentioned"),
    }),

    currentState: z.object({
        existingEfforts: z.array(z.string()).describe("What marketing/branding they currently have"),
        challenges: z.array(z.string()).describe("Current challenges or problems they face"),
        whatWorked: z.array(z.string()).describe("Things that have worked well for them"),
        whatFailed: z.array(z.string()).describe("Things that haven't worked or they've tried and failed"),
    }),

    conversationOutcomes: z.object({
        agreedActions: z.array(z.string()).describe("Actions or next steps agreed upon in the conversation"),
        keyDecisions: z.array(z.string()).describe("Key decisions made during the call"),
        openQuestions: z.array(z.string()).describe("Questions that remain unanswered or need follow-up"),
        clientConcerns: z.array(z.string()).describe("Any concerns or hesitations the client expressed"),
    }),

    budget: z.object({
        mentioned: z.boolean().describe("Whether budget was discussed"),
        range: z.string().optional().describe("Budget range if mentioned"),
        constraints: z.string().optional().describe("Any budget constraints or considerations"),
    }),

    stakeholders: z.array(z.object({
        name: z.string().optional().describe("Name if mentioned"),
        role: z.string().describe("Role or title"),
        involvement: z.string().describe("How they're involved in the decision/project"),
    })).describe("Key stakeholders mentioned in the conversation"),

    suggestedPlanTitle: z.string().describe("Suggested title for the marketing plan"),
    executiveSummary: z.string().describe("A 3-4 sentence executive summary of the conversation and what needs to be done"),
})

export async function POST(request: Request) {
    try {
        const { transcript } = await request.json()

        if (!transcript || typeof transcript !== "string") {
            return Response.json({ error: "Transcript is required" }, { status: 400 })
        }

        console.log("[v0] Extracting transcript summary with Gemini 3 Pro, length:", transcript.length)

        const result = await generateObjectGemini<z.infer<typeof transcriptSummarySchema>>({
            schema: transcriptSummarySchema,
            maxTokens: 16000,
            prompt: `You are an expert marketing consultant analyzing a discovery call or meeting transcript. Extract a comprehensive summary of the conversation to provide context for creating a marketing plan.

## TRANSCRIPT:
${transcript}

## CRITICAL INSTRUCTIONS:

You MUST extract information for ALL sections below. If something is not explicitly stated, INFER it from context. Do NOT leave fields empty - always provide your best interpretation based on the conversation.

### 1. Company Information:
- Extract the company/client name (look for how they introduce themselves or are addressed)
- Determine their industry from what they discuss
- Infer company size/stage from context (startup launching, established business, etc.)
- Write a clear description of what they do

### 2. Customer Needs (REQUIRED - extract at least 3-5):
- List ALL specific needs, pain points, or problems expressed or implied
- Include EXACT quotes from the client for each need (word-for-word from transcript)
- Rate priority based on how much emphasis/time spent on each (high/medium/low)
- Even if not explicitly stated, infer needs from the problems they describe

### 3. Objectives (REQUIRED - NEVER say "Not specified"):
- **PRIMARY GOAL**: What is the main thing they want to achieve? Infer from what they're asking for help with.
  Examples: "Launch their brand successfully", "Generate more leads", "Build brand awareness", "Increase sales", "Establish market presence"
- **Secondary Goals**: Additional outcomes they mentioned or implied
- **Success Metrics**: How will they know it worked? (Even if not stated, infer logical metrics)
- Timeline: Any dates, timeframes, or deadlines mentioned (e.g., "launching in 3 months")

### 4. Current State:
- What do they currently have in place?
- What challenges/problems do they face?
- What has worked for them before?
- What hasn't worked or they've tried and failed?

### 5. Conversation Outcomes (REQUIRED - extract at least 2-3 for each):
- **Agreed Actions**: What will happen next? What did the consultant agree to do? What deliverables were discussed?
  Examples: "Create a website", "Develop brand identity", "Set up CRM", "Create marketing materials"
- **Key Decisions**: What was decided during the conversation?
- **Open Questions**: What needs more clarification or follow-up?
- **Client Concerns**: Any hesitations, worries, or concerns expressed (about budget, timeline, approach, etc.)

### 6. Budget:
- Was budget or cost discussed at all?
- Any specific numbers, ranges, or constraints mentioned?

### 7. Stakeholders (REQUIRED - always include at least the meeting participants):
- Who was on the call? Include ALL participants (infer from who is speaking: "I", "we", the consultant, etc.)
- Who else is involved in the decision or project? (other team members mentioned, decision makers, etc.)
- At minimum, identify "Client Representative" and "Consultant" as stakeholders
- For each stakeholder: name (if mentioned), role (required), and their involvement (what they'll contribute or decide)

### 8. Executive Summary:
- Write 3-4 sentences summarizing: who the client is, what they need, and what outcome they want

### 9. Suggested Plan Title:
- Create a professional title like "Marketing Plan for [Company Name]" or "[Company Name] Brand Launch Strategy"

IMPORTANT: 
- NEVER return empty arrays - always provide at least inferred items
- NEVER say "Not specified" - always infer from context
- Use EXACT quotes from the transcript when possible
- Be thorough - this summary will guide the entire marketing plan`,
        })

        console.log("[v0] Transcript summary extracted successfully")

        return Response.json(result.object)
    } catch (error) {
        console.error("[v0] Error extracting transcript summary:", error)
        return Response.json(
            { error: error instanceof Error ? error.message : "Failed to extract transcript summary" },
            { status: 500 },
        )
    }
}

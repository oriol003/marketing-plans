import { generateObjectGemini, generateObjectGeminiFlash } from "@/lib/ai"
import { z } from "zod"

const STANDARD_CATEGORIES = [
  "Brand Identity & Design",
  "Messaging & Strategy",
  "Website Design",
  "Website Development",
  "Content Marketing",
  "Social Media",
  "Email & CRM",
  "SEO & Analytics",
  "Advertising & Paid Media",
  "Sales Collateral",
  "Events & PR",
  "Video Production",
] as const

// Stage 1: Outline extraction schema (Gemini Pro - handles long context)
const outlineSchema = z.object({
  clientName: z.string().describe("The client or company name mentioned in the transcript"),
  planTitle: z.string().describe("A suggested title for the marketing plan"),
  objective: z.string().describe("The main objective or goal discussed in the transcript"),
  tacticOutlines: z.array(z.object({
    title: z.string().describe("A concise, action-oriented title for the tactic"),
    briefDescription: z.string().describe("A 1-sentence summary of what this tactic involves"),
    category: z.enum(STANDARD_CATEGORIES).describe("Category of the tactic"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority based on client emphasis: high=urgent/critical, medium=important, low=nice-to-have"),
    clientQuote: z.string().describe("EXACT direct quote from the CLIENT (not consultant) that supports or requests this tactic. Must be verbatim from transcript."),
    quoteContext: z.string().describe("Brief context about when/why the client said this"),
  })).describe("List of ALL tactic outlines extracted from the transcript - no limit"),
})

// Stage 2: Elaboration schema (Gemini Flash - fast, adds details and confidence)
const elaborationSchema = z.object({
  description: z.string().describe("A detailed 2-3 sentence description of the tactic"),
  deliverable: z.string().describe("The SPECIFIC deliverable or output - be concrete (e.g., '10 social media posts', 'Landing page with lead capture form', '30-second video ad')"),
  what: z.string().describe("What exactly will be created or done"),
  why: z.string().describe("Strategic reasoning - why this tactic matters for the client based on what they said"),
  how: z.string().describe("Brief execution steps or approach"),
  estimatedHours: z.number().describe("Realistic hours: Strategy/planning=4-8h, Design deliverable=8-18h, Website design=16-24h, Website dev=30-50h, Simple content=2-4h"),
  confidence: z.number().min(1).max(100).describe("Confidence score 1-100 that this tactic should be in the plan"),
  confidenceReason: z.string().describe("Brief explanation of the confidence score"),
  canBeDivided: z.boolean().describe("True if this tactic could be split into multiple smaller deliverables"),
  suggestedSubTactics: z.array(z.string()).optional().describe("If canBeDivided is true, list 2-4 specific sub-deliverables this could be split into"),
})

export async function POST(request: Request) {
  try {
    const { transcript, summaryContext, excludeTactics = [], findMore = false, skipElaboration = false } = await request.json()

    if (!transcript || typeof transcript !== "string") {
      return Response.json({ error: "Transcript is required" }, { status: 400 })
    }

    console.log("[v0] Stage 1: Extracting tactic outlines with Gemini 3 Pro, length:", transcript.length)
    console.log("[v0] Summary context provided:", !!summaryContext)
    console.log("[v0] Excluding tactics:", excludeTactics.length, "Find more mode:", findMore)

    // Helper to safely join arrays or strings
    const safeJoin = (value: any, separator = ', ') => {
      if (!value) return 'Not specified'
      if (Array.isArray(value)) return value.join(separator) || 'Not specified'
      if (typeof value === 'string') return value
      return 'Not specified'
    }

    // Build context from summary if provided
    const summaryInstructions = summaryContext ? `
## CLIENT CONTEXT (from discovery summary):
**Company:** ${summaryContext.companyInfo?.name || 'Unknown'} - ${summaryContext.companyInfo?.description || ''}
**Industry:** ${summaryContext.companyInfo?.industry || 'Unknown'}

**Primary Objective:** ${summaryContext.objectives?.primaryGoal || 'Not specified'}
**Secondary Goals:** ${safeJoin(summaryContext.objectives?.secondaryGoals)}
**Success Metrics:** ${safeJoin(summaryContext.objectives?.successMetrics)}

**Key Customer Needs:**
${Array.isArray(summaryContext.customerNeeds) ? summaryContext.customerNeeds.map((n: any) => `- [${n.priority?.toUpperCase() || 'MEDIUM'}] ${n.need}`).join('\n') : 'None specified'}

**Current Challenges:**
${safeJoin(summaryContext.currentState?.challenges, '\n- ')}

**Agreed Actions:**
${safeJoin(summaryContext.conversationOutcomes?.agreedActions, '\n- ')}

Use this context to ensure extracted tactics align with the client's stated needs and objectives.
` : ''

    const excludeInstructions =
      excludeTactics.length > 0
        ? `
## ALREADY EXTRACTED TACTICS (DO NOT DUPLICATE):
${excludeTactics.map((t: string) => `- ${t}`).join("\n")}

IMPORTANT: Do NOT suggest any tactics similar to the ones listed above. Look for NEW, DIFFERENT tactics.
`
        : ""

    const findMoreInstructions = findMore
      ? `
## SPECIAL INSTRUCTIONS - FIND MORE MODE:
Look DEEPER into the transcript for subtle mentions, implied needs, or secondary initiatives.
Consider adjacent opportunities that weren't explicitly stated but would benefit the client.
Think about supporting tactics that would enhance the already-extracted ones.
Look for infrastructure, tracking, or foundational work that was implied but not stated.
`
      : ""

    // Stage 1: Extract outlines using Gemini Pro (better for long context)
    const outlineResult = await generateObjectGemini<z.infer<typeof outlineSchema>>({
      schema: outlineSchema,
      maxTokens: 32000,
      prompt: `You are an expert marketing consultant analyzing a discovery call or meeting transcript. Extract ALL actionable marketing tactics that were discussed or implied.
${summaryInstructions}
## TRANSCRIPT:
${transcript}
${excludeInstructions}
${findMoreInstructions}

## CRITICAL INSTRUCTIONS:

1. **Identify Client Information:**
   - Extract the client or company name
   - Determine the main marketing objective or challenge
   - Suggest an appropriate plan title

2. **Extract EVERY Tactic Mentioned:**
   - There is NO LIMIT on the number of tactics - extract ALL of them
   - Include explicitly requested items AND implied needs
   - Break down large initiatives into specific tactics when possible
   - Extract 10-30+ tactics if the transcript warrants it

3. **For Each Tactic, Capture:**
   - **Title:** Clear, specific, action-oriented (e.g., "Design Event Booth Graphics", "Write Email Welcome Sequence")
   - **Brief Description:** One sentence summary
   - **Category:** MUST be exactly one of: Digital Marketing, Content & Creative, SEO & Analytics, Social Media, Advertising, Brand & Strategy, Events & PR, Website & Tech
   - **Client Quote:** THE EXACT WORDS the CLIENT said that relate to this tactic. Look for:
     * Direct requests ("We need...", "I want...", "Can you do...")
     * Pain points ("Our problem is...", "We struggle with...")
     * Goals ("We want to achieve...", "The goal is...")
     * Concerns ("I'm worried about...", "We tried X but...")
   - **Quote Context:** When/why they said it

4. **Evidence Requirements:**
   - EVERY tactic MUST have a direct CLIENT quote (not consultant speaking)
   - If timestamps are available, include them: "[12:45] Client: 'exact quote'"
   - The quote must be VERBATIM from the transcript
   - If no direct quote exists for an implied tactic, use the closest related client statement

Return comprehensive analysis with ALL extracted tactics - the more specific, the better.`,
    })

    console.log("[v0] Stage 1 complete. Extracted", outlineResult.object.tacticOutlines.length, "tactic outlines")

    if (skipElaboration) {
      // Return basic tactics without elaboration for faster iteration
      const basicTactics = outlineResult.object.tacticOutlines.map((outline) => ({
        title: outline.title,
        description: outline.briefDescription,
        deliverable: outline.briefDescription,
        what: outline.briefDescription,
        why: "To be determined based on client goals",
        how: "Execution approach to be defined",
        evidence: outline.clientQuote,
        evidenceContext: outline.quoteContext,
        category: outline.category,
        priority: outline.priority,
        estimatedHours: 8,
        confidence: 70,
        confidenceReason: "Pending full analysis",
        canBeDivided: false,
        suggestedSubTactics: [],
      }))

      return Response.json({
        clientName: outlineResult.object.clientName,
        planTitle: outlineResult.object.planTitle,
        objective: outlineResult.object.objective,
        tactics: basicTactics,
      })
    }

    // Stage 2: Elaborate each tactic with Gemini Flash (fast, adds confidence)
    console.log("[v0] Stage 2: Elaborating tactics with Gemini 3 Flash")

    const elaboratedTactics = await Promise.all(
      outlineResult.object.tacticOutlines.map(async (outline, index) => {
        console.log(`[v0] Elaborating tactic ${index + 1}/${outlineResult.object.tacticOutlines.length}: ${outline.title}`)

        const elaboration = await generateObjectGeminiFlash<z.infer<typeof elaborationSchema>>({
          schema: elaborationSchema,
          maxTokens: 2000,
          prompt: `You are a marketing strategist. Elaborate on this marketing tactic and assess its fit for the plan.

## CLIENT CONTEXT:
- Client: ${outlineResult.object.clientName}
- Objective: ${outlineResult.object.objective}

## TACTIC TO ELABORATE:
- Title: ${outline.title}
- Category: ${outline.category}
- Brief: ${outline.briefDescription}
- Client said: "${outline.clientQuote}"
- Context: ${outline.quoteContext}

## INSTRUCTIONS:
1. Write a detailed description (2-3 sentences)
2. Define the SPECIFIC deliverable - be very concrete:
   - BAD: "Marketing materials"
   - GOOD: "5 branded flyers (8.5x11), 2 pull-up banners, 1 event backdrop (10x8ft)"
3. Explain what exactly will be created (What)
4. Explain strategic value based on what the client said (Why)
5. Outline execution approach (How)
6. Estimate REALISTIC hours using these guidelines:
   - Strategy/planning documents: 4-8 hours
   - Messaging strategy: 6-10 hours
   - Brand voice/guidelines: 8-12 hours  
   - Logo design: 8-16 hours
   - Website design (mockups): 16-24 hours
   - Website development: 30-50 hours
   - Simple content (1 flyer, 1 page): 2-4 hours
   - Social media content (per month): 8-12 hours
   - Email template: 3-6 hours
   - Video production (30s-2min): 12-24 hours
7. Rate CONFIDENCE (1-100):
   - 90-100: Explicitly requested by client
   - 70-89: Strongly implied or clearly needed
   - 50-69: Good to have, inferred from context
   - 30-49: Optional enhancement
   - 1-29: Tangentially related
8. Determine if this tactic is large enough to be DIVIDED into sub-deliverables
9. If divisible, suggest 2-4 specific sub-tactics`,
        })

        return {
          title: outline.title,
          description: elaboration.object.description,
          deliverable: elaboration.object.deliverable,
          what: elaboration.object.what,
          why: elaboration.object.why,
          how: elaboration.object.how,
          evidence: outline.clientQuote,
          evidenceContext: outline.quoteContext,
          category: outline.category,
          priority: outline.priority,
          estimatedHours: elaboration.object.estimatedHours,
          confidence: elaboration.object.confidence,
          confidenceReason: elaboration.object.confidenceReason,
          canBeDivided: elaboration.object.canBeDivided,
          suggestedSubTactics: elaboration.object.suggestedSubTactics || [],
        }
      })
    )

    // Sort by confidence (highest first)
    elaboratedTactics.sort((a, b) => b.confidence - a.confidence)

    console.log("[v0] Stage 2 complete. All", elaboratedTactics.length, "tactics elaborated with confidence scores")

    return Response.json({
      clientName: outlineResult.object.clientName,
      planTitle: outlineResult.object.planTitle,
      objective: outlineResult.object.objective,
      tactics: elaboratedTactics,
    })
  } catch (error) {
    console.error("[v0] Error extracting tactics:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to extract tactics" },
      { status: 500 },
    )
  }
}

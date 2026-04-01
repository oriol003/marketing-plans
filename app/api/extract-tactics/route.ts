import { generateObjectGemini, generateObjectGeminiFlash, generateObjectClaude } from "@/lib/ai"
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

// Stage 1: Raw extraction schema (Gemini Pro - handles long context)
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

// Stage 1.5: Decomposition schema (Claude Opus - deep thinking about structure)
const decompositionSchema = z.object({
  tactics: z.array(z.object({
    title: z.string().describe("Tactic title - specific and singular (e.g., 'Meta Ads Campaign' not 'Meta & Google Ads Campaign')"),
    briefDescription: z.string().describe("1-sentence summary of this specific tactic"),
    category: z.enum(STANDARD_CATEGORIES).describe("Category"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority level"),
    clientQuote: z.string().describe("The supporting client quote"),
    quoteContext: z.string().describe("Context for the quote"),
    phaseOf: z.string().optional().describe("If this is a sub-tactic, the name of the parent initiative it belongs to"),
    phaseNumber: z.number().optional().describe("Order within the phase (1, 2, 3...)"),
  })),
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

    console.log("[v0] Stage 1: Extracting tactic outlines, length:", transcript.length)

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
   - **Category:** MUST be exactly one of: ${STANDARD_CATEGORIES.join(', ')}
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

    // Stage 1.5: Use Claude Opus to decompose bundled tactics into phases
    // This catches things like "Meta & Google Ads Campaign" → separate Meta and Google tactics
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    let decomposedTactics = outlineResult.object.tacticOutlines

    if (hasAnthropicKey) {
      console.log("[v0] Stage 1.5: Decomposing bundled tactics into phases")

      try {
        // Build a lookup map so Claude's output can reference original quotes by index
        const tacticList = outlineResult.object.tacticOutlines
          .map((t, i) => `${i + 1}. "${t.title}" — ${t.briefDescription} [${t.category}]\n   Client quote: "${t.clientQuote}"`)
          .join('\n\n')

        const decomposition = await generateObjectClaude<z.infer<typeof decompositionSchema>>({
          schema: decompositionSchema,
          maxTokens: 16000,
          temperature: 0.2,
          systemPrompt: `You are a senior marketing strategist who structures marketing plans into clean, actionable campaigns and phases.

Your job is to review extracted marketing tactics and:
1. Identify the BIG CAMPAIGNS or INITIATIVES (e.g., "Event Attendee Acquisition Campaign", "Competitor Market Expansion Campaign")
2. Decompose bundled tactics into focused, single-platform/single-deliverable tactics
3. Group related tactics under their parent campaign using the phaseOf field

Think about it like this: a marketing plan has CAMPAIGNS (big strategic initiatives aimed at a specific audience or goal). Each campaign has TACTICS (the specific channels, creatives, and deliverables that execute the campaign).`,
          prompt: `## CLIENT: ${outlineResult.object.clientName}
## OBJECTIVE: ${outlineResult.object.objective}

## EXTRACTED TACTICS TO REVIEW:
${tacticList}

## YOUR TASK:

### Step 1: Identify Campaigns
Look at the tactics and identify the major campaigns/initiatives. A campaign is defined by:
- A distinct TARGET AUDIENCE (e.g., "event attendees" vs "out-of-valley competitors")
- A distinct STRATEGIC GOAL (e.g., "drive event attendance" vs "expand geographic reach")
- Multiple tactics that serve the same audience+goal should be grouped under ONE campaign

### Step 2: Decompose & Group
For each tactic:
- **Split multi-platform tactics:** "Meta and Google Display campaign" → separate "Meta Ads" + "Google Display Ads" tactics
- **Split multi-deliverable tactics:** "ad creatives, landing pages, and dashboard" → separate focused tactics
- **Preserve single-focus tactics:** Don't over-split. "Design 5 Instagram carousels" is fine as one tactic.
- **Assign phaseOf:** Set this to the CAMPAIGN NAME that this tactic belongs to (e.g., "Event Attendee Acquisition Campaign"). Tactics that aren't part of a specific campaign can omit this.
- **Assign phaseNumber:** Order within the campaign (strategy first, then creative, then execution, then measurement)

### Step 3: Preserve Evidence
- **CRITICAL: Copy the clientQuote EXACTLY as shown above.** Do not summarize, rephrase, or abbreviate. If you split a tactic, all resulting sub-tactics get the SAME original quote verbatim.
- The quoteContext should also be preserved from the original.

### Naming Guidelines:
- Campaign names should be descriptive: "Event Attendee Digital Campaign" not just "Campaign 1"
- Tactic titles should be specific: "Meta Ads Campaign for Event Attendees" not "Social Media Advertising"
- Include the audience or goal context in titles when relevant

Return the complete list of tactics. Total count will be >= the original count.`,
        })

        // Post-process: ensure client quotes are preserved from originals
        // Claude may have shortened them, so map back to originals where possible
        const originalQuoteMap = new Map(
          outlineResult.object.tacticOutlines.map(t => [t.title.toLowerCase(), t.clientQuote])
        )

        decomposedTactics = decomposition.object.tactics.map(t => {
          // If the quote looks truncated or is very short, try to find the original
          const originalQuote = originalQuoteMap.get(t.title.toLowerCase())
          const quote = (t.clientQuote && t.clientQuote.length > 10)
            ? t.clientQuote
            : originalQuote || t.clientQuote

          return { ...t, clientQuote: quote }
        })

        console.log("[v0] Stage 1.5 complete. Decomposed to", decomposedTactics.length, "tactics (from", outlineResult.object.tacticOutlines.length, ")")
      } catch (error) {
        console.error("[v0] Stage 1.5 failed, using original tactics:", error)
        // Fall through to use original tactics
      }
    } else {
      console.log("[v0] Stage 1.5 skipped: No ANTHROPIC_API_KEY configured")
    }

    if (skipElaboration) {
      const basicTactics = decomposedTactics.map((outline) => ({
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
        phaseOf: outline.phaseOf || undefined,
        phaseNumber: outline.phaseNumber || undefined,
      }))

      return Response.json({
        clientName: outlineResult.object.clientName,
        planTitle: outlineResult.object.planTitle,
        objective: outlineResult.object.objective,
        tactics: basicTactics,
      })
    }

    // Stage 2: Elaborate each tactic with Gemini Flash (fast, adds confidence)
    console.log("[v0] Stage 2: Elaborating", decomposedTactics.length, "tactics")

    const elaboratedTactics = await Promise.all(
      decomposedTactics.map(async (outline, index) => {
        console.log(`[v0] Elaborating tactic ${index + 1}/${decomposedTactics.length}: ${outline.title}`)

        const phaseContext = outline.phaseOf
          ? `\n- Part of initiative: "${outline.phaseOf}" (phase ${outline.phaseNumber || '?'})`
          : ''

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
- Context: ${outline.quoteContext}${phaseContext}

## INSTRUCTIONS:
1. Write a detailed description (2-3 sentences)
2. Define the SPECIFIC deliverable - be very concrete and focused on THIS tactic only:
   - BAD: "Marketing materials" or "Meta and Google ad creatives"
   - GOOD: "5 Meta carousel ads targeting event attendees within 50-mile radius"
   - Each deliverable should be for ONE platform or ONE type of output
3. Explain what exactly will be created (What)
4. Explain strategic value based on what the client said (Why)
5. Outline execution approach (How)
6. Estimate REALISTIC hours for THIS SPECIFIC tactic (not the whole initiative):
   - Strategy/planning documents: 4-8 hours
   - Messaging strategy: 6-10 hours
   - Brand voice/guidelines: 8-12 hours
   - Logo design: 8-16 hours
   - Website design (mockups): 16-24 hours
   - Website development: 30-50 hours
   - Simple content (1 flyer, 1 page): 2-4 hours
   - Social media content (per month): 8-12 hours
   - Ad campaign setup (single platform): 6-12 hours
   - Landing page design + dev: 8-16 hours
   - Email template: 3-6 hours
   - Video production (30s-2min): 12-24 hours
   - Performance reporting setup: 4-8 hours
7. Rate CONFIDENCE (1-100):
   - 90-100: Explicitly requested by client
   - 70-89: Strongly implied or clearly needed
   - 50-69: Good to have, inferred from context
   - 30-49: Optional enhancement
   - 1-29: Tangentially related
8. Determine if this tactic can be further divided (should be rare since we already decomposed)
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
          phaseOf: outline.phaseOf || undefined,
          phaseNumber: outline.phaseNumber || undefined,
        }
      })
    )

    // Sort by confidence (highest first), then group by phase
    elaboratedTactics.sort((a, b) => {
      // Group phases together
      if (a.phaseOf && b.phaseOf && a.phaseOf === b.phaseOf) {
        return (a.phaseNumber || 0) - (b.phaseNumber || 0)
      }
      return b.confidence - a.confidence
    })

    console.log("[v0] Stage 2 complete. All", elaboratedTactics.length, "tactics elaborated")

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

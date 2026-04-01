import { generateTextGemini } from "@/lib/ai"
import { getTacticTemplates } from "@/lib/db/tactic-templates"
import { createServerClient } from "@/lib/supabase/server"
import { suggestIconForTactic } from "@/lib/utils"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { unstructuredContext, clientName, objective, referenceIds } = await req.json()

    if (!unstructuredContext?.trim()) {
      return Response.json({ error: "Context is required" }, { status: 400 })
    }

    let referencesContext = ""
    if (referenceIds && Array.isArray(referenceIds) && referenceIds.length > 0) {
      const supabase = await createServerClient()
      const { data: references, error } = await supabase
        .from("plan_references")
        .select("title, content")
        .eq("plan_id", id)
        .in("id", referenceIds)
        .order("order")

      if (!error && references && references.length > 0) {
        referencesContext =
          "\n\nAdditional Reference Materials:\n" +
          references.map((ref) => `\n${ref.title}:\n${ref.content}`).join("\n\n")
      }
    }

    // Fetch available tactic templates
    const tacticTemplates = await getTacticTemplates()
    const templateList = tacticTemplates
      .map((t) => `- ${t.name}: ${t.description} (${t.category}, ${t.defaultHours}h, ${t.defaultDuration} days)`)
      .join("\n")

    // Switched to Gemini 3 Pro Preview with reasoning capabilities and increased max tokens
    const { text: structuredPlan } = await generateTextGemini({
      maxTokens: 32000, // Max tokens for comprehensive output
      enableThinking: true, // Enable reasoning
      prompt: `You are a marketing plan architect following CODESM's proven methodology. Parse the following unstructured marketing plan context into a structured JSON outline.

Client: ${clientName || "Unknown Client"}
Objective: ${objective || "Not specified"}

Unstructured Context:
${unstructuredContext}${referencesContext}

Available Tactic Templates:
${templateList}

**CODESM STANDARD PHASE CATEGORIES:**
Marketing plans should be organized into these logical phases (use as section titles):
1. Develop Communication Strategy - Competitor Analysis, Target Audience Research, Messaging Strategy, Value Proposition
2. Create Marketing Collateral - Sales Deck, Explainer Video, Product Sheets, Brochures, Stationery
3. Website Design - Information Architecture, UI/UX Design, Copywriting, Development, QA
4. Search Engine Optimization (SEO) - Keyword Research, On-Site SEO, Search Console Setup
5. Content Marketing - Blog Strategy, Whitepapers, Case Studies, Content Calendar
6. Social Media Setup - Platform Setup, Content Strategy, Branding, Profile Optimization
7. Direct Marketing - CRM Setup, Email Marketing, Lead Nurture Sequences
8. Tracking and Analytics - Google Analytics, Tag Manager, Call Tracking, Form Tracking
9. Reputation Management - Review Monitoring, Citation Campaigns
10. Digital Advertising - Google Ads, Meta Ads, LinkedIn Ads, Display Ads
11. Conversion Optimization - Automation, Landing Pages, Lead Scoring

**TACTIC STRUCTURE (What/Why/How):**
Each tactic should follow this format when generating content:
- **What:** Clear description of the deliverable (be specific - "4-6 product one-pagers" not "marketing materials")
- **Why:** Strategic rationale connecting to business outcomes
- **How:** Implementation approach and methodology

CRITICAL: Create a COMPREHENSIVE and DETAILED outline. Do NOT summarize or condense the information.
The user has provided extensive context - use ALL of it to create a thorough, complete marketing plan outline.

CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON - no markdown, no code blocks, no explanations
- DO NOT include trailing commas before closing braces or brackets
- Ensure all strings are properly escaped
- Double-check your JSON is valid before responding

CRITICAL INSTRUCTIONS FOR SOURCE CONTEXT:
The sourceContext field is EXTREMELY important. It will be used by AI to generate the full content later.
You MUST extract ALL relevant details from the unstructured context and include them in the sourceContext.
BE THOROUGH - include 5-10 sentences of detailed context for each block.

For each block's sourceContext, include:
- Specific goals, metrics, or KPIs mentioned in the context
- Target audiences or demographics
- Key messages or value propositions
- Budget information if available
- Timeline details or phases
- Specific deliverables or assets to create
- Channel-specific details (platforms, formats, etc.)
- Any creative direction or brand guidelines
- Success criteria or expected outcomes
- Dependencies or prerequisites
- Technical requirements or specifications
- Messaging frameworks and key talking points
${referencesContext ? "- Relevant insights from the provided reference materials" : ""}

Example of EXCELLENT sourceContext (this is the level of detail required):
"Create comprehensive Google Ads campaign targeting homeowners aged 35-55 in the Dallas metro area with household income over $150K. Focus on luxury home renovation services with emphasis on kitchen and bathroom remodels. Monthly budget: $5,000 with $3,000 allocated to search ads and $2,000 to display remarketing. Key metrics: CPL under $50, 30+ qualified leads/month, ROAS of 4:1. Ad copy should highlight 20+ years experience, licensed contractors, luxury materials like Italian marble and custom cabinetry, and white-glove service. Include retargeting for website visitors who spent 2+ minutes on service pages and form abandoners. Landing pages should feature before/after galleries, client testimonials, and free consultation CTAs. Implement conversion tracking for form submissions and phone calls."

Instructions:
1. Create a COMPREHENSIVE structured plan - don't leave anything out from the provided context
2. Break down the plan into multiple sections with multiple tactics each
3. Match tactics to available templates when possible (use the template ID)
4. For tactics that don't match templates, create custom tactics with appropriate hours (5-40h) and duration (3-30 days)
5. Organize tactics into logical campaign sections
6. Extract and include ALL relevant details in the sourceContext for each block (minimum 5-10 sentences)
7. Create as many blocks as needed to cover all the information provided - DO NOT condense or summarize
${referencesContext ? "8. Incorporate ALL insights and information from the provided reference materials where relevant" : ""}

Return ONLY valid JSON in this exact format (NO TRAILING COMMAS):
{
  "blocks": [
    {
      "type": "section",
      "title": "Campaign Section Name",
      "sourceContext": "Comprehensive overview with 5+ sentences covering what this campaign section aims to achieve, including detailed goals, specific target audience characteristics, key strategies with tactical details, budget allocation, timeline expectations, dependencies, and expected outcomes with measurable KPIs.",
      "children": [
        {
          "type": "tactic",
          "title": "Specific Tactic Name",
          "sourceContext": "Highly detailed context with 5-10 sentences including specific deliverables with quantities and formats, target metrics with numerical goals, creative requirements with style guidelines, platforms and technical specifications, budget allocation breakdown, messaging strategy with key talking points, success criteria with measurement methods, timeline with milestones, dependencies and prerequisites, and any special considerations or constraints.",
          "templateId": null,
          "hours": 15,
          "duration": 14,
          "startDate": "2025-01-15",
          "endDate": "2025-01-29"
        }
      ]
    },
    {
      "type": "text",
      "title": "Introduction",
      "sourceContext": "Detailed 5+ sentence explanation of what should be covered: comprehensive company background with history and mission, detailed market positioning with competitive differentiation, specific competitive advantages and unique value propositions, market analysis and target audience insights, and how this plan directly addresses stated business objectives with measurable outcomes."
    }
  ]
}

Rules:
- Use "section" type for campaign containers (group related tactics together)
- Use "tactic" type for marketing activities (be specific about each activity)
- Use "text" type for narrative/explanatory content blocks
- Include "templateId" only if you find an exact match from the available templates
- Provide COMPREHENSIVE, DETAILED sourceContext for every single block (5-10 sentences minimum)
- Extract ALL relevant information from the unstructured context - nothing should be left out
- Include specific numbers, metrics, deadlines, and requirements when available
- Keep structure logical and organized with multiple sections
- Create as many blocks as needed to capture all the information provided
- NEVER include trailing commas in your JSON output
- Remember: MORE DETAIL IS BETTER - the user wants comprehensive plans, not summaries`,
    })

    // Parse the AI response
    let parsedBlocks
    try {
      let jsonStr = structuredPlan.trim()

      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "")

      // Extract JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No JSON found in response")
      }

      jsonStr = jsonMatch[0]

      // Remove trailing commas before closing braces/brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1")

      parsedBlocks = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("[v0] Failed to parse AI response:", structuredPlan)
      console.error("[v0] Parse error:", parseError)
      return Response.json(
        { error: "Failed to parse AI response into structured format. Please try again." },
        { status: 500 },
      )
    }

    // Transform parsed blocks into proper Block objects with IDs
    const transformBlock = (block: any, order: number, parentId: string | null = null): any => {
      const baseBlock = {
        id: crypto.randomUUID(),
        order,
        parentId,
        title: block.title,
        sourceContext: block.sourceContext || "",
      }

      if (block.type === "section") {
        return {
          ...baseBlock,
          type: "section",
          icon: block.icon || suggestIconForTactic(block.title, block.sourceContext),
          children: (block.children || []).map((child: any, idx: number) => transformBlock(child, idx, baseBlock.id)),
        }
      }

      if (block.type === "tactic") {
        const template = block.templateId ? tacticTemplates.find((t) => t.id === block.templateId) : null

        const today = new Date()
        let startDate: Date
        let endDate: Date

        // If AI provided dates, use them
        if (block.startDate && block.endDate) {
          startDate = new Date(block.startDate)
          endDate = new Date(block.endDate)
        } else {
          // Otherwise, calculate dates based on order
          startDate = new Date(today)
          startDate.setDate(today.getDate() + order * 3)
          const duration = block.duration || template?.defaultDuration || 7
          endDate = new Date(startDate)
          endDate.setDate(startDate.getDate() + duration)
        }

        return {
          ...baseBlock,
          type: "tactic",
          tacticId: block.templateId || "",
          description: block.sourceContext || "",
          content: "",
          hours: block.hours || template?.defaultHours || 5,
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          icon: template?.icon || block.icon || suggestIconForTactic(block.title, block.sourceContext),
        }
      }

      return {
        ...baseBlock,
        type: "text",
        content: "",
      }
    }

    const transformedBlocks = parsedBlocks.blocks.map((block: any, idx: number) => transformBlock(block, idx))

    return Response.json({ blocks: transformedBlocks })
  } catch (error) {
    console.error("[v0] Error generating outline:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate outline" },
      { status: 500 },
    )
  }
}

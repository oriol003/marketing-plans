import { type NextRequest, NextResponse } from "next/server"
import { generateTextGemini } from "@/lib/ai"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params
    const body = await request.json()
    const {
      blockType = "tactic", // Added blockType to differentiate between tactic and text blocks
      tacticName,
      tacticDescription,
      clientName,
      objective,
      referenceIds = [],
      previousBlocks = [],
      upcomingBlocks = [],
      useHtml = false, // Added useHtml parameter to enable rich HTML generation
    } = body

    console.log("[v0] Generating block for:", tacticName, "Type:", blockType)
    console.log("[v0] Reference IDs provided:", referenceIds.length)
    console.log("[v0] Previous blocks:", previousBlocks.length)
    console.log("[v0] Upcoming blocks:", upcomingBlocks.length)

    let referenceContext = ""
    if (referenceIds.length > 0) {
      try {
        const referencesResponse = await fetch(`${request.nextUrl.origin}/api/plans/${planId}/references`)
        if (referencesResponse.ok) {
          const { references } = await referencesResponse.json()
          const selectedRefs = references.filter((ref: any) => referenceIds.includes(ref.id))

          if (selectedRefs.length > 0) {
            referenceContext =
              "\n\nREFERENCE MATERIALS:\n" +
              selectedRefs.map((ref: any) => `\n**${ref.title}**\n${ref.content}`).join("\n\n")
            console.log("[v0] Loaded", selectedRefs.length, "references for context")
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching references:", error)
      }
    }

    const previousContext =
      previousBlocks.length > 0
        ? "\n\nPREVIOUS SECTIONS ALREADY WRITTEN:\n" +
        previousBlocks
          .map((b: any) => `- ${b.title}: ${b.content?.substring(0, 200) || "No content yet"}...`)
          .join("\n")
        : ""

    const upcomingContext =
      upcomingBlocks.length > 0
        ? "\n\nUPCOMING SECTIONS (NOT YET WRITTEN):\n" + upcomingBlocks.map((b: any) => `- ${b.title}`).join("\n")
        : ""

    const isTactic = blockType === "tactic"

    const htmlInstructions = useHtml
      ? `

**HTML MODE ENABLED - RICH LAYOUT CAPABILITIES:**
You can create visually stunning, card-based layouts with custom styling. Use these capabilities:

**AVAILABLE STYLING OPTIONS:**
- Cards and containers with borders, shadows, and rounded corners
- Icon elements using Unicode symbols or SVG paths
- Color-coded sections and accent colors
- Flexbox and Grid layouts for sophisticated designs
- Tables with styled headers and rows
- Badge/pill elements for tags or categories
- Gradient backgrounds and visual hierarchy
- Callout boxes, highlight sections, and info panels

**TYPOGRAPHY & FORMATTING:**
- Use standard HTML heading tags (<h2>, <h3>, <h4>)
- Use semantic tags like <strong>, <em>, <mark> for emphasis
- Maintain readable font sizes (14-16px body text)
- Keep line-height between 1.5-1.7 for readability

**EXAMPLE HTML PATTERNS YOU CAN USE:**

<!-- Card Layout -->
<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
  <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Card Title</h3>
  <p style="color: #6b7280; line-height: 1.6;">Card content here...</p>
</div>

<!-- Info Panel with Icon -->
<div style="display: flex; gap: 12px; padding: 16px; background: linear-gradient(to right, #eff6ff, #ffffff); border-left: 4px solid #3b82f6; border-radius: 6px; margin: 16px 0;">
  <div style="font-size: 24px;">💡</div>
  <div>
    <strong style="color: #1e40af;">Key Insight</strong>
    <p style="margin: 4px 0 0 0; color: #4b5563;">Your insight content here...</p>
  </div>
</div>

<!-- Grid Layout -->
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 16px 0;">
  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
    <h4 style="margin: 0 0 8px 0; color: #1f2937;">Item 1</h4>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Description...</p>
  </div>
  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
    <h4 style="margin: 0 0 8px 0; color: #1f2937;">Item 2</h4>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Description...</p>
  </div>
</div>

<!-- Timeline/Steps -->
<div style="position: relative; padding-left: 32px; border-left: 2px solid #e5e7eb; margin: 20px 0;">
  <div style="position: absolute; left: -9px; top: 4px; width: 16px; height: 16px; border-radius: 50%; background: #3b82f6; border: 3px solid white;"></div>
  <h4 style="margin: 0 0 8px 0; color: #1f2937;">Step 1</h4>
  <p style="margin: 0 0 24px 0; color: #6b7280;">Step description...</p>
</div>

<!-- Styled Table -->
<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
  <thead>
    <tr style="background: linear-gradient(to right, #f9fafb, #f3f4f6);">
      <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Column</th>
      <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-top: 1px solid #e5e7eb;">
      <td style="padding: 12px; color: #1f2937;">Data</td>
      <td style="padding: 12px; color: #1f2937;">Data</td>
    </tr>
  </tbody>
</table>

<!-- Badge/Tag -->
<span style="display: inline-block; padding: 4px 12px; background: #eff6ff; color: #1e40af; border-radius: 12px; font-size: 13px; font-weight: 500; margin-right: 8px;">Tag</span>

**IMPORTANT RULES:**
- Use inline styles only (no <style> tags or external CSS)
- Keep colors professional: grays (#1f2937, #6b7280), blues (#3b82f6), greens (#10b981)
- Ensure all text is readable (min 14px font size)
- Use proper spacing (padding, margins) for visual breathing room
- Create visual hierarchy with font sizes and weights
- Make layouts responsive-friendly (avoid fixed widths where possible)

**BE CREATIVE:** Combine these patterns to create engaging, professional layouts that make the content visually appealing while remaining easy to read and scan.
`
      : ""

    const prompt = isTactic
      ? `You are writing a professional marketing plan for ${clientName} following CODESM's proven methodology. This is ONE section of a larger, cohesive marketing proposal.

**MARKETING PLAN OBJECTIVE:**
${objective || "Not specified"}

**YOU ARE NOW WRITING THIS TACTIC:**
${tacticName}

**SOURCE CONTEXT FOR THIS TACTIC:**
${tacticDescription}
${referenceContext}
${previousContext}
${upcomingContext}
${htmlInstructions}

**CODESM TACTIC WRITING METHODOLOGY:**
Every tactic MUST follow the What/Why/How structure with these guidelines:

**What:** (2-3 sentences) - BE SPECIFIC about deliverables
- BAD: "Marketing materials"  
- GOOD: "4-6 product one-pagers (digital and PDF format) for different solutions and audience segments"
- BAD: "Content for the website"
- GOOD: "Compelling, conversion-focused website copy tailored to target audience pain points, highlighting USPs and incorporating relevant SEO keywords"

**Why:** (2-3 sentences) - CONNECT to business outcomes and strategic value
- BAD: "Because it's important"
- GOOD: "Prospects need clear reference materials as they evaluate solutions. These provide leave-behinds after calls and assets for email follow-up, ensuring your value proposition stays top-of-mind throughout the buying process."
- Use phrases like "This is critical because...", "This ensures that...", "Without this, [negative outcome]..."

**How:** (3-4 sentences) - EXPLAIN the methodology and process
- Include specific steps or approaches
- Reference the client's specific context
- Mention collaboration points with the client
- Use phrases like "We will execute...", "Our team will...", "The process includes..."

**WRITING STYLE GUIDELINES:**
- Professional but accessible - avoid jargon unless industry-specific
- Confident but not arrogant - use "We will" not "We might"
- Specific and concrete - include numbers, deliverables, timelines when possible
- Client-focused - use "Your business" not "our services"
- Use active voice throughout
- Be personalized to ${clientName}'s specific situation

**NARRATIVE FLOW:** 
- You're writing a CONTINUOUS marketing plan, not an isolated document
- Reference or build upon previous sections when relevant
- Maintain consistent tone and terminology with what's already been written
- Don't repeat information from previous sections

**FORMATTING:**
${useHtml
        ? `- Create a visually appealing HTML layout using cards, icons, styled sections
- Use the HTML patterns provided above for professional designs
- Maintain the What/Why/How structure but make it visually engaging
- Include visual elements like icons, colored accents, or info panels
- Ensure all text remains readable and professional`
        : `- Use "**What:**", "**Why:**", and "**How:**" as bold section labels
- Do NOT use markdown headings (no # symbols)
- Keep paragraphs concise and scannable`
      }

**OUTPUT REQUIREMENT:**
Generate the tactic content following the What/Why/How structure. Be specific, professional, and client-focused${useHtml ? " with rich HTML styling" : ""}.`
      : `You are writing a professional marketing plan for ${clientName}. This is ONE section of a larger, cohesive marketing proposal.

**MARKETING PLAN OBJECTIVE:**
${objective || "Not specified"}

**YOU ARE NOW WRITING THIS SECTION:**
${tacticName}

**SOURCE CONTEXT FOR THIS SECTION:**
${tacticDescription}
${referenceContext}
${previousContext}
${upcomingContext}
${htmlInstructions}

**CRITICAL INSTRUCTIONS:**
1. **Length**: Keep this section concise - aim for 2-3 paragraphs total
2. **Structure for TEXT sections**: Write a natural narrative flow (NO What/Why/How structure needed)
   - Start with an introduction that sets context
   - Develop the main ideas with specific details
   - Conclude with key takeaways or implications

3. **Narrative Flow**: 
   - You're writing a CONTINUOUS marketing plan, not an isolated document
   - Reference or build upon previous sections when relevant
   - Maintain consistent tone and terminology with what's already been written
   - Don't repeat information from previous sections
   - Lead naturally into upcoming sections when appropriate

4. **Writing Style**:
   - Professional and consultative tone
   - Specific and actionable (not generic)
   - Clear value propositions
   - Concrete details and examples
   - Client-focused language

**FORMATTING:**
${useHtml
        ? `- Create a visually appealing HTML layout using cards, tables, styled sections
- Use the HTML patterns provided above for professional designs  
- Make the content visually engaging with icons, colored accents, or info panels
- Ensure all text remains readable and professional
- Create visual hierarchy to make the content easy to scan`
        : `- Do NOT use markdown headings (no # symbols)
- Do NOT use bold labels like "What:", "Why:", "How:"
- Write in natural paragraph form
- Keep paragraphs concise and scannable`
      }

**OUTPUT REQUIREMENT:**
Generate 2-3 paragraphs with a natural narrative flow${useHtml ? " using rich HTML styling to make it visually compelling" : ""}.`

    const { text } = await generateTextGemini({
      prompt,
      maxTokens: 2000,
      temperature: 0.7,
    })

    console.log("[v0] Generated content for:", tacticName)
    console.log("[v0] Content length:", text.length, "characters")

    return NextResponse.json({ content: text })
  } catch (error: any) {
    console.error("[v0] Error generating block:", error)
    return NextResponse.json({ error: error.message || "Failed to generate content" }, { status: 500 })
  }
}

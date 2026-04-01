import { NextRequest, NextResponse } from "next/server"
import { generateTextGemini, generateObjectGeminiFlash } from "@/lib/ai"
import { z } from "zod"

// Schema for the orchestrator to decide what action to take
const orchestratorSchema = z.object({
    intent: z.enum([
        "answer_question",
        "edit_block",
        "add_section",
        "add_tactic",
        "delete_block",
        "confirm_action",
    ]).describe("The user's intent"),
    targetBlockId: z.string().optional().describe("The ID of the block to edit/delete, extracted from context"),
    confidence: z.number().min(0).max(100).describe("Confidence in the detected intent"),
    reasoning: z.string().describe("Brief explanation of why this intent was detected"),
    shouldExecute: z.boolean().describe("True if the user is asking to execute/apply the action, false if just discussing"),
})

// Style guide for plan sections - based on CODESM methodology
const PLAN_WRITING_GUIDE = `
## CODESM Marketing Plan Writing Guidelines

### Key Principles
1. **Personalization**: Every plan must be tailored to the specific client's industry, goals, and challenges
2. **Specificity**: Deliverables should be concrete and measurable, not vague
3. **Transparency**: Clients should understand exactly what they're getting and when
4. **Strategic Foundation**: Tactics should flow from strategy, not be random activities
5. **Hour Allocation**: All activities must fit within the client's monthly hour package

### Tone & Style
- Professional but accessible - avoid jargon unless industry-specific
- Confident but not arrogant - "We will" not "We might"
- Specific and concrete - numbers, deliverables, timelines
- Client-focused - "Your business" not "our services"
- Use active voice throughout

### Phase/Section Structure
Each phase should have:
1. **Phase Title**: Clear category name (e.g., "Develop Communication Strategy")
2. **Introduction**: 2-3 sentences explaining why this phase matters for this specific client
3. **Tactics**: Individual activities grouped under the phase

### Individual Tactic Structure (What/Why/How Format)
Every tactic MUST follow this structure:

**What:** (1-2 paragraphs)
[Describe what will be created/delivered - be SPECIFIC]
- Bad: "Marketing materials"
- Good: "4-6 product one-pagers (digital and PDF format) for different solutions and audience segments"

**Why:** (1-2 paragraphs)
[Explain the business value and strategic rationale - connect to outcomes]
- Bad: "Because it's important"
- Good: "Prospects need clear reference materials as they evaluate solutions. These provide leave-behinds after calls and assets for email follow-up, ensuring your value proposition stays top-of-mind throughout the buying process."

**How:** (1-2 paragraphs or bullet list)
[Explain the process/methodology - include collaboration points]
- Include specific steps or approaches
- Reference client-specific context from onboarding call
- Mention collaboration points with client

**Deliverable:** [Specific output description]
**Hours:** [Realistic hour estimate based on complexity]

### Common Phrases to Use
Opening a Phase:
- "Before executing any marketing tactics, we must establish..."
- "This phase focuses on creating..."
- "With a clear communication strategy in place, we will..."

Explaining Why:
- "This is critical because..."
- "Without this, [negative outcome]..."
- "This ensures that..."

Describing How:
- "We will execute the following..."
- "Our team will..."
- "The process includes..."

### Hour Guidelines by Tactic Type
- Research/Strategy: 2-6 hours
- Sales Deck: 6-12 hours
- Video Production: 8-14 hours
- Website Design: 9-18 hours
- Website Development: 12-27 hours
- SEO Implementation: 4-6 hours
- Content Piece: 4-8 hours
- Analytics Setup: 1-2 hours

### Standard Phase Categories
1. Develop Communication Strategy
2. Create Marketing Collateral
3. Website Design
4. Search Engine Optimization (SEO)
5. Content Marketing
6. Social Media Setup
7. Direct Marketing
8. Tracking and Analytics
9. Reputation Management
10. Digital Advertising
11. Conversion Optimization

### Audience Persona Fields
When creating audiences, include:
- Name (descriptive title)
- Description (1-2 sentence summary)
- Demographics (age, location, job role)
- Frustrations (3-5 pain points)
- Desires (3-5 goals)
- Objections (3-5 common objections)
`

export async function POST(request: NextRequest) {
    try {
        const { message, model, planContext, conversationHistory, mode, executeImmediately, targetBlockId: explicitTargetBlockId } = await request.json()

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 })
        }

        console.log("[Chat Orchestrator] Processing message:", message.substring(0, 100))
        console.log("[Chat Orchestrator] Mode:", mode || "chat", "| Execute immediately:", executeImmediately || false)
        console.log("[Chat Orchestrator] Explicit target block:", explicitTargetBlockId || "none")

        // In edit mode, we default to executing actions
        const isEditMode = mode === "edit" || executeImmediately

        // Check for confirmation phrases
        const confirmPhrases = [
            "go ahead", "do it", "yes", "apply", "update it", "make the change",
            "execute", "proceed", "confirm", "sounds good", "perfect", "that's good",
            "add it", "create it", "looks good", "approve"
        ]
        const isConfirmation = confirmPhrases.some(phrase =>
            message.toLowerCase().includes(phrase)
        )

        // Step 1: Use Gemini Flash to determine intent
        const orchestratorPrompt = `You are an AI assistant analyzing a user's request about a marketing plan.

**Your task:** Determine what the user wants to do and whether they want it executed NOW.

**Available Intents:**
- answer_question: User is asking a question, discussing, or exploring ideas
- edit_block: User wants to modify/update/change existing content (look for block IDs in context)
- add_section: User wants to add a new section to the plan
- add_tactic: User wants to add a new tactic to a section
- delete_block: User wants to remove a block
- confirm_action: User is confirming a previous suggestion should be applied

**IMPORTANT - Detecting shouldExecute:**
Set shouldExecute to TRUE if:
- User says "go ahead", "do it", "update it", "apply", "make the change"
- User confirms with "yes", "sounds good", "perfect", "that looks good"
- User explicitly asks to "add", "create", "edit", or "update" something specific
- Previous message was a suggestion and user is approving it

Set shouldExecute to FALSE if:
- User is asking "how" or "what" questions
- User is exploring options or asking for suggestions
- User says "maybe", "consider", "what if", "could you"

**Context about the plan:**
Title: ${planContext?.planTitle || "Untitled"}
Client: ${planContext?.clientName || "Unknown"}
Objective: ${planContext?.objective || "Not specified"}

${planContext?.fullContent ? `**Plan Content (with block IDs):**
${planContext.fullContent.substring(0, 4000)}` : ""}

**Recent conversation:**
${conversationHistory?.slice(-3).map((m: any) => `${m.role}: ${m.content.substring(0, 200)}`).join("\n") || "None"}

**Current User Message:** "${message}"

**Is this a confirmation phrase?** ${isConfirmation ? "YES - User appears to be confirming" : "Maybe not"}

Analyze carefully. Look for block IDs in the plan content that match what the user is referring to.`

        let intent = "answer_question"
        // Use explicit target block if provided, otherwise we'll try to detect it from context
        let targetBlockId: string | undefined = explicitTargetBlockId
        let shouldExecute = isConfirmation

        // Keyword-based intent detection
        const msgLower = message.toLowerCase()

        // Detect explicit question patterns (user is asking, not requesting edits)
        const questionPatterns = [
            "what is", "what are", "how do", "how does", "why is", "why does",
            "can you explain", "tell me about", "what should", "?", "help me understand"
        ]
        const isQuestion = questionPatterns.some(q => msgLower.includes(q))

        // Detect add section/tactic intent
        if (msgLower.includes("add a section") || msgLower.includes("create a section") ||
            msgLower.includes("new section") || msgLower.includes("add section")) {
            intent = "add_section"
            shouldExecute = true
        } else if (msgLower.includes("add a tactic") || msgLower.includes("add tactic") ||
            msgLower.includes("new tactic") || msgLower.includes("create a tactic")) {
            intent = "add_tactic"
            shouldExecute = true
        } else if (msgLower.includes("split") || msgLower.includes("separate") || msgLower.includes("break apart") || msgLower.includes("divide into")) {
            // Detect split intent FIRST - user wants to split a block into multiple
            // Check split before merge since "split X and merge Y" should split first
            intent = "split_block"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.includes("merge") || msgLower.includes("combine") || msgLower.includes("consolidate")) {
            // Detect merge intent - user wants to combine multiple blocks
            intent = "merge_blocks"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.includes("rename") || msgLower.match(/call it|change (?:the )?name|change (?:the )?title/)) {
            // Detect rename intent - user wants to rename a block
            intent = "rename_block"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.includes("change icon") || msgLower.includes("change the icon") ||
            msgLower.includes("new icon") || msgLower.includes("different icon")) {
            // Detect icon change intent
            intent = "change_icon"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.includes("move") || msgLower.includes("reorder") || msgLower.includes("re-order") ||
            msgLower.match(/put .* (before|after|above|below|first|last)/) ||
            msgLower.match(/(before|after|above|below) .*/) ||
            msgLower.includes("swap") || msgLower.includes("switch order")) {
            // Detect reorder intent - user wants to move/reorder blocks
            intent = "reorder_blocks"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.match(/(?:create|add|new)\s*(?:a\s*)?(phase|stage)/) ||
            msgLower.includes("add phase") || msgLower.includes("new phase") ||
            msgLower.includes("create phase") || msgLower.includes("add stage")) {
            // Detect create phase intent
            intent = "create_phase"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.match(/move .* (?:to|into|under)\s*(phase|section|stage)/) ||
            msgLower.match(/put .* (?:in|into|under)\s*(phase|section|stage)/) ||
            msgLower.includes("move to phase") || msgLower.includes("into the phase")) {
            // Detect move to phase intent
            intent = "move_to_phase"
            shouldExecute = isEditMode || isConfirmation
        } else if (msgLower.includes("delete") || msgLower.includes("remove")) {
            // Detect delete intent
            intent = "delete_block"
            shouldExecute = isEditMode || isConfirmation
        } else if (isEditMode && !isQuestion) {
            // IN EDIT MODE: Default to edit_block for any non-question message
            // This makes Edit mode much more direct - any request becomes an edit
            intent = "edit_block"
            shouldExecute = true
            console.log("[Chat Orchestrator] Edit mode: defaulting to edit_block intent")
        } else {
            // Detect edit intent with keywords (for Chat mode)
            const editKeywords = [
                "rewrit", "re-writ", "updat", "edit", "chang", "improv",
                "modif", "make it", "revis", "redo", "re-do", "rework",
                "enhanc", "fix", "adjust", "tweak", "refin", "writ", "reword", "rephras",
                "let's", "lets", "please", "can you"
            ]

            if (editKeywords.some(kw => msgLower.includes(kw))) {
                intent = "edit_block"
                shouldExecute = isEditMode || isConfirmation
            }
        }

        // Only try to detect block ID from context if we don't have an explicit one
        if (!targetBlockId && (intent === "edit_block" || intent === "delete_block" || intent === "rename_block" || intent === "change_icon" || intent === "split_block") && planContext?.fullContent) {
            let foundByName = false

            // First, try to match tactic names mentioned in the message
            const tacticMatches = planContext.fullContent.match(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
            console.log("[Block Detection] Found tactics:", tacticMatches?.length || 0, "Message:", msgLower.substring(0, 50))
            if (tacticMatches) {
                for (const tacticMatch of tacticMatches) {
                    const parts = tacticMatch.match(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/i)
                    if (parts) {
                        const tacticName = parts[1].toLowerCase().trim()
                        // Check if any significant words from the tactic name appear in the message
                        // More lenient: match if ANY word is found
                        const tacticWords = tacticName.split(/\s+/).filter((w: string) => w.length > 3)
                        const matchCount = tacticWords.filter((word: string) => msgLower.includes(word)).length
                        console.log("[Block Detection] Checking tactic:", tacticName, "words:", tacticWords, "matchCount:", matchCount)
                        // Match if at least 1 word matches
                        if (matchCount >= 1) {
                            targetBlockId = parts[2]
                            foundByName = true
                            console.log("[Block Detection] Matched tactic by name:", tacticName, "->", targetBlockId)
                            break
                        }
                    }
                }
            }

            // Also look for specific section names mentioned
            if (!foundByName) {
                const sectionMatches = planContext.fullContent.match(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
                if (sectionMatches) {
                    for (const sectionMatch of sectionMatches) {
                        const parts = sectionMatch.match(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/i)
                        if (parts) {
                            const sectionName = parts[1].toLowerCase().trim()
                            const sectionWords = sectionName.split(/\s+/).filter((w: string) => w.length > 3)
                            const matchCount = sectionWords.filter((word: string) => msgLower.includes(word)).length
                            // Match if at least 1 word matches
                            if (matchCount >= 1) {
                                targetBlockId = parts[2]
                                foundByName = true
                                console.log("[Block Detection] Matched section by name:", sectionName, "->", targetBlockId)
                                break
                            }
                        }
                    }
                }
            }

            // Only as a last resort, use the first block found
            if (!foundByName) {
                const blockIdMatches = planContext.fullContent.matchAll(/\[block:([a-f0-9-]+)\]/gi)
                for (const match of blockIdMatches) {
                    if (!targetBlockId) {
                        targetBlockId = match[1]
                        console.log("[Block Detection] Using first block as fallback:", targetBlockId)
                    }
                }
            }
        }

        console.log("[Chat Orchestrator] Intent:", intent, "Execute:", shouldExecute, "BlockId:", targetBlockId || "none", "EditMode:", isEditMode)

        // Step 2: Generate response based on intent
        let response = ""
        let action: any = undefined

        // If confirming a previous action from conversation
        if ((isConfirmation || intent === "confirm_action") && conversationHistory?.length > 0) {
            const lastAssistant = conversationHistory.slice().reverse().find((m: any) => m.role === "assistant")
            if (lastAssistant && lastAssistant.pendingAction) {
                return NextResponse.json({
                    response: "✅ Done! I've applied the changes to your plan.",
                    action: lastAssistant.pendingAction,
                    intent: "confirm_action",
                    model,
                })
            }
        }

        switch (intent) {
            case "answer_question":
                response = await generateAnswerResponse(message, planContext, conversationHistory)
                break

            case "edit_block":
                const editResult = await handleEditBlock(message, planContext, targetBlockId, shouldExecute, conversationHistory)
                response = editResult.response
                action = editResult.action
                break

            case "add_section":
                const addSectionResult = await handleAddSection(message, planContext, shouldExecute)
                response = addSectionResult.response
                action = addSectionResult.action
                break

            case "add_tactic":
                const addTacticResult = await handleAddTactic(message, planContext, shouldExecute)
                response = addTacticResult.response
                action = addTacticResult.action
                break

            case "delete_block":
                if (targetBlockId && shouldExecute) {
                    response = "✅ Deleted the block from your plan."
                    action = { type: "delete_block", blockId: targetBlockId }
                } else {
                    response = "Which block would you like me to delete? Please specify or select it as context."
                }
                break

            case "merge_blocks":
                // Find multiple blocks mentioned in the message
                const mergeResult = await handleMergeBlocks(message, planContext, shouldExecute, conversationHistory)
                response = mergeResult.response
                action = mergeResult.action // This can be an array of actions
                break

            case "split_block":
                // Split a block into multiple separate blocks
                const splitResult = await handleSplitBlock(message, planContext, targetBlockId, shouldExecute)
                response = splitResult.response
                action = splitResult.action // This can be an array of actions
                break

            case "rename_block":
                if (targetBlockId && shouldExecute) {
                    // Extract new name from message
                    const renameMatch = message.match(/(?:rename|call it|change (?:the )?name to|change (?:the )?title to|rename to)\s+["']?([^"'\n]+)["']?/i)
                    if (renameMatch) {
                        const newName = renameMatch[1].trim()
                        response = `✅ Renamed the block to "${newName}"`
                        action = { type: "edit_block", blockId: targetBlockId, content: "", title: newName }
                    } else {
                        response = "What would you like to rename it to? For example: \"rename to Brand Strategy\""
                    }
                } else {
                    response = "Which block would you like to rename, and what should the new name be?"
                }
                break

            case "change_icon":
                if (targetBlockId && shouldExecute) {
                    // Map keywords to icons
                    const iconMappings: Record<string, string> = {
                        "palette": "Palette", "color": "Palette", "paint": "Paintbrush", "brush": "Paintbrush",
                        "logo": "Stamp", "brand": "Stamp", "identity": "Fingerprint",
                        "website": "Globe", "web": "Globe", "seo": "Search", "search": "Search",
                        "social": "Share2", "email": "Mail", "video": "Video", "photo": "Camera",
                        "image": "Image", "design": "PenTool", "content": "FileText", "strategy": "Target",
                        "analytics": "BarChart3", "data": "Database", "calendar": "Calendar",
                        "event": "CalendarDays", "presentation": "Presentation", "document": "FileText",
                        "folder": "Folder", "money": "DollarSign", "budget": "Wallet", "rocket": "Rocket",
                        "star": "Star", "heart": "Heart", "lightning": "Zap", "fast": "Zap",
                        "automation": "Workflow", "megaphone": "Megaphone", "speaker": "Megaphone",
                        "chart": "LineChart", "graph": "BarChart", "target": "Target", "goal": "Target",
                    }

                    let newIcon: string | undefined
                    const msgLower = message.toLowerCase()
                    for (const [keyword, iconName] of Object.entries(iconMappings)) {
                        if (msgLower.includes(keyword)) {
                            newIcon = iconName
                            break
                        }
                    }

                    if (newIcon) {
                        response = `✅ Changed the icon to ${newIcon}`
                        action = { type: "edit_block", blockId: targetBlockId, content: "", icon: newIcon }
                    } else {
                        response = "What icon would you like? Try mentioning a keyword like: palette, logo, website, social, email, video, calendar, rocket, target, star, etc."
                    }
                } else {
                    response = "Which block would you like to change the icon for?"
                }
                break

            case "reorder_blocks":
                // Handle reordering blocks
                const reorderResult = handleReorderBlocks(message, planContext, shouldExecute)
                response = reorderResult.response
                action = reorderResult.action
                break

            case "create_phase":
                // Create a new phase/section
                const phaseResult = handleCreatePhase(message, planContext, shouldExecute)
                response = phaseResult.response
                action = phaseResult.action
                break

            case "move_to_phase":
                // Move a tactic to a different phase
                const moveToPhaseResult = handleMoveToPhase(message, planContext, shouldExecute)
                response = moveToPhaseResult.response
                action = moveToPhaseResult.action
                break

            default:
                response = await generateAnswerResponse(message, planContext, conversationHistory)
        }

        console.log("[Chat Orchestrator] Returning action:", action ? JSON.stringify(action).substring(0, 200) : "none")

        return NextResponse.json({
            response,
            action,
            intent,
            shouldExecute,
            model,
        })
    } catch (error) {
        console.error("[Chat Orchestrator] Error:", error)
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        )
    }
}

async function generateAnswerResponse(
    message: string,
    planContext: any,
    conversationHistory: any[]
) {
    let historyPrompt = ""
    if (conversationHistory && conversationHistory.length > 0) {
        historyPrompt = "\n## Recent Conversation\n"
        for (const msg of conversationHistory.slice(-5)) {
            historyPrompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`
        }
    }

    const systemPrompt = `You are an expert marketing strategist helping edit a marketing plan.

${PLAN_WRITING_GUIDE}

You have deep expertise in marketing, branding, content strategy, and digital advertising.

**Important:** If the user asks you to edit, add, or change something, provide a clear response with:
1. What you'd suggest
2. Then ask: "Would you like me to apply this change?"

This helps ensure the user reviews changes before they're made.
Format responses using markdown for readability.`

    let contextSection = ""
    if (planContext?.fullContent) {
        contextSection = `
## Current Plan
**Title:** ${planContext.planTitle || "Untitled"}
**Client:** ${planContext.clientName || "Unknown"}  
**Objective:** ${planContext.objective || "Not specified"}

**Content:**
${planContext.fullContent}
`
    }

    const fullPrompt = `${systemPrompt}
${contextSection}
${historyPrompt}

## User Request
${message}

Respond helpfully. If suggesting an edit, be specific and ask for confirmation.`

    const result = await generateTextGemini({
        prompt: fullPrompt,
        maxTokens: 2000,
        temperature: 0.7,
    })

    return result.text
}

async function handleEditBlock(
    message: string,
    planContext: any,
    targetBlockId: string | undefined,
    shouldExecute: boolean,
    conversationHistory: any[]
) {
    // First, generate the updated content
    const editPrompt = `You are editing a marketing plan tactic/section content.

${PLAN_WRITING_GUIDE}

**Plan Context:**
Title: ${planContext?.planTitle || "Untitled"}
Client: ${planContext?.clientName || "Unknown"}
Objective: ${planContext?.objective || "Not specified"}

${planContext?.fullContent ? `**Current Content:**\n${planContext.fullContent}` : ""}

**User's Edit Request:** "${message}"

IMPORTANT RULES for the generated content:
1. Write ONLY the tactic content itself - the What, Why, How sections
2. Do NOT include any of these metadata fields in your output:
   - No "Source:" or "Deliverable:" labels
   - No "Client Said:" or quotes
   - No "Priority:" or "Confidence:" values
   - No "[block:xxx]" IDs or identifiers
   - No "Hours:" or time estimates
   - No "Tactic:" title prefix
3. Structure your content with clear **What:**, **Why:**, and **How:** sections
4. Keep the content professional and specific to the client's needs
5. Write in markdown format

Generate ONLY the improved What/Why/How content, nothing else.`

    const result = await generateTextGemini({
        prompt: editPrompt,
        maxTokens: 2000,
        temperature: 0.7,
    })

    // Clean the generated content - remove only specific metadata artifacts
    const originalContent = result.text
    let generatedContent = result.text
        .replace(/\[block:[a-f0-9-]+\]/gi, '') // Remove block IDs only
        .replace(/^### Tactic:.*\n?/gm, '') // Remove tactic title lines with ### prefix
        .replace(/^Tactic:.*\n?/gm, '') // Remove Tactic: lines without ###
        .replace(/^Source: Deliverable:.*\n?/gm, '') // Remove "Source: Deliverable:" pattern
        .replace(/^Client Said:.*\n?/gm, '') // Remove Client Said lines
        .replace(/^Priority: (LOW|MEDIUM|HIGH).*\n?/gm, '') // Remove Priority lines
        .replace(/^Confidence: \d+%.*\n?/gm, '') // Remove Confidence lines
        .replace(/^Hours: \d+.*\n?/gm, '') // Remove Hours lines
        .replace(/\n{3,}/g, '\n\n') // Clean up extra newlines
        .trim()

    // If sanitization removed everything, use original but just strip block IDs
    if (!generatedContent || generatedContent.length < 50) {
        console.log("[handleEditBlock] Sanitization removed too much, using original with block IDs stripped")
        generatedContent = originalContent.replace(/\[block:[a-f0-9-]+\]/gi, '').trim()
    }

    // Detect title change requests
    let newTitle: string | undefined
    const titleMatch = message.match(/(?:rename|title|call it|change (?:the )?name to|rename to)\s+["']?([^"'\n]+)["']?/i)
    if (titleMatch) {
        newTitle = titleMatch[1].trim()
    }

    // Detect icon change requests - map common words to Lucide icons
    let newIcon: string | undefined
    const msgLower = message.toLowerCase()
    const iconMappings: Record<string, string> = {
        "palette": "Palette",
        "color": "Palette",
        "paint": "Paintbrush",
        "brush": "Paintbrush",
        "logo": "Stamp",
        "brand": "Stamp",
        "identity": "Fingerprint",
        "website": "Globe",
        "web": "Globe",
        "seo": "Search",
        "search": "Search",
        "social": "Share2",
        "email": "Mail",
        "video": "Video",
        "photo": "Camera",
        "image": "Image",
        "design": "PenTool",
        "content": "FileText",
        "strategy": "Target",
        "analytics": "BarChart3",
        "data": "Database",
        "calendar": "Calendar",
        "event": "CalendarDays",
        "presentation": "Presentation",
        "document": "FileText",
        "folder": "Folder",
        "money": "DollarSign",
        "budget": "Wallet",
        "rocket": "Rocket",
        "star": "Star",
        "heart": "Heart",
        "lightning": "Zap",
        "fast": "Zap",
        "automation": "Workflow",
    }

    // Check if user mentions icon change
    if (msgLower.includes("icon") || msgLower.includes("symbol")) {
        for (const [keyword, iconName] of Object.entries(iconMappings)) {
            if (msgLower.includes(keyword)) {
                newIcon = iconName
                break
            }
        }
    }

    console.log("[handleEditBlock] shouldExecute:", shouldExecute, "targetBlockId:", targetBlockId, "content length:", generatedContent?.length, "newTitle:", newTitle, "newIcon:", newIcon)

    // If we should execute AND we have a target block
    if (shouldExecute && targetBlockId) {
        console.log("[handleEditBlock] Returning action with blockId:", targetBlockId)
        // Clean the preview for chat response too
        const cleanPreview = generatedContent.substring(0, 400).replace(/\[block:[a-f0-9-]+\]/gi, '')

        // Build action with optional title and icon
        const action: any = {
            type: "edit_block",
            blockId: targetBlockId,
            content: generatedContent,
        }
        if (newTitle) action.title = newTitle
        if (newIcon) action.icon = newIcon

        let responseText = `✅ I've updated the **content**`
        if (newTitle) responseText += ` and renamed it to "${newTitle}"`
        if (newIcon) responseText += ` with a new icon`
        responseText += `:\n\n${cleanPreview}${generatedContent.length > 400 ? "..." : ""}`

        return {
            response: responseText,
            action,
        }
    }

    // If we should execute but don't have a block ID, try to find one from context
    if (shouldExecute && !targetBlockId && planContext?.fullContent) {
        // Parse block IDs from context - they'll be in format [block:uuid] or similar
        const blockIdMatch = planContext.fullContent.match(/\[block:([a-f0-9-]+)\]/i)
        if (blockIdMatch) {
            return {
                response: `✅ Updated the content:\n\n${generatedContent.substring(0, 500)}${generatedContent.length > 500 ? "..." : ""}`,
                action: {
                    type: "edit_block",
                    blockId: blockIdMatch[1],
                    content: generatedContent,
                },
            }
        }
    }

    // Otherwise, just show the suggestion
    return {
        response: `Here's what I'd update:\n\n${generatedContent}\n\n---\n\n**Would you like me to apply this change?** Just say "go ahead" or "apply it".`,
        action: undefined,
        pendingAction: targetBlockId ? {
            type: "edit_block",
            blockId: targetBlockId,
            content: generatedContent,
        } : undefined,
    }
}

async function handleAddSection(message: string, planContext: any, shouldExecute: boolean) {
    const addPrompt = `You are adding a new section to a marketing plan.

${PLAN_WRITING_GUIDE}

**Plan Context:**
Title: ${planContext?.planTitle || "Untitled"}
Client: ${planContext?.clientName || "Unknown"}
Objective: ${planContext?.objective || "Not specified"}

${planContext?.fullContent ? `**Existing Plan:**\n${planContext.fullContent.substring(0, 2000)}` : ""}

**User's Request:** "${message}"

Generate a new section. Respond with JSON only:
{
  "title": "Section Title",
  "description": "Brief overview",
  "content": "Main content in markdown"
}`

    const result = await generateTextGemini({
        prompt: addPrompt,
        maxTokens: 2000,
        temperature: 0.7,
    })

    // Try to parse as JSON
    let sectionData
    try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            sectionData = JSON.parse(jsonMatch[0])
        }
    } catch (e) {
        // Use raw text if parsing fails
    }

    if (sectionData && shouldExecute) {
        return {
            response: `✅ Added new section: **${sectionData.title}**\n\n${sectionData.description}`,
            action: {
                type: "add_section",
                section: {
                    type: "section",
                    title: sectionData.title,
                    description: sectionData.description,
                    children: sectionData.content ? [{
                        type: "text",
                        title: "",
                        content: sectionData.content,
                    }] : [],
                },
            },
        }
    }

    if (sectionData) {
        return {
            response: `Here's the section I'd add:\n\n**${sectionData.title}**\n\n${sectionData.description}\n\n${sectionData.content || ""}\n\n---\n\n**Would you like me to add this section?** Say "go ahead" to add it.`,
            action: undefined,
        }
    }

    return {
        response: `Here's what I'd add:\n\n${result.text}\n\n---\n\n**Would you like me to add this?**`,
        action: undefined,
    }
}

async function handleAddTactic(message: string, planContext: any, shouldExecute: boolean) {
    const addPrompt = `You are adding a new tactic to a marketing plan.

${PLAN_WRITING_GUIDE}

**Plan Context:**
Title: ${planContext?.planTitle || "Untitled"}
Client: ${planContext?.clientName || "Unknown"}
Objective: ${planContext?.objective || "Not specified"}

${planContext?.fullContent ? `**Existing Plan:**\n${planContext.fullContent.substring(0, 2000)}` : ""}

**User's Request:** "${message}"

Generate a tactic. Respond with JSON only:
{
  "title": "Tactic Title",
  "content": "Description with What, Why, How",
  "hours": 8,
  "icon": "Target"
}`

    const result = await generateTextGemini({
        prompt: addPrompt,
        maxTokens: 1500,
        temperature: 0.7,
    })

    let tacticData
    try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            tacticData = JSON.parse(jsonMatch[0])
        }
    } catch (e) {
        // Use raw text if parsing fails
    }

    if (tacticData && shouldExecute) {
        return {
            response: `✅ Added tactic: **${tacticData.title}** (${tacticData.hours}h)`,
            action: {
                type: "add_tactic",
                tactic: {
                    type: "tactic",
                    title: tacticData.title,
                    content: tacticData.content,
                    hours: tacticData.hours || 8,
                    icon: tacticData.icon || "Target",
                },
            },
        }
    }

    if (tacticData) {
        return {
            response: `Here's the tactic I'd add:\n\n**${tacticData.title}** (${tacticData.hours || 8} hours)\n\n${tacticData.content}\n\n---\n\n**Want me to add this tactic?** Say "go ahead".`,
            action: undefined,
        }
    }

    return {
        response: `Here's what I'd add:\n\n${result.text}\n\n---\n\n**Would you like me to add this?**`,
        action: undefined,
    }
}

async function handleMergeBlocks(
    message: string,
    planContext: any,
    shouldExecute: boolean,
    conversationHistory: any[]
) {
    const msgLower = message.toLowerCase()

    // Find all blocks mentioned in the message
    const allBlockMatches: { name: string; id: string }[] = []

    if (planContext?.fullContent) {
        // Find tactics
        const tacticMatches = planContext.fullContent.match(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        if (tacticMatches) {
            for (const tacticMatch of tacticMatches) {
                const parts = tacticMatch.match(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/i)
                if (parts) {
                    const tacticName = parts[1].toLowerCase().trim()
                    const tacticWords = tacticName.split(/\s+/).filter((w: string) => w.length > 3)
                    const matchCount = tacticWords.filter((word: string) => msgLower.includes(word)).length
                    if (matchCount >= 1) {
                        allBlockMatches.push({ name: parts[1].trim(), id: parts[2] })
                    }
                }
            }
        }

        // Find sections
        const sectionMatches = planContext.fullContent.match(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        if (sectionMatches) {
            for (const sectionMatch of sectionMatches) {
                const parts = sectionMatch.match(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/i)
                if (parts) {
                    const sectionName = parts[1].toLowerCase().trim()
                    const sectionWords = sectionName.split(/\s+/).filter((w: string) => w.length > 3)
                    const matchCount = sectionWords.filter((word: string) => msgLower.includes(word)).length
                    if (matchCount >= 1) {
                        allBlockMatches.push({ name: parts[1].trim(), id: parts[2] })
                    }
                }
            }
        }
    }

    console.log("[handleMergeBlocks] Found blocks to merge:", allBlockMatches)

    // Need at least 2 blocks to merge
    if (allBlockMatches.length < 2) {
        return {
            response: "I couldn't identify two blocks to merge. Please specify which blocks you'd like to combine, for example: \"merge brand identity and color palette\"",
            action: undefined,
        }
    }

    // Use the first two matched blocks
    const block1 = allBlockMatches[0]
    const block2 = allBlockMatches[1]

    // Generate merged content using AI
    const mergePrompt = `You are merging two marketing plan sections into one cohesive block.

**Plan Context:**
Title: ${planContext?.planTitle || "Untitled"}
Client: ${planContext?.clientName || "Unknown"}

**Block 1: ${block1.name}**
**Block 2: ${block2.name}**

**User's Request:** "${message}"

**Current Plan Content (for context):**
${planContext?.fullContent?.substring(0, 3000) || ""}

Create a single, cohesive merged section that combines the best elements of both blocks. Use the **What:**, **Why:**, and **How:** structure.

IMPORTANT: Write ONLY the merged content. Do NOT include:
- Block IDs
- "Tactic:" or "Title:" labels
- "Source:" or "Deliverable:" metadata
- "Client Said:" quotes
- "Priority:" or "Confidence:" values

Generate ONLY the merged What/Why/How content.`

    const result = await generateTextGemini({
        prompt: mergePrompt,
        maxTokens: 2000,
        temperature: 0.7,
    })

    // Clean the content
    let mergedContent = result.text
        .replace(/\[block:[a-f0-9-]+\]/gi, '')
        .replace(/^### Tactic:.*\n?/gm, '')
        .replace(/^Tactic:.*\n?/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    if (shouldExecute) {
        // Return array of actions: edit first block, delete second block
        return {
            response: `✅ Merged **${block1.name}** and **${block2.name}** into one block.\n\nThe merged content combines the key elements from both sections. The second block has been deleted.`,
            action: [
                {
                    type: "edit_block",
                    blockId: block1.id,
                    content: mergedContent,
                    title: `${block1.name} (Merged)`, // Optionally update title
                },
                {
                    type: "delete_block",
                    blockId: block2.id,
                },
            ],
        }
    }

    return {
        response: `I'll merge **${block1.name}** and **${block2.name}** into one block:\n\n${mergedContent.substring(0, 500)}${mergedContent.length > 500 ? "..." : ""}\n\n---\n\n**The second block (${block2.name}) will be deleted.** Say "yes" to proceed.`,
        action: undefined,
    }
}

async function handleSplitBlock(
    message: string,
    planContext: any,
    targetBlockId: string | undefined,
    shouldExecute: boolean
) {
    if (!targetBlockId) {
        return {
            response: "Which block would you like to split? Please specify the tactic or section name, for example: \"split brand identity into logo design and visual identity\"",
            action: undefined,
        }
    }

    // Find the current block's content and name from context
    let blockName = "this block"
    let blockContent = ""

    if (planContext?.fullContent) {
        // Try to find the tactic with this ID
        const tacticMatch = planContext.fullContent.match(new RegExp(`### Tactic: ([^\\n\\[]+) \\[block:${targetBlockId}\\]([\\s\\S]*?)(?=### Tactic:|## |$)`, 'i'))
        if (tacticMatch) {
            blockName = tacticMatch[1].trim()
            blockContent = tacticMatch[2].trim().substring(0, 2000)
        }
    }

    // Determine how to split from the user's message
    const msgLower = message.toLowerCase()
    let splitInstructions = message

    // Try to extract what to split into
    const intoMatch = message.match(/(?:split|separate|divide|break).*?(?:into|to)\s+(.+)/i)
    if (intoMatch) {
        splitInstructions = intoMatch[1]
    }

    // Generate content for two separate blocks using AI
    const splitPrompt = `You are splitting a marketing plan tactic into TWO separate tactics.

**Original Block: ${blockName}**
${blockContent ? `**Current Content:**\n${blockContent}` : ""}

**User's Request:** "${message}"

Create TWO separate tactics based on the user's request. Each should have its own **What:**, **Why:**, and **How:** sections.

Respond in this EXACT format:
---BLOCK1---
Title: [First tactic title]
Icon: [Lucide icon name like "Paintbrush", "Palette", "Target", "Globe", etc.]
Content:
**What:** [content]
**Why:** [content]
**How:** [content]
---BLOCK2---
Title: [Second tactic title]
Icon: [Lucide icon name]
Content:
**What:** [content]
**Why:** [content]
**How:** [content]
---END---

IMPORTANT: Do NOT include block IDs, Source, Deliverable, Client Said, Priority, or Confidence in your output.`

    const result = await generateTextGemini({
        prompt: splitPrompt,
        maxTokens: 3000,
        temperature: 0.7,
    })

    // Parse the response to extract two blocks
    const block1Match = result.text.match(/---BLOCK1---\s*Title:\s*([^\n]+)\s*Icon:\s*([^\n]+)\s*Content:\s*([\s\S]*?)---BLOCK2---/i)
    const block2Match = result.text.match(/---BLOCK2---\s*Title:\s*([^\n]+)\s*Icon:\s*([^\n]+)\s*Content:\s*([\s\S]*?)---END---/i)

    if (!block1Match || !block2Match) {
        console.log("[handleSplitBlock] Failed to parse split response:", result.text.substring(0, 500))
        return {
            response: "I had trouble splitting that block. Could you be more specific about how you'd like to divide it? For example: \"split brand identity into logo design and visual identity\"",
            action: undefined,
        }
    }

    const block1 = {
        title: block1Match[1].trim(),
        icon: block1Match[2].trim(),
        content: block1Match[3].trim().replace(/\[block:[a-f0-9-]+\]/gi, ''),
    }

    const block2 = {
        title: block2Match[1].trim(),
        icon: block2Match[2].trim(),
        content: block2Match[3].trim().replace(/\[block:[a-f0-9-]+\]/gi, ''),
    }

    console.log("[handleSplitBlock] Parsed blocks:", { block1Title: block1.title, block2Title: block2.title })

    if (shouldExecute) {
        // Return array of actions: update first block, add second block
        return {
            response: `✅ Split **${blockName}** into:\n\n1. **${block1.title}**\n2. **${block2.title}**\n\nBoth blocks have been created with their own content.`,
            action: [
                {
                    type: "edit_block",
                    blockId: targetBlockId,
                    title: block1.title,
                    content: block1.content,
                    icon: block1.icon,
                },
                {
                    type: "add_tactic",
                    tactic: {
                        type: "tactic",
                        title: block2.title,
                        content: block2.content,
                        hours: 8,
                        icon: block2.icon,
                    },
                },
            ],
        }
    }

    return {
        response: `I'll split **${blockName}** into:\n\n**1. ${block1.title}**\n${block1.content.substring(0, 200)}...\n\n**2. ${block2.title}**\n${block2.content.substring(0, 200)}...\n\n---\n\n**Ready to proceed?** Say "yes" to create both blocks.`,
        action: undefined,
    }
}

function handleReorderBlocks(
    message: string,
    planContext: any,
    shouldExecute: boolean
) {
    const msgLower = message.toLowerCase()

    // Find all blocks from context
    const allBlocks: { name: string; id: string; order: number }[] = []

    if (planContext?.fullContent) {
        // Find tactics
        const tacticMatches = planContext.fullContent.matchAll(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        let order = 0
        for (const match of tacticMatches) {
            allBlocks.push({ name: match[1].trim(), id: match[2], order: order++ })
        }

        // Find sections
        const sectionMatches = planContext.fullContent.matchAll(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        for (const match of sectionMatches) {
            allBlocks.push({ name: match[1].trim(), id: match[2], order: order++ })
        }
    }

    if (allBlocks.length === 0) {
        return {
            response: "I couldn't find any blocks to reorder. Please make sure the plan has content.",
            action: undefined,
        }
    }

    // Try to identify which block to move and where
    // Patterns: "move X before Y", "put X after Y", "move X to first", "move X to the top"

    let blockToMove: typeof allBlocks[0] | undefined
    let targetBlock: typeof allBlocks[0] | undefined
    let position: "before" | "after" | "first" | "last" | undefined

    // Check for "first" or "top" or "beginning"
    if (msgLower.includes("first") || msgLower.includes("top") || msgLower.includes("beginning")) {
        position = "first"
    } else if (msgLower.includes("last") || msgLower.includes("bottom") || msgLower.includes("end")) {
        position = "last"
    } else if (msgLower.includes("before") || msgLower.includes("above")) {
        position = "before"
    } else if (msgLower.includes("after") || msgLower.includes("below")) {
        position = "after"
    }

    // Find blocks mentioned in the message
    const mentionedBlocks: typeof allBlocks = []
    for (const block of allBlocks) {
        const blockWords = block.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const matchCount = blockWords.filter(word => msgLower.includes(word)).length
        if (matchCount >= 1) {
            mentionedBlocks.push({ ...block, order: matchCount }) // reuse order for match score
        }
    }

    // Sort by match score
    mentionedBlocks.sort((a, b) => b.order - a.order)

    if (mentionedBlocks.length === 0) {
        return {
            response: "I couldn't identify which blocks you want to reorder. Please specify the block names, for example: \"move Logo Design before Brand Strategy\"",
            action: undefined,
        }
    }

    // First mentioned block is usually the one to move
    blockToMove = allBlocks.find(b => b.id === mentionedBlocks[0].id)

    // If there's a second mentioned block, that's the target
    if (mentionedBlocks.length >= 2) {
        targetBlock = allBlocks.find(b => b.id === mentionedBlocks[1].id)
    }

    // If we have position but no target, we need first/last
    if (!position || (!targetBlock && position !== "first" && position !== "last")) {
        return {
            response: `I found **${blockToMove?.name}**, but I need to know where to move it. Try:\n- "move ${blockToMove?.name} to the top"\n- "move ${blockToMove?.name} after [another block name]"\n- "put ${blockToMove?.name} before [another block name]"`,
            action: undefined,
        }
    }

    if (!blockToMove) {
        return {
            response: "Which block would you like to move? Please specify the block name.",
            action: undefined,
        }
    }

    if (shouldExecute) {
        let newOrder: number

        if (position === "first") {
            newOrder = 0
        } else if (position === "last") {
            newOrder = allBlocks.length - 1
        } else if (targetBlock) {
            const targetOrder = allBlocks.findIndex(b => b.id === targetBlock!.id)
            newOrder = position === "before" ? targetOrder : targetOrder + 1
        } else {
            newOrder = 0
        }

        const currentOrder = allBlocks.findIndex(b => b.id === blockToMove!.id)

        return {
            response: `✅ Moved **${blockToMove.name}** ${position === "first" ? "to the top" : position === "last" ? "to the bottom" : `${position} ${targetBlock?.name}`}`,
            action: {
                type: "reorder_blocks",
                blockId: blockToMove.id,
                fromIndex: currentOrder,
                toIndex: newOrder,
            },
        }
    }

    return {
        response: `I'll move **${blockToMove.name}** ${position === "first" ? "to the top" : position === "last" ? "to the bottom" : `${position} ${targetBlock?.name}`}. Say "yes" to proceed.`,
        action: undefined,
    }
}

function handleCreatePhase(
    message: string,
    planContext: any,
    shouldExecute: boolean
) {
    const msgLower = message.toLowerCase()

    // Try to extract the phase name from the message
    const phaseNameMatch = message.match(/(?:phase|stage)\s*(?:called|named|titled|for|:)?\s*["']?([^"'\n,]+)["']?/i) ||
        message.match(/["']([^"']+)["']\s*(?:phase|stage)/i) ||
        message.match(/(?:create|add|new)\s*(?:a\s*)?(?:phase|stage)\s+(.+)/i)

    let phaseName = phaseNameMatch ? phaseNameMatch[1].trim() : undefined

    // Clean up common words from the extracted name
    if (phaseName) {
        phaseName = phaseName
            .replace(/^(called|named|titled|for|a|the)\s+/i, '')
            .replace(/\s+(phase|stage)$/i, '')
            .trim()
    }

    if (!phaseName || phaseName.length < 2) {
        return {
            response: "What should the new phase be called? For example: \"create a phase called Brand Development\" or \"add phase for Website Launch\"",
            action: undefined,
        }
    }

    // Suggest an icon based on keywords
    let icon = "Folder"
    const iconMappings: Record<string, string> = {
        "brand": "Stamp", "design": "PenTool", "website": "Globe", "web": "Globe",
        "launch": "Rocket", "market": "Megaphone", "content": "FileText",
        "social": "Share2", "analytics": "BarChart3", "seo": "Search",
        "develop": "Code", "research": "Search", "strategy": "Target",
        "planning": "Calendar", "execution": "Zap", "review": "CheckCircle",
    }
    for (const [keyword, iconName] of Object.entries(iconMappings)) {
        if (msgLower.includes(keyword)) {
            icon = iconName
            break
        }
    }

    if (shouldExecute) {
        return {
            response: `✅ Created new phase: **${phaseName}**`,
            action: {
                type: "add_section",
                section: {
                    type: "section",
                    title: phaseName,
                    description: `Phase for ${phaseName.toLowerCase()} activities`,
                    icon: icon,
                    children: [],
                },
            },
        }
    }

    return {
        response: `I'll create a new phase called **${phaseName}**. Say "yes" to create it.`,
        action: undefined,
    }
}

function handleMoveToPhase(
    message: string,
    planContext: any,
    shouldExecute: boolean
) {
    const msgLower = message.toLowerCase()

    // Find all sections/phases from context
    const phases: { name: string; id: string }[] = []
    const tactics: { name: string; id: string; parentId?: string }[] = []

    if (planContext?.fullContent) {
        // Find sections (phases)
        const sectionMatches = planContext.fullContent.matchAll(/## ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        for (const match of sectionMatches) {
            phases.push({ name: match[1].trim(), id: match[2] })
        }

        // Find tactics
        const tacticMatches = planContext.fullContent.matchAll(/### Tactic: ([^\n\[]+) \[block:([a-f0-9-]+)\]/gi)
        for (const match of tacticMatches) {
            tactics.push({ name: match[1].trim(), id: match[2] })
        }
    }

    if (phases.length === 0) {
        return {
            response: "There are no phases in the plan yet. Would you like me to create one first?",
            action: undefined,
        }
    }

    if (tactics.length === 0) {
        return {
            response: "There are no tactics to move. Would you like me to add one?",
            action: undefined,
        }
    }

    // Find which tactic to move
    let tacticToMove: typeof tactics[0] | undefined
    for (const tactic of tactics) {
        const tacticWords = tactic.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const matchCount = tacticWords.filter(word => msgLower.includes(word)).length
        if (matchCount >= 1) {
            tacticToMove = tactic
            break
        }
    }

    // Find which phase to move to
    let targetPhase: typeof phases[0] | undefined
    for (const phase of phases) {
        const phaseWords = phase.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const matchCount = phaseWords.filter(word => msgLower.includes(word)).length
        if (matchCount >= 1) {
            targetPhase = phase
            break
        }
    }

    if (!tacticToMove) {
        return {
            response: `Which tactic would you like to move? Available tactics:\n${tactics.map(t => `- ${t.name}`).join('\n')}`,
            action: undefined,
        }
    }

    if (!targetPhase) {
        return {
            response: `Which phase should I move **${tacticToMove.name}** to?\n\nAvailable phases:\n${phases.map(p => `- ${p.name}`).join('\n')}`,
            action: undefined,
        }
    }

    if (shouldExecute) {
        return {
            response: `✅ Moved **${tacticToMove.name}** to the **${targetPhase.name}** phase.`,
            action: {
                type: "move_to_phase",
                blockId: tacticToMove.id,
                targetPhaseId: targetPhase.id,
            },
        }
    }

    return {
        response: `I'll move **${tacticToMove.name}** to the **${targetPhase.name}** phase. Say "yes" to proceed.`,
        action: undefined,
    }
}

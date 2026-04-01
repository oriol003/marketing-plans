import { createClient } from "@/lib/supabase/server"
import type { MarketingPlan, Block, TacticBlock } from "@/lib/types"

const activeSaves = new Map<string, Promise<any>>()

export async function getPlans(): Promise<MarketingPlan[]> {
  const supabase = await createClient()

  const { data: plansData, error: plansError } = await supabase
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false })

  if (plansError) {
    console.error("Error fetching plans:", plansError)
    throw plansError
  }

  // Fetch blocks for all plans
  const planIds = plansData.map((p) => p.id)
  const { data: blocksData, error: blocksError } = await supabase
    .from("blocks")
    .select("*")
    .in("plan_id", planIds)
    .order("order", { ascending: true })

  if (blocksError) {
    console.error("Error fetching blocks:", blocksError)
    throw blocksError
  }

  // Group blocks by plan_id
  const blocksByPlan = blocksData.reduce(
    (acc, block) => {
      if (!acc[block.plan_id]) acc[block.plan_id] = []
      acc[block.plan_id].push(mapBlockFromDb(block))
      return acc
    },
    {} as Record<string, Block[]>,
  )

  return plansData.map((plan) => ({
    id: plan.id,
    title: plan.title,
    objective: plan.objective,
    clientName: plan.client_name,
    logo: plan.logo || undefined,
    startDate: plan.start_date || undefined, // Added startDate mapping
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    version: plan.version || 1,
    blocks: buildBlockHierarchy(blocksByPlan[plan.id] || []) || [],
  }))
}

export async function getPlan(id: string): Promise<MarketingPlan | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return null
  }

  const supabase = await createClient()

  const { data: planData, error: planError } = await supabase.from("plans").select("*").eq("id", id).single()

  if (planError) {
    if (planError.code === "PGRST116") return null // Not found
    console.error("Error fetching plan:", planError)
    throw planError
  }

  const { data: blocksData, error: blocksError } = await supabase
    .from("blocks")
    .select("*")
    .eq("plan_id", id)
    .order("order", { ascending: true })

  if (blocksError) {
    console.error("Error fetching blocks:", blocksError)
    throw blocksError
  }

  const blocks = buildBlockHierarchy(blocksData.map(mapBlockFromDb))

  return {
    id: planData.id,
    title: planData.title,
    objective: planData.objective,
    clientName: planData.client_name,
    logo: planData.logo || undefined,
    startDate: planData.start_date || undefined, // Added startDate mapping
    createdAt: planData.created_at,
    updatedAt: planData.updated_at,
    version: planData.version || 1,
    blocks: blocks || [],
  }
}

export async function createPlan(plan: Omit<MarketingPlan, "id" | "createdAt" | "updatedAt">): Promise<MarketingPlan> {
  const supabase = await createClient()

  const { data: planData, error: planError } = await supabase
    .from("plans")
    .insert({
      title: plan.title,
      objective: plan.objective,
      client_name: plan.clientName,
      logo: plan.logo, // Adding logo to plan creation
      start_date: plan.startDate || null, // Added startDate to plan creation
    })
    .select()
    .single()

  if (planError) {
    console.error("Error creating plan:", planError)
    throw planError
  }

  // Create blocks if provided - use recursive insert to respect parent_id FK
  if (plan.blocks && plan.blocks.length > 0) {
    await insertBlocksRecursively(supabase, plan.blocks, planData.id, null, 0)
  }

  return {
    id: planData.id,
    title: planData.title,
    objective: planData.objective,
    clientName: planData.client_name,
    logo: planData.logo || undefined,
    startDate: planData.start_date || undefined, // Added startDate mapping
    createdAt: planData.created_at,
    updatedAt: planData.updated_at,
    version: planData.version || 1,
    blocks: plan.blocks || [],
  }
}

export async function getPlanById(id: string): Promise<MarketingPlan | null> {
  const supabase = await createClient()

  const { data: planData, error: planError } = await supabase.from("plans").select("*").eq("id", id).single()

  if (planError) {
    if (planError.code === "PGRST116") return null // Not found
    console.error("Error fetching plan:", planError)
    throw planError
  }

  const { data: blocksData, error: blocksError } = await supabase
    .from("blocks")
    .select("*")
    .eq("plan_id", id)
    .order("order", { ascending: true })

  if (blocksError) {
    console.error("Error fetching blocks:", blocksError)
    throw blocksError
  }

  const blocks = buildBlockHierarchy(blocksData.map(mapBlockFromDb))

  return {
    id: planData.id,
    title: planData.title,
    objective: planData.objective,
    clientName: planData.client_name,
    logo: planData.logo || undefined,
    startDate: planData.start_date || undefined, // Added startDate mapping
    createdAt: planData.created_at,
    updatedAt: planData.updated_at,
    version: planData.version || 1,
    blocks: blocks || [],
  }
}

export async function updatePlan(id: string, updates: Partial<MarketingPlan>): Promise<MarketingPlan> {
  console.log("[v0] updatePlan called with id:", id)
  console.log("[v0] updatePlan blocks count:", updates.blocks?.length || 0)
  console.log("[v0] updatePlan version:", updates.version) // Log version

  if (activeSaves.has(id)) {
    console.log("[v0] Save already in progress for plan", id, "- waiting for it to complete")
    await activeSaves.get(id)
    console.log("[v0] Previous save completed, starting new save")
  }

  const savePromise = performUpdate(id, updates)
  activeSaves.set(id, savePromise)

  try {
    const result = await savePromise
    return result
  } finally {
    activeSaves.delete(id)
    console.log("[v0] Save operation completed and cleaned up")
  }
}

async function performUpdate(id: string, updates: Partial<MarketingPlan>): Promise<MarketingPlan> {
  const supabase = await createClient()

  const { data: currentPlanData, error: fetchError } = await supabase.from("plans").select("*").eq("id", id).single()

  if (fetchError) {
    console.error("[v0] Error fetching current plan:", fetchError)
    throw new Error("Failed to fetch current plan data")
  }

  if (updates.version !== undefined && currentPlanData.version !== updates.version) {
    console.error("[v0] VERSION CONFLICT DETECTED!")
    console.error("[v0] Client version:", updates.version, "Database version:", currentPlanData.version)
    throw new Error(
      "CONFLICT: Plan was modified by another tab or user. Please refresh the page to get the latest version.",
    )
  }

  if (updates.blocks !== undefined && (!updates.blocks || updates.blocks.length === 0)) {
    console.warn("[v0] WARNING: Saving plan with 0 blocks. All blocks will be deleted.")

    const { data: existingBlocks } = await supabase.from("blocks").select("*").eq("plan_id", id)

    if (existingBlocks && existingBlocks.length > 0) {
      console.warn(
        "[v0] Database currently has",
        existingBlocks.length,
        "blocks. They will be deleted by this save operation.",
      )
    }
  }

  const dbUpdates: any = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.objective !== undefined) dbUpdates.objective = updates.objective
  if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName
  if (updates.logo !== undefined) dbUpdates.logo = updates.logo
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null // Added startDate to updates

  const { data: planData, error: planError } = await supabase
    .from("plans")
    .update({
      ...dbUpdates,
      version: currentPlanData.version + 1, // Increment version
    })
    .eq("id", id)
    .eq("version", currentPlanData.version) // Optimistic locking
    .select()
    .single()

  if (planError) {
    console.error("[v0] Error updating plan metadata:", planError)
    if (planError.code === "PGRST116") {
      throw new Error(
        "CONFLICT: Plan was modified by another tab or user. Please refresh the page to get the latest version.",
      )
    }
    throw planError
  }

  if (!planData) {
    throw new Error(
      "CONFLICT: Plan was modified by another tab or user. Please refresh the page to get the latest version.",
    )
  }

  console.log("[v0] Plan metadata updated successfully, new version:", planData.version)

  if (updates.blocks !== undefined) {
    console.log("[v0] ====== UPDATING BLOCKS ======")
    console.log("[v0] Received blocks to save:", updates.blocks.length)

    // Delete all existing blocks for this plan
    const { error: deleteError } = await supabase.from("blocks").delete().eq("plan_id", id)

    if (deleteError) {
      console.error("[v0] Error deleting existing blocks:", deleteError)
      throw deleteError
    }

    console.log("[v0] Deleted existing blocks")

    // Insert new blocks if there are any
    if (updates.blocks.length > 0) {
      console.log("[v0] Inserting", updates.blocks.length, "new blocks")
      await insertBlocksRecursively(supabase, updates.blocks, id, null, 0)
      console.log("[v0] ✅ All blocks saved successfully")
    }
  }

  // Fetch blocks for the updated plan
  const { data: blocksData, error: blocksError } = await supabase
    .from("blocks")
    .select("*")
    .eq("plan_id", id)
    .order("order", { ascending: true })

  if (blocksError) {
    console.error("Error fetching blocks after update:", blocksError)
    throw blocksError
  }

  console.log("[v0] Fetched", blocksData.length, "blocks from database after save")

  const blocks = buildBlockHierarchy(blocksData.map(mapBlockFromDb))

  return {
    id: planData.id,
    title: planData.title,
    objective: planData.objective,
    clientName: planData.client_name,
    logo: planData.logo || undefined,
    startDate: planData.start_date || undefined, // Added startDate mapping
    createdAt: planData.created_at,
    updatedAt: planData.updated_at,
    version: planData.version || 1,
    blocks,
  }
}

export async function deletePlan(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from("plans").delete().eq("id", id)

  if (error) {
    console.error("Error deleting plan:", error)
    throw error
  }
}

// Helper functions to map between DB and app formats
function mapBlockFromDb(dbBlock: any): Block {
  const baseBlock = {
    id: dbBlock.id,
    order: dbBlock.order,
    parentId: dbBlock.parent_id,
    title: dbBlock.title || "",
    sourceContext: dbBlock.source_context,
  }

  if (dbBlock.type === "cover") {
    const coverData = dbBlock.content
      ? typeof dbBlock.content === "string"
        ? JSON.parse(dbBlock.content)
        : dbBlock.content
      : {}
    return {
      ...baseBlock,
      type: "cover",
      subtitle: coverData.subtitle || "",
      clientName: coverData.clientName || "",
      executionPeriod: coverData.executionPeriod || "",
      branding: dbBlock.branding || coverData.branding || "CODESM MARKETING",
      badgeLabel: dbBlock.badge_label || coverData.badgeLabel || "STRATEGIC ROADMAP",
      brandColors: coverData.brandColors || ["#00A7B5", "#FF6B35"],
    }
  } else if (dbBlock.type === "text") {
    let content = ""
    let useHtml = false
    let image = undefined
    let imagePosition = undefined

    try {
      if (dbBlock.content) {
        if (typeof dbBlock.content === "string" && dbBlock.content.startsWith("{")) {
          const parsed = JSON.parse(dbBlock.content)
          content = parsed.content || ""
          useHtml = parsed.useHtml || false
          image = parsed.image
          imagePosition = parsed.imagePosition
        } else {
          content = dbBlock.content
        }
      }
    } catch (e) {
      content = dbBlock.content || ""
    }

    return {
      ...baseBlock,
      type: "text",
      content,
      useHtml,
      image,
      imagePosition,
    }
  } else if (dbBlock.type === "table") {
    return {
      ...baseBlock,
      type: "table",
    }
  } else if (dbBlock.type === "timeline") {
    return {
      ...baseBlock,
      type: "timeline",
    }
  } else if (dbBlock.type === "budget-summary") {
    return {
      ...baseBlock,
      type: "budget-summary",
    }
  } else if (dbBlock.type === "section") {
    return {
      ...baseBlock,
      type: "section",
      description: dbBlock.description || "",
      icon: dbBlock.icon,
      color: dbBlock.color || "#00A7B5",
      coverImage: dbBlock.cover_image,
      image: dbBlock.image,
      imagePosition: dbBlock.image_position,
      sectionNumber: dbBlock.section_number,
    }
  } else if (dbBlock.type === "audience") {
    let audiences = []
    try {
      if (dbBlock.content) {
        audiences = typeof dbBlock.content === "string" ? JSON.parse(dbBlock.content) : dbBlock.content
      }
    } catch (e) {
      console.error("[v0] Error parsing audience content:", e)
      audiences = []
    }

    return {
      ...baseBlock,
      type: "audience",
      description: dbBlock.description || "",
      audiences: audiences || [],
    }
  } else if (dbBlock.type === "tactic") {
    return {
      ...baseBlock,
      type: "tactic",
      tacticId: dbBlock.tactic_template_id || "",
      description: dbBlock.description || "",
      content: dbBlock.content || "",
      hours: dbBlock.hours || 0,
      startDate: dbBlock.start_date || "",
      endDate: dbBlock.end_date || "",
      icon: dbBlock.icon,
      dependencies: [],
      image: dbBlock.image,
      imagePosition: dbBlock.image_position,
      budgetEnabled: dbBlock.budget_enabled || false,
      budgetTiers: dbBlock.budget_tiers,
      useHtml: dbBlock.use_html || false,
    }
  }

  console.warn("[v0] Unknown block type:", dbBlock.type, "- treating as text block")
  return {
    ...baseBlock,
    type: "text",
    content: dbBlock.content || "",
    useHtml: false,
  }
}

function mapBlockToDb(block: Block, planId: string, order: number, parentId?: string | null): any {
  console.log(
    "[v0] Mapping block to DB - type:",
    block.type,
    "title:",
    block.title,
    "order:",
    order,
    "parentId:",
    parentId,
  )

  const base = {
    plan_id: planId,
    type: block.type,
    order,
    title: block.title || "Untitled",
    parent_id: parentId !== undefined ? parentId : block.parentId || null,
    source_context: (block as any).sourceContext || null,
  }

  if (block.type === "cover") {
    const coverBlock = block as any
    return {
      ...base,
      branding: coverBlock.branding || "CODESM MARKETING",
      badge_label: coverBlock.badgeLabel || "STRATEGIC ROADMAP",
      content: JSON.stringify({
        subtitle: coverBlock.subtitle || "",
        clientName: coverBlock.clientName || "",
        executionPeriod: coverBlock.executionPeriod || "",
        brandColors: coverBlock.brandColors || ["#00A7B5", "#FF6B35"],
      }),
    }
  } else if (block.type === "text") {
    const textBlock = block as any
    const contentData = {
      content: textBlock.content || "",
      useHtml: textBlock.useHtml || false,
      image: textBlock.image,
      imagePosition: textBlock.imagePosition,
    }

    return {
      ...base,
      content: JSON.stringify(contentData),
    }
  } else if (block.type === "tactic") {
    const tacticBlock = block as TacticBlock

    const descriptionData = {
      description: tacticBlock.description || "",
      budgetEnabled: tacticBlock.budgetEnabled || false,
      budgetTiers: tacticBlock.budgetTiers,
      useHtml: tacticBlock.useHtml || false,
    }

    let tacticTemplateId: string | null = null
    if (tacticBlock.tacticId) {
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(tacticBlock.tacticId)) {
        tacticTemplateId = tacticBlock.tacticId
      } else {
        // If it's a template name instead of UUID, set to null
        console.log("[v0] Tactic template ID is not a UUID, setting to null:", tacticBlock.tacticId)
        tacticTemplateId = null
      }
    }

    // Use description as fallback if content is empty
    const contentValue = tacticBlock.content || tacticBlock.description || " "

    return {
      ...base,
      content: contentValue, // Must not be empty string for DB constraint
      tactic_template_id: tacticTemplateId,
      description: JSON.stringify(descriptionData),
      hours: tacticBlock.hours || 0,
      start_date: tacticBlock.startDate || new Date().toISOString().split("T")[0],
      end_date: tacticBlock.endDate || new Date().toISOString().split("T")[0],
      icon: tacticBlock.icon || null,
      image: tacticBlock.image || null,
      image_position: tacticBlock.imagePosition || null,
    }
  } else if (block.type === "section") {
    const sectionBlock = block as any
    return {
      ...base,
      description: sectionBlock.description || "",
      icon: sectionBlock.icon || null,
      color: sectionBlock.color || "#00A7B5",
      cover_image: sectionBlock.coverImage || null,
      image: sectionBlock.image || null,
      image_position: sectionBlock.imagePosition || null,
      section_number: sectionBlock.sectionNumber || null,
      content: null,
    }
  } else if (block.type === "audience") {
    const audienceBlock = block as any
    return {
      ...base,
      description: audienceBlock.description || "",
      content: JSON.stringify(audienceBlock.audiences || []),
    }
  } else if (block.type === "table" || block.type === "timeline" || block.type === "budget-summary") {
    return {
      ...base,
      content: null,
    }
  }

  console.warn("[v0] Unknown block type in mapBlockToDb:", block.type)
  return {
    ...base,
    content: JSON.stringify(block),
  }
}

function buildBlockHierarchy(flatBlocks: Block[]): Block[] {
  const blockMap = new Map<string, Block>()
  const rootBlocks: Block[] = []

  // First pass: create map of all blocks
  flatBlocks.forEach((block) => {
    blockMap.set(block.id, { ...block, children: [] })
  })

  // Second pass: build hierarchy
  flatBlocks.forEach((block) => {
    const blockWithChildren = blockMap.get(block.id)!

    if (block.parentId) {
      const parent = blockMap.get(block.parentId)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(blockWithChildren)
      } else {
        // Parent not found, treat as root
        rootBlocks.push(blockWithChildren)
      }
    } else {
      rootBlocks.push(blockWithChildren)
    }
  })

  // Sort children by order
  const sortBlocks = (blocks: Block[]) => {
    blocks.sort((a, b) => a.order - b.order)
    blocks.forEach((block) => {
      if (block.children) sortBlocks(block.children)
    })
  }

  sortBlocks(rootBlocks)

  return rootBlocks
}

function flattenBlockHierarchy(blocks: Block[], parentId?: string, startOrder = 0): Block[] {
  let order = startOrder
  const flat: Block[] = []

  blocks.forEach((block) => {
    const flatBlock = { ...block, parentId, order: order++, children: undefined }
    flat.push(flatBlock)

    if (block.children && block.children.length > 0) {
      const childBlocks = flattenBlockHierarchy(block.children, block.id, 0)
      flat.push(...childBlocks)
    }
  })

  return flat
}

async function insertBlocksRecursively(
  supabase: any,
  blocks: Block[],
  planId: string,
  parentId: string | null,
  startOrder: number,
): Promise<void> {
  console.log("[v0] ========== INSERTING BLOCKS RECURSIVELY ==========")
  console.log("[v0] Total blocks to insert:", blocks.length)
  console.log("[v0] Parent ID:", parentId || "ROOT")
  console.log("[v0] Starting order:", startOrder)

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const order = startOrder + i

    console.log("[v0] --------------------------------------------------")
    console.log("[v0] Processing block", i + 1, "/", blocks.length)
    console.log("[v0] Block type:", block.type)
    console.log("[v0] Block title:", block.title)
    console.log("[v0] Block ID:", block.id)
    console.log("[v0] Order:", order)
    console.log("[v0] Has children:", !!(block.children && block.children.length > 0))

    try {
      const blockToInsert = mapBlockToDb(block, planId, order, parentId)

      // Remove the client-side ID to let database generate a new one
      delete blockToInsert.id

      console.log("[v0] Mapped block data:", JSON.stringify(blockToInsert, null, 2))

      const { data: insertedBlock, error } = await supabase.from("blocks").insert(blockToInsert).select("id").single()

      if (error) {
        console.error("[v0] ❌ ERROR inserting block!")
        console.error("[v0] Error message:", error.message)
        console.error("[v0] Error code:", error.code)
        console.error("[v0] Failed block data:", JSON.stringify(blockToInsert, null, 2))
        throw error
      }

      console.log("[v0] ✅ Block inserted successfully with DB ID:", insertedBlock.id)

      // If block has children, insert them recursively
      if (block.children && block.children.length > 0) {
        console.log("[v0] 📂 Block has", block.children.length, "children - inserting recursively")
        await insertBlocksRecursively(supabase, block.children, planId, insertedBlock.id, 0)
        console.log("[v0] ✅ All children inserted for block:", block.title)
      }
    } catch (error) {
      console.error("[v0] ❌ CRITICAL ERROR in insertBlocksRecursively")
      console.error("[v0] Block that failed:", block.title, "type:", block.type)
      throw error
    }
  }

  console.log("[v0] ========== COMPLETED INSERTING", blocks.length, "BLOCKS ==========")
}

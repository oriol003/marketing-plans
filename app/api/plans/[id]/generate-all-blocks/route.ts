import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { blocks, referenceIds = [] } = body

    console.log("[v0] Generate all blocks request for", blocks.length, "blocks with", referenceIds.length, "references")

    // Flatten all blocks to get text and tactic blocks only
    const getAllBlocksFlattened = (blockList: any[]): any[] => {
      const result: any[] = []
      const traverse = (list: any[]) => {
        for (const block of list) {
          result.push(block)
          if (block.children && block.children.length > 0) {
            traverse(block.children)
          }
        }
      }
      traverse(blockList)
      return result
    }

    const allBlocks = getAllBlocksFlattened(blocks)
    const blocksToGenerate = allBlocks.filter(
      (block) => (block.type === "text" || block.type === "tactic") && block.sourceContext?.trim(),
    )

    console.log(`[v0] Found ${blocksToGenerate.length} blocks eligible for generation (have sourceContext)`)

    if (blocksToGenerate.length === 0) {
      return NextResponse.json({ blocks, message: "No blocks with source context found" })
    }

    // Fetch references if provided
    let referencesContent = ""
    if (referenceIds.length > 0) {
      try {
        const referencesResponse = await fetch(`${req.nextUrl.origin}/api/plans/${id}/references`)
        const referencesData = await referencesResponse.json()
        const selectedReferences = referencesData.references.filter((ref: any) => referenceIds.includes(ref.id))
        referencesContent = selectedReferences.map((ref: any) => `${ref.title}:\n${ref.content}`).join("\n\n")
      } catch (err) {
        console.error("[v0] Error fetching references:", err)
      }
    }

    // Process blocks in batches of 6-7
    const BATCH_SIZE = 7
    const updatedBlocks = [...blocks]

    for (let i = 0; i < blocksToGenerate.length; i += BATCH_SIZE) {
      const batch = blocksToGenerate.slice(i, i + BATCH_SIZE)
      console.log(`[v0] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} blocks`)

      // Generate content for all blocks in this batch in parallel
      const generationPromises = batch.map(async (block) => {
        const blockIndex = allBlocks.findIndex((b) => b.id === block.id)
        const previousBlocks = allBlocks
          .slice(0, blockIndex)
          .filter((b) => b.content && b.content.trim())
          .slice(-3)
          .map((b) => ({ title: b.title, content: b.content }))

        const upcomingBlocks = allBlocks
          .slice(blockIndex + 1)
          .slice(0, 5)
          .map((b) => ({ title: b.title }))

        try {
          // Call the existing generate-block API
          const response = await fetch(`${req.nextUrl.origin}/api/plans/${id}/generate-block`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blockType: block.type,
              tacticName: block.title,
              tacticDescription: block.sourceContext,
              referenceIds,
              previousBlocks,
              upcomingBlocks,
            }),
          })

          if (!response.ok) {
            console.error(`[v0] Failed to generate content for block: ${block.title}`)
            return null
          }

          const { content } = await response.json()
          return { id: block.id, content }
        } catch (error) {
          console.error(`[v0] Error generating content for block ${block.title}:`, error)
          return null
        }
      })

      const results = await Promise.all(generationPromises)

      // Update blocks with generated content
      for (const result of results) {
        if (result) {
          const updateBlock = (blockList: any[]): any[] => {
            return blockList.map((block) => {
              if (block.id === result.id) {
                return { ...block, content: result.content }
              }
              if (block.children && block.children.length > 0) {
                return { ...block, children: updateBlock(block.children) }
              }
              return block
            })
          }
          updatedBlocks.splice(0, updatedBlocks.length, ...updateBlock(updatedBlocks))
        }
      }
    }

    console.log("[v0] Successfully generated content for all blocks")

    return NextResponse.json({ blocks: updatedBlocks })
  } catch (error: any) {
    console.error("[v0] Error generating all blocks:", error)
    return NextResponse.json({ error: error.message || "Failed to generate all blocks" }, { status: 500 })
  }
}

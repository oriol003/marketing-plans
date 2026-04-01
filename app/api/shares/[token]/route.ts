import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Get plan data by share token
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const supabase = await createClient()

    // Get share record
    const { data: share, error: shareError } = await supabase
      .from("plan_shares")
      .select("*")
      .eq("share_token", token)
      .eq("is_active", true)
      .single()

    if (shareError || !share) {
      return NextResponse.json({ error: "Share link not found or has expired" }, { status: 404 })
    }

    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 })
    }

    // Get plan data
    const { data: plan, error: planError } = await supabase.from("plans").select("*").eq("id", share.plan_id).single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Get blocks
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("*")
      .eq("plan_id", plan.id)
      .order("order", { ascending: true })

    if (blocksError) {
      console.error("Error fetching blocks:", blocksError)
      return NextResponse.json({ error: "Failed to fetch plan blocks" }, { status: 500 })
    }

    return NextResponse.json({
      share,
      plan: {
        ...plan,
        blocks: blocks || [],
      },
    })
  } catch (error) {
    console.error("Error in GET /api/shares/[token]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"

// Generate a new share link for a plan
export async function POST(request: NextRequest) {
  try {
    const { planId, expiresInDays } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if plan exists
    const { data: plan, error: planError } = await supabase.from("plans").select("id, title").eq("id", planId).single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Generate unique share token
    const shareToken = nanoid(16)

    // Calculate expiration date if provided
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null

    // Create share record
    const { data: share, error: shareError } = await supabase
      .from("plan_shares")
      .insert({
        plan_id: planId,
        share_token: shareToken,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (shareError) {
      console.error("Error creating share:", shareError)
      return NextResponse.json({ error: "Failed to create share link" }, { status: 500 })
    }

    return NextResponse.json({ share })
  } catch (error) {
    console.error("Error in POST /api/shares:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Get all shares for a plan
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get("planId")

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: shares, error } = await supabase
      .from("plan_shares")
      .select("*")
      .eq("plan_id", planId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching shares:", error)
      return NextResponse.json({ error: "Failed to fetch shares" }, { status: 500 })
    }

    return NextResponse.json({ shares })
  } catch (error) {
    console.error("Error in GET /api/shares:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

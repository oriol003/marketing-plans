import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Update approval status for a shared plan
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const { approvalStatus, approverName, approverEmail, approvalNotes } = await request.json()

    if (!approvalStatus || !["approved", "changes_requested"].includes(approvalStatus)) {
      return NextResponse.json({ error: "Invalid approval status" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update share record with approval info
    const { data: share, error } = await supabase
      .from("plan_shares")
      .update({
        approval_status: approvalStatus,
        approver_name: approverName || null,
        approver_email: approverEmail || null,
        approval_notes: approvalNotes || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", token)
      .select()
      .single()

    if (error) {
      console.error("Error updating approval:", error)
      return NextResponse.json({ error: "Failed to update approval status" }, { status: 500 })
    }

    return NextResponse.json({ share })
  } catch (error) {
    console.error("Error in PATCH /api/shares/[token]/approval:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

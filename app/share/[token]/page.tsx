import { createClient } from "@/lib/supabase/server"
import { SharedPlanView } from "@/components/shared-plan-view"
import { notFound } from "next/navigation"

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
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
      notFound()
    }

    // Check if expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center max-w-md px-4">
            <h1 className="text-3xl font-bold mb-4">Link Expired</h1>
            <p className="text-muted-foreground">
              This share link has expired. Please contact the plan owner for a new link.
            </p>
          </div>
        </div>
      )
    }

    // Get plan and blocks - importing helper from lib/db/plans
    const { getPlan } = await import("@/lib/db/plans")
    const plan = await getPlan(share.plan_id)

    if (!plan) {
      notFound()
    }

    return <SharedPlanView plan={plan} share={share} token={token} />
  } catch (error) {
    console.error("[v0] Error loading shared plan:", error)
    notFound()
  }
}

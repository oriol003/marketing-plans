import type React from "react"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as LucideIcons from "lucide-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function calculateDateRange(startDate: string, durationDays: number): string {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + durationDays)

  return end.toISOString().split("T")[0]
}

export function calculateTotalHours(blocks: any[]): number {
  return blocks.filter((block) => block.type === "tactic").reduce((total, block) => total + (block.hours || 0), 0)
}

export function groupBlocksByMonth(blocks: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}

  blocks
    .filter((block) => block.type === "tactic")
    .forEach((block) => {
      const date = new Date(block.startDate)
      const monthKey = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(block)
    })

  return grouped
}

/** Get array of month keys (YYYY-MM) between two dates inclusive */
export function getMonthsBetween(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + "T00:00:00")
  const end = new Date(endDate + "T00:00:00")
  const months: string[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (current <= endMonth) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, "0")
    months.push(`${year}-${month}`)
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

/** Format a YYYY-MM key to a short label like "Jan 2026" */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function suggestIconForTactic(tacticTitle: string, description?: string): string {
  const text = (tacticTitle + " " + (description || "")).toLowerCase()

  // Marketing & Advertising
  if (text.match(/ad|advertis|campaign|promo/)) return "Megaphone"
  if (text.match(/social media|facebook|instagram|twitter|linkedin/)) return "Share2"
  if (text.match(/email|newsletter/)) return "Mail"
  if (text.match(/video|youtube|tiktok/)) return "Video"
  if (text.match(/photo|image|visual/)) return "Camera"
  if (text.match(/content|blog|article/)) return "FileText"

  // Branding & Design
  if (text.match(/brand|logo|identity/)) return "Palette"
  if (text.match(/design|creative|graphic/)) return "Pencil"
  if (text.match(/website|web|site/)) return "Globe"
  if (text.match(/ui|ux|interface/)) return "Monitor"

  // Research & Analysis
  if (text.match(/research|analysis|study/)) return "Search"
  if (text.match(/competitor|market/)) return "TrendingUp"
  if (text.match(/audience|persona|customer/)) return "Users"
  if (text.match(/data|analytics|metric/)) return "BarChart"

  // Strategy & Planning
  if (text.match(/strategy|plan|roadmap/)) return "Map"
  if (text.match(/goal|objective|target/)) return "Target"
  if (text.match(/timeline|schedule/)) return "Calendar"
  if (text.match(/budget|cost|pricing/)) return "DollarSign"

  // Production & Events
  if (text.match(/event|show|booth/)) return "Calendar"
  if (text.match(/print|collateral|material/)) return "Printer"
  if (text.match(/package|product/)) return "Package"
  if (text.match(/shoot|production/)) return "Camera"

  // Digital & Technology
  if (text.match(/seo|search engine/)) return "Search"
  if (text.match(/ppc|paid|ads/)) return "DollarSign"
  if (text.match(/automation|tool/)) return "Zap"
  if (text.match(/app|mobile/)) return "Smartphone"

  // Communication & PR
  if (text.match(/press|pr|public relations/)) return "Newspaper"
  if (text.match(/influencer|partnership/)) return "Users"
  if (text.match(/presentation|pitch/)) return "Presentation"
  if (text.match(/report|document/)) return "FileText"

  // Default icons by type
  if (text.match(/develop|build|create/)) return "Wrench"
  if (text.match(/launch|release/)) return "Rocket"
  if (text.match(/optimize|improve/)) return "TrendingUp"
  if (text.match(/manage|track/)) return "ClipboardList"

  // Fallback
  return "Package"
}

export function getIconComponent(iconName: string): React.ComponentType<any> {
  // @ts-ignore - Dynamic icon lookup
  return LucideIcons[iconName] || LucideIcons.Package
}

export interface MarketingPlan {
  id: string
  title: string
  objective: string
  clientName: string
  createdAt: string
  updatedAt: string
  blocks: Block[]
  logo?: string // Added optional logo URL field
  version?: number // Added version for optimistic locking
  startDate?: string // Added start date for the plan
  budgetTierDefs?: BudgetTierDef[] // Plan-level tier definitions for consistency across all tactics
}

export interface WizardData {
  clientName: string
  objective: string
  startDate: string
  budget?: number
  selectedTactics: string[]
  customTactics?: CustomTactic[]
}

export type Block = TextBlock | TacticBlock | TableBlock | TimelineBlock | SectionBlock | CoverBlock | AudienceBlock | BudgetSummaryBlock

export interface BaseBlock {
  id: string
  order: number
  parentId?: string // Added parentId for nesting support
  children?: Block[] // Added children array for nested blocks
  aiModified?: boolean // Flag to indicate block was modified by AI
}

export interface TextBlock extends BaseBlock {
  type: "text"
  title: string
  content: string
  image?: string
  imagePosition?: "above" | "below"
  useHtml?: boolean // Added HTML mode toggle
}

export interface TacticBlock extends BaseBlock {
  type: "tactic"
  tacticId: string
  title: string
  description: string
  content: string
  sourceContext?: string // Hidden evidence/sources (Client Said, Priority, etc.)
  hours: number
  hoursByMonth?: Record<string, number> // e.g. { "2026-01": 5, "2026-02": 8 }
  startDate: string
  endDate: string
  icon?: string
  dependencies?: string[]
  image?: string
  imagePosition?: "above" | "below"
  budgetEnabled?: boolean
  budgetMode?: "scenario" | "fixed" // "scenario" = tier-based, "fixed" = monthly allocation
  budgetTiers?: Record<string, BudgetTier> // Keyed by tier ID from plan-level budgetTierDefs
  useHtml?: boolean // Added HTML mode toggle
  evidence?: string // Added evidence field to store reference citations
  deliverable?: string // The specific deliverable/output from this tactic
  mediaFlights?: Array<{ startDate: string; endDate: string; label?: string }> // Media flight date ranges
  budgetByMonth?: Record<string, number> // Monthly budget e.g. { "2026-01": 2000 }
}

export interface TableBlock extends BaseBlock {
  type: "table"
  title: string
  sourceContext?: string
}

export interface TimelineBlock extends BaseBlock {
  type: "timeline"
  title: string
  sourceContext?: string
}

export interface TacticTemplate {
  id: string
  name: string
  description: string
  category: string
  defaultHours: number
  defaultDuration: number
  icon?: string
  what?: string
  why?: string
  how?: string
}

export interface CustomTactic {
  id: string
  name: string
  description: string
}

export interface SectionBlock extends BaseBlock {
  type: "section"
  title: string
  description?: string
  sourceContext?: string
  icon?: string
  image?: string
  imagePosition?: "above" | "below"
  sectionNumber?: string // Added section number for document-style formatting
  color?: string // Custom color for the section (hex color)
  coverImage?: string // Cover image URL for the section
}

export interface CoverBlock extends BaseBlock {
  type: "cover"
  title: string
  subtitle?: string
  clientName: string
  executionPeriod?: string
  branding?: string
  badgeLabel?: string
  brandColors?: string[]
}

export interface AudienceBlock extends BaseBlock {
  type: "audience"
  title: string
  description?: string
  audiences: Audience[]
}

export interface Audience {
  id: string
  name: string
  description: string
  avatar?: string
  incomeLevel: string
  keyFocus: string
  demographics: string[]
  motivations: string[]
  order: number
}

export interface Reference {
  id: string
  planId: string
  title: string
  content: string
  order: number
  createdAt?: string
  updatedAt?: string
}

export interface BudgetSummaryBlock extends BaseBlock {
  type: "budget-summary"
  title: string
  sourceContext?: string
}

export interface BudgetTier {
  amount: number
  scope: string
}

export interface BudgetTierDef {
  id: string     // Unique tier ID (e.g., "minimum", "recommended", "aggressive", or custom)
  name: string   // Display name (e.g., "Minimum", "Recommended", "Aggressive")
  order: number  // Sort order
}

export interface PlanShare {
  id: string
  planId: string
  shareToken: string
  isActive: boolean
  approvalStatus: "pending" | "approved" | "changes_requested"
  approverName?: string
  approverEmail?: string
  approvalNotes?: string
  approvedAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

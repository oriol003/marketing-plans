export type PlanType = {
  id: string
  clientName: string
  goals: string
  audience: string
  blocks: Block[]
}

export type BlockType = "text" | "tactic"

export interface Block {
  id: string
  type: BlockType
  title: string
  content: string
  isGenerating?: boolean
  // Tactic specific fields
  tacticData?: {
    hours?: number
    productionStartDate?: string
    productionEndDate?: string
    flightStartDate?: string
    flightEndDate?: string
    dependencies?: string
    icon?: string // Lucide icon name
  }
}

export interface WizardData {
  clientName: string
  goals: string
  audience: string
  selectedTactics: string[]
}

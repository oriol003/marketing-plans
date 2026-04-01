import type { TacticTemplate } from "./types"

export const tacticCategories = [
  "Strategy & Research",
  "Brand & Creative",
  "Digital Marketing",
  "Content & Email",
  "Analytics & Tracking",
  "Website & Tech",
  "Events & PR",
]

export const tacticTemplates: TacticTemplate[] = [
  // Strategy & Research
  {
    id: "competitor-analysis",
    name: "Competitor Analysis",
    description: "Research competitors and identify market opportunities",
    category: "Strategy & Research",
    defaultHours: 4,
    defaultDuration: 3,
    icon: "Search",
  },
  {
    id: "market-research",
    name: "Market Research",
    description: "Analyze industry trends and target audience insights",
    category: "Strategy & Research",
    defaultHours: 6,
    defaultDuration: 5,
    icon: "TrendingUp",
  },
  {
    id: "brand-identity",
    name: "Brand Identity",
    description: "Define brand values, voice, and positioning",
    category: "Strategy & Research",
    defaultHours: 2,
    defaultDuration: 3,
    icon: "Palette",
  },

  // Brand & Creative
  {
    id: "social-media-branding",
    name: "Social Media Branding",
    description: "Design branded assets for social platforms",
    category: "Brand & Creative",
    defaultHours: 3,
    defaultDuration: 5,
    icon: "Share2",
  },
  {
    id: "stationery-design",
    name: "Stationery Design",
    description: "Create branded business cards, letterheads, and materials",
    category: "Brand & Creative",
    defaultHours: 5,
    defaultDuration: 7,
    icon: "FileText",
  },
  {
    id: "logo-animation",
    name: "Logo Animation",
    description: "Animated logo for video and podcast content",
    category: "Brand & Creative",
    defaultHours: 3,
    defaultDuration: 3,
    icon: "Film",
  },
  {
    id: "photography",
    name: "Professional Photography",
    description: "Team and product photography sessions",
    category: "Brand & Creative",
    defaultHours: 4,
    defaultDuration: 5,
    icon: "Camera",
  },

  // Digital Marketing
  {
    id: "social-media-setup",
    name: "Social Media Setup",
    description: "Configure and optimize social media profiles",
    category: "Digital Marketing",
    defaultHours: 8,
    defaultDuration: 7,
    icon: "Share2",
  },
  {
    id: "platform-optimization",
    name: "Platform Optimization",
    description: "Optimize all social channels for maximum reach",
    category: "Digital Marketing",
    defaultHours: 4,
    defaultDuration: 3,
    icon: "Settings",
  },

  // Content & Email
  {
    id: "crm-setup",
    name: "CRM Setup",
    description: "Implement customer relationship management system",
    category: "Content & Email",
    defaultHours: 4,
    defaultDuration: 3,
    icon: "Database",
  },
  {
    id: "email-marketing",
    name: "Email Marketing Setup",
    description: "Configure email platform and automation",
    category: "Content & Email",
    defaultHours: 1,
    defaultDuration: 2,
    icon: "Mail",
  },
  {
    id: "weekly-newsletter",
    name: "Weekly Newsletter",
    description: "Design and launch weekly email newsletter",
    category: "Content & Email",
    defaultHours: 4,
    defaultDuration: 30,
    icon: "Newspaper",
  },
  {
    id: "daily-briefing",
    name: "Daily Briefing",
    description: "Automated daily email updates",
    category: "Content & Email",
    defaultHours: 4,
    defaultDuration: 10,
    icon: "Clock",
  },

  // Analytics & Tracking
  {
    id: "analytics-setup",
    name: "Analytics Setup",
    description: "Install Google Tag Manager and Analytics",
    category: "Analytics & Tracking",
    defaultHours: 2,
    defaultDuration: 3,
    icon: "BarChart",
  },
  {
    id: "search-console",
    name: "Search Console Setup",
    description: "Configure Google and Bing Search Console",
    category: "Analytics & Tracking",
    defaultHours: 1,
    defaultDuration: 5,
    icon: "Search",
  },

  // Website & Tech
  {
    id: "website-development",
    name: "Website Development",
    description: "Build and launch a new website",
    category: "Website & Tech",
    defaultHours: 20,
    defaultDuration: 30,
    icon: "Globe",
  },
  {
    id: "app-integration",
    name: "App Integration",
    description: "Integrate mobile app with backend systems",
    category: "Website & Tech",
    defaultHours: 10,
    defaultDuration: 15,
    icon: "Smartphone",
  },
  {
    id: "api-automation",
    name: "API Automation",
    description: "Automate API integrations for seamless data flow",
    category: "Website & Tech",
    defaultHours: 8,
    defaultDuration: 10,
    icon: "Settings",
  },

  // Events & PR
  {
    id: "event-planning",
    name: "Event Planning",
    description: "Organize and execute a company event",
    category: "Events & PR",
    defaultHours: 12,
    defaultDuration: 20,
    icon: "Calendar",
  },
  {
    id: "pr-campaign",
    name: "PR Campaign",
    description: "Launch a press release and media outreach campaign",
    category: "Events & PR",
    defaultHours: 8,
    defaultDuration: 10,
    icon: "Newspaper",
  },
  {
    id: "partnership-negotiation",
    name: "Partnership Negotiation",
    description: "Negotiate and finalize partnerships with key influencers",
    category: "Events & PR",
    defaultHours: 6,
    defaultDuration: 8,
    icon: "Users",
  },
]

export function suggestIconForTactic(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()

  // Strategy & Research
  if (text.includes("research") || text.includes("analysis") || text.includes("audit")) return "Search"
  if (text.includes("strategy") || text.includes("planning")) return "Target"
  if (text.includes("competitor") || text.includes("market")) return "TrendingUp"

  // Brand & Creative
  if (text.includes("brand") || text.includes("identity") || text.includes("logo")) return "Palette"
  if (text.includes("design") || text.includes("creative") || text.includes("visual")) return "Paintbrush"
  if (text.includes("photo") || text.includes("image") || text.includes("picture")) return "Camera"
  if (text.includes("video") || text.includes("animation") || text.includes("film")) return "Film"

  // Digital Marketing
  if (text.includes("social") || text.includes("facebook") || text.includes("instagram") || text.includes("linkedin"))
    return "Share2"
  if (text.includes("ad") || text.includes("advertising") || text.includes("ppc") || text.includes("paid"))
    return "Megaphone"
  if (text.includes("seo") || text.includes("search engine") || text.includes("organic")) return "Search"

  // Content & Email
  if (text.includes("email") || text.includes("newsletter") || text.includes("mail")) return "Mail"
  if (text.includes("content") || text.includes("blog") || text.includes("article") || text.includes("copy"))
    return "FileText"
  if (text.includes("crm") || text.includes("customer") || text.includes("database")) return "Database"

  // Analytics & Tracking
  if (text.includes("analytics") || text.includes("tracking") || text.includes("data") || text.includes("report"))
    return "BarChart"
  if (text.includes("conversion") || text.includes("funnel") || text.includes("optimization")) return "TrendingUp"

  // Website & Tech
  if (text.includes("website") || text.includes("web") || text.includes("landing page") || text.includes("site"))
    return "Globe"
  if (text.includes("app") || text.includes("mobile") || text.includes("platform")) return "Smartphone"
  if (text.includes("integration") || text.includes("api") || text.includes("automation")) return "Settings"

  // Events & PR
  if (text.includes("event") || text.includes("conference") || text.includes("webinar")) return "Calendar"
  if (text.includes("pr") || text.includes("press") || text.includes("media") || text.includes("outreach"))
    return "Newspaper"
  if (text.includes("partnership") || text.includes("collaboration") || text.includes("sponsor")) return "Users"

  // Default icon
  return "Sparkles"
}

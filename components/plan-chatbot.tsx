"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePlanStore } from "@/lib/store"
import { MessageSquare, Send, X, Sparkles, Loader2, Trash2, Plus, Settings, Undo2, FileText, BookOpen, Target, ChevronDown, Pencil } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

type ChatMode = "chat" | "edit"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    action?: {
        type: "add_section" | "edit_section" | "add_tactic"
        data?: any
    }
}

interface ContextChip {
    id: string
    type: "section" | "tactic" | "reference" | "full_plan"
    title: string
    content?: string
}

interface PlanChatbotProps {
    isOpen: boolean
    onClose: () => void
}

const AI_MODELS = [
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Best reasoning" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Fast" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Creative" },
]

export function PlanChatbot({ isOpen, onClose }: PlanChatbotProps) {
    const { currentPlan, updateBlock, addBlock, setCurrentPlan } = usePlanStore()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview")
    const [contextChips, setContextChips] = useState<ContextChip[]>([])
    const [showContextPicker, setShowContextPicker] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [planHistory, setPlanHistory] = useState<any[]>([])
    const [mode, setMode] = useState<ChatMode>("edit") // Default to edit mode
    const [panelWidth, setPanelWidth] = useState(440) // Default width
    const [isResizing, setIsResizing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Handle panel resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const newWidth = window.innerWidth - e.clientX
            setPanelWidth(Math.max(320, Math.min(800, newWidth)))
        }
        const handleMouseUp = () => setIsResizing(false)

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing])

    // Fetch references when dialog opens
    const [references, setReferences] = useState<ContextChip[]>([])
    const [loadingReferences, setLoadingReferences] = useState(false)

    useEffect(() => {
        if (showContextPicker && currentPlan?.id) {
            fetchReferences()
        }
    }, [showContextPicker, currentPlan?.id])

    const fetchReferences = async () => {
        if (!currentPlan?.id) return
        setLoadingReferences(true)
        try {
            const response = await fetch(`/api/plans/${currentPlan.id}/references`)
            if (response.ok) {
                const data = await response.json()
                const refs = (data.references || []).map((ref: any) => ({
                    id: ref.id,
                    type: "reference" as const,
                    title: ref.title,
                    content: ref.content,
                }))
                setReferences(refs)
            }
        } catch (error) {
            console.error("Error fetching references:", error)
        } finally {
            setLoadingReferences(false)
        }
    }

    // Get all available context items
    const getAvailableContext = () => {
        if (!currentPlan) return { sections: [], tactics: [] }

        const sections: ContextChip[] = []
        const tactics: ContextChip[] = []

        const processBlocks = (blocks: any[]) => {
            for (const block of blocks) {
                if (block.type === "section") {
                    sections.push({
                        id: block.id,
                        type: "section",
                        title: block.title || "Untitled Section",
                        content: block.description,
                    })
                } else if (block.type === "tactic") {
                    tactics.push({
                        id: block.id,
                        type: "tactic",
                        title: block.title || "Untitled Tactic",
                        content: block.content,
                    })
                }
                if (block.children) {
                    processBlocks(block.children)
                }
            }
        }

        if (currentPlan.blocks) {
            processBlocks(currentPlan.blocks)
        }

        return { sections, tactics }
    }

    const addContextChip = (chip: ContextChip) => {
        if (!contextChips.find(c => c.id === chip.id)) {
            setContextChips([...contextChips, chip])
        }
        setShowContextPicker(false)
    }

    const removeContextChip = (chipId: string) => {
        setContextChips(contextChips.filter(c => c.id !== chipId))
    }

    const addFullPlanContext = () => {
        const existingFullPlan = contextChips.find(c => c.type === "full_plan")
        if (!existingFullPlan) {
            setContextChips([...contextChips, {
                id: "full_plan",
                type: "full_plan",
                title: "Full Plan",
            }])
        }
        setShowContextPicker(false)
    }

    // Save plan state for undo
    const savePlanState = () => {
        if (currentPlan) {
            setPlanHistory(prev => [...prev.slice(-9), JSON.parse(JSON.stringify(currentPlan))])
        }
    }

    const handleUndo = () => {
        if (planHistory.length > 0) {
            const previousState = planHistory[planHistory.length - 1]
            setCurrentPlan(previousState)
            setPlanHistory(prev => prev.slice(0, -1))
            toast({ title: "Undo successful", description: "Previous change has been reverted" })
        } else {
            toast({ title: "Nothing to undo", description: "No previous states available", variant: "destructive" })
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        // Auto-add full plan context if nothing selected
        let activeChips = contextChips
        if (activeChips.length === 0) {
            activeChips = [{
                id: "full_plan",
                type: "full_plan",
                title: "Full Plan",
            }]
            setContextChips(activeChips)
        }

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        try {
            // Build context from chips (using activeChips which may include auto-added full plan)
            let fullContext = ""
            const includeFullPlan = activeChips.some(c => c.type === "full_plan")

            if (includeFullPlan && currentPlan) {
                fullContext = buildFullPlanContext()
            } else {
                // Build context from selected chips
                for (const chip of activeChips) {
                    if (chip.type === "section" || chip.type === "tactic") {
                        const block = findBlockById(chip.id)
                        if (block) {
                            fullContext += `\n\n### ${chip.type === "section" ? "Section" : "Tactic"}: ${block.title} [block:${block.id}]\n`
                            if (block.content) fullContext += block.content
                            if (block.sourceContext) fullContext += `\n\n**Source Context:** ${block.sourceContext}`
                        }
                    } else if (chip.type === "reference") {
                        // Reference content comes from the chip itself
                        fullContext += `\n\n### Reference: ${chip.title}\n`
                        if (chip.content) fullContext += chip.content.substring(0, 2000)
                    }
                }
            }

            // If a specific block/tactic is selected as context, pass its ID as the target
            const selectedBlock = activeChips.find(c => c.type === "section" || c.type === "tactic")
            const targetBlockId = selectedBlock?.id

            const response = await fetch("/api/chat/orchestrated", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    model: selectedModel,
                    mode: mode, // chat or edit mode
                    executeImmediately: mode === "edit", // In edit mode, execute actions immediately
                    targetBlockId: targetBlockId, // Explicit target block from selected context
                    planContext: {
                        planId: currentPlan?.id,
                        planTitle: currentPlan?.title,
                        objective: currentPlan?.objective,
                        clientName: currentPlan?.clientName,
                        fullContent: fullContext,
                    },
                    conversationHistory: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            })

            if (!response.ok) throw new Error("Failed to get response")

            const data = await response.json()

            // Handle actions if the orchestrator decides to take action
            if (data.action) {
                savePlanState() // Save for undo before making changes
                // Support for multiple actions (e.g., merge = edit + delete)
                if (Array.isArray(data.action)) {
                    for (const singleAction of data.action) {
                        await handleAction(singleAction)
                    }
                } else {
                    await handleAction(data.action)
                }
            }

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.response,
                timestamp: new Date(),
                action: data.action,
            }

            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error("Chat error:", error)
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const handleAction = async (action: any) => {
        console.log("[Chatbot] handleAction called with:", JSON.stringify(action).substring(0, 300))

        switch (action.type) {
            case "edit_section":
            case "edit_block":
                if (action.blockId) {
                    // Verify block exists in current plan before updating
                    const targetBlock = findBlockById(action.blockId)
                    if (!targetBlock) {
                        console.error("[Chatbot] Block not found in current plan:", action.blockId)
                        toast({
                            title: "⚠️ Block Not Found",
                            description: "The block could not be found in your current plan. Please try again.",
                            variant: "destructive"
                        })
                        return
                    }

                    console.log("[Chatbot] Updating block:", action.blockId, "Title:", targetBlock.title, "Content length:", action.content?.length || 0, "New Title:", action.title, "Icon:", action.icon)

                    // Apply content if provided (non-empty)
                    if (action.content && action.content.length > 0) {
                        updateBlock(action.blockId, { content: action.content })
                    }
                    // Apply title if provided
                    if (action.title) {
                        updateBlock(action.blockId, { title: action.title })
                    }
                    // Apply icon if provided
                    if (action.icon) {
                        updateBlock(action.blockId, { icon: action.icon })
                    }

                    // Determine what was updated for toast message
                    const updates = []
                    if (action.content && action.content.length > 0) updates.push("content")
                    if (action.title) updates.push("title")
                    if (action.icon) updates.push("icon")

                    toast({
                        title: "✅ Updated",
                        description: `Updated ${updates.join(", ")} in "${targetBlock.title}"`
                    })
                } else {
                    console.log("[Chatbot] Missing blockId - blockId:", action.blockId)
                }
                break
            case "add_section":
                if (action.section) {
                    // Create the section block with proper structure
                    const newSection = {
                        id: crypto.randomUUID(),
                        type: "section" as const,
                        title: action.section.title,
                        description: action.section.description || "",
                        order: currentPlan?.blocks?.length || 0,
                        parentId: undefined, // Root level
                        children: action.section.children?.map((child: any, i: number) => ({
                            id: crypto.randomUUID(),
                            ...child,
                            order: i,
                        })) || [],
                    }
                    addBlock(newSection as any)
                    toast({ title: "✅ Section Added", description: `Added: ${action.section.title}` })
                }
                break
            case "add_tactic":
                if (action.tactic) {
                    const newTactic = {
                        id: crypto.randomUUID(),
                        type: "tactic" as const,
                        title: action.tactic.title,
                        content: action.tactic.content,
                        hours: action.tactic.hours || 8,
                        icon: action.tactic.icon || "Target",
                        order: 0,
                        parentId: action.parentId || undefined,
                    }
                    addBlock(newTactic as any)
                    toast({ title: "✅ Tactic Added", description: `Added: ${action.tactic.title}` })
                }
                break
            case "delete_block":
                if (action.blockId) {
                    const { deleteBlock } = usePlanStore.getState()
                    deleteBlock(action.blockId)
                    toast({ title: "🗑️ Deleted", description: "Block has been removed" })
                }
                break
            case "reorder_blocks":
                // Support both startIndex/endIndex and fromIndex/toIndex
                const fromIdx = action.startIndex ?? action.fromIndex
                const toIdx = action.endIndex ?? action.toIndex
                if (fromIdx !== undefined && toIdx !== undefined) {
                    const { reorderBlocks } = usePlanStore.getState()
                    reorderBlocks(fromIdx, toIdx)
                    toast({ title: "↕️ Reordered", description: "Blocks have been reordered" })
                }
                break
            case "move_to_phase":
                if (action.blockId && action.targetPhaseId) {
                    // Update the block's parentId to move it to the new phase
                    updateBlock(action.blockId, { parentId: action.targetPhaseId })
                    toast({ title: "📁 Moved", description: "Tactic moved to new phase" })
                }
                break
        }
    }

    const findBlockById = (id: string): any => {
        if (!currentPlan?.blocks) return null

        const search = (blocks: any[]): any => {
            for (const block of blocks) {
                if (block.id === id) return block
                if (block.children) {
                    const found = search(block.children)
                    if (found) return found
                }
            }
            return null
        }
        return search(currentPlan.blocks)
    }

    const buildFullPlanContext = () => {
        if (!currentPlan) return ""

        let context = `# Marketing Plan: ${currentPlan.title}\n`
        context += `**Client:** ${currentPlan.clientName || "Not specified"}\n`
        context += `**Objective:** ${currentPlan.objective || "Not specified"}\n\n`

        const processBlocks = (blocks: any[], depth = 0) => {
            for (const block of blocks) {
                const indent = "  ".repeat(depth)
                // Include block ID for reference
                if (block.type === "section") {
                    context += `\n${indent}## ${block.title} [block:${block.id}]\n`
                    if (block.description) context += `${indent}${block.description}\n`
                } else if (block.type === "tactic") {
                    context += `\n${indent}### Tactic: ${block.title} [block:${block.id}]\n`
                    if (block.content) context += `${indent}${block.content}\n`
                    if (block.hours) context += `${indent}*Hours: ${block.hours}*\n`
                    if (block.sourceContext) context += `${indent}> Source: ${block.sourceContext}\n`
                } else if (block.type === "text") {
                    if (block.title) context += `\n${indent}### ${block.title} [block:${block.id}]\n`
                    if (block.content) context += `${indent}${block.content}\n`
                }
                if (block.children) {
                    processBlocks(block.children, depth + 1)
                }
            }
        }

        if (currentPlan.blocks) {
            processBlocks(currentPlan.blocks)
        }

        return context
    }

    const clearHistory = () => {
        setMessages([])
    }

    const { sections, tactics } = getAvailableContext()

    if (!isOpen) return null

    return (
        <div
            ref={panelRef}
            className="fixed right-0 top-0 h-full bg-background border-l shadow-2xl z-50 flex flex-col"
            style={{ width: `${panelWidth}px` }}
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-violet-500/30 transition-colors group z-10"
                onMouseDown={() => setIsResizing(true)}
            >
                <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-16 bg-muted-foreground/20 rounded-full group-hover:bg-violet-500" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg",
                        mode === "edit"
                            ? "bg-gradient-to-br from-amber-500 to-orange-600"
                            : "bg-gradient-to-br from-violet-500 to-purple-600"
                    )}>
                        {mode === "edit" ? (
                            <Pencil className="w-5 h-5 text-white" />
                        ) : (
                            <MessageSquare className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <div>
                        <h2 className="font-semibold text-lg">Plan Assistant</h2>
                        <p className="text-xs text-muted-foreground">
                            {mode === "edit" ? "Edit mode - Changes apply immediately" : "Chat mode - Discussion only"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Mode Toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5 mr-2">
                        <button
                            onClick={() => setMode("chat")}
                            className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                                mode === "chat"
                                    ? "bg-white shadow text-violet-600"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <MessageSquare className="w-3 h-3 inline mr-1" />
                            Chat
                        </button>
                        <button
                            onClick={() => setMode("edit")}
                            className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                                mode === "edit"
                                    ? "bg-amber-500 shadow text-white"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Pencil className="w-3 h-3 inline mr-1" />
                            Edit
                        </button>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUndo}
                        disabled={planHistory.length === 0}
                        className="h-8 w-8"
                        title="Undo last change"
                    >
                        <Undo2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-medium">How can I help with your plan?</p>
                        <p className="text-xs mt-2 max-w-[280px] mx-auto">
                            I can answer questions, help write sections, add tactics, and edit content.
                            Use the + button to add context.
                        </p>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex",
                            message.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3",
                                message.role === "user"
                                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                                    : "bg-muted"
                            )}
                        >
                            {message.role === "assistant" ? (
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ node, ...props }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="mb-2 text-sm list-disc pl-4 space-y-0.5" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="mb-2 text-sm list-decimal pl-4 space-y-0.5" {...props} />,
                                            li: ({ node, ...props }) => <li className="text-sm" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                                            em: ({ node, ...props }) => <em className="italic" {...props} />,
                                            code: ({ node, ...props }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                            table: ({ node, ...props }) => <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse" {...props} /></div>,
                                            thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                                            th: ({ node, ...props }) => <th className="border border-border px-2 py-1 text-left font-medium" {...props} />,
                                            td: ({ node, ...props }) => <td className="border border-border px-2 py-1" {...props} />,
                                            blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-violet-500 pl-3 italic text-muted-foreground my-2" {...props} />,
                                            hr: ({ node, ...props }) => <hr className="my-3 border-border" {...props} />,
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                    {message.action && (
                                        <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            Action: {Array.isArray(message.action)
                                                ? `${message.action.length} actions`
                                                : message.action.type?.replace("_", " ") || "update"
                                            }
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm">{message.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-4 py-3">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-background space-y-3">
                {/* Context Chips */}
                {contextChips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {contextChips.map(chip => (
                            <div
                                key={chip.id}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                                    chip.type === "full_plan" && "bg-violet-100 text-violet-700 border border-violet-200",
                                    chip.type === "section" && "bg-amber-100 text-amber-700 border border-amber-200",
                                    chip.type === "tactic" && "bg-blue-100 text-blue-700 border border-blue-200",
                                    chip.type === "reference" && "bg-green-100 text-green-700 border border-green-200"
                                )}
                            >
                                {chip.type === "full_plan" && <FileText className="w-3 h-3" />}
                                {chip.type === "section" && <Target className="w-3 h-3" />}
                                {chip.type === "tactic" && <Sparkles className="w-3 h-3" />}
                                {chip.type === "reference" && <BookOpen className="w-3 h-3" />}
                                <span className="max-w-[120px] truncate">{chip.title}</span>
                                <button
                                    onClick={() => removeContextChip(chip.id)}
                                    className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input with + and settings */}
                <div className="relative">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your plan, request edits..."
                        className="min-h-[80px] resize-none pr-20 pb-10"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                    />

                    {/* Bottom toolbar inside textarea */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            {/* Add Context Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowContextPicker(true)}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                <span className="text-xs">Context</span>
                            </Button>

                            {/* Settings Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSettings(!showSettings)}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                                <Settings className="w-4 h-4" />
                            </Button>

                            {/* Clear Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearHistory}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        {/* Send Button */}
                        <Button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            size="sm"
                            className="h-7 px-3"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Settings Dropdown */}
                {showSettings && (
                    <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-muted-foreground w-12">Model</label>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="flex-1 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_MODELS.map(model => (
                                        <SelectItem key={model.id} value={model.id}>
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 text-violet-500" />
                                                <span className="text-xs">{model.name}</span>
                                                <span className="text-xs text-muted-foreground">• {model.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {/* Context Picker Dialog */}
            <Dialog open={showContextPicker} onOpenChange={setShowContextPicker}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Add Context</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 overflow-y-auto flex-1">
                        {/* Full Plan Option */}
                        <button
                            onClick={addFullPlanContext}
                            className="w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left flex items-center gap-3"
                        >
                            <div className="p-2 rounded-lg bg-violet-100">
                                <FileText className="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                                <div className="font-medium text-sm">Full Plan</div>
                                <div className="text-xs text-muted-foreground">Include the entire marketing plan</div>
                            </div>
                        </button>

                        {/* References */}
                        {(loadingReferences || references.length > 0) && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">References</div>
                                {loadingReferences ? (
                                    <div className="text-sm text-muted-foreground">Loading references...</div>
                                ) : (
                                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                                        {references.map(ref => (
                                            <button
                                                key={ref.id}
                                                onClick={() => addContextChip(ref)}
                                                disabled={contextChips.some(c => c.id === ref.id)}
                                                className="w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <BookOpen className="w-4 h-4 text-green-600" />
                                                <span className="text-sm truncate">{ref.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sections */}
                        {sections.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sections</div>
                                <div className="max-h-[150px] overflow-y-auto space-y-1">
                                    {sections.map(section => (
                                        <button
                                            key={section.id}
                                            onClick={() => addContextChip(section)}
                                            disabled={contextChips.some(c => c.id === section.id)}
                                            className="w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Target className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm truncate">{section.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tactics */}
                        {tactics.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tactics</div>
                                <div className="max-h-[150px] overflow-y-auto space-y-1">
                                    {tactics.map(tactic => (
                                        <button
                                            key={tactic.id}
                                            onClick={() => addContextChip(tactic)}
                                            disabled={contextChips.some(c => c.id === tactic.id)}
                                            className="w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Sparkles className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm truncate">{tactic.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

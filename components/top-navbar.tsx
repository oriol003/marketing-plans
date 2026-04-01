"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"

const mainNav = [
  { label: "Dashboard", href: "/plans" },
  { label: "Plans", href: "/plans/create" },
  { label: "Blocks", href: "/templates" },
]

const moreNav: { label: string; href: string }[] = []

export function TopNavbar() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Hide main nav when inside the plan editor (it has its own nav)
  const isEditorPage = /^\/plans\/[^/]+$/.test(pathname)
  if (isEditorPage) return null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const isActive = (href: string) => {
    if (href === "/plans") return pathname === "/plans" || pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <nav className="h-12 bg-[#1a1d21] border-b border-[#2a2d31] flex items-center px-4 gap-1 text-sm select-none">
      {/* Brand */}
      <Link href="/plans" className="flex items-center gap-0 mr-2 shrink-0">
        <Image src="/logo-codesm.svg" alt="code[SM]" width={110} height={23} className="h-[23px] w-auto" />
        <span className="text-[#555] mx-1.5">/</span>
        <span className="text-[#999] font-medium">Plans</span>
        <ChevronDown className="w-3 h-3 text-[#666] ml-0.5" />
      </Link>

      {/* Divider */}
      <div className="w-px h-5 bg-[#2a2d31] mx-2" />

      {/* Nav Links */}
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "px-3 py-1.5 rounded-md font-medium transition-colors",
            isActive(item.href)
              ? "bg-[#2a2d31] text-white"
              : "text-[#9a9da1] hover:text-white hover:bg-[#222529]"
          )}
        >
          {item.label}
        </Link>
      ))}

      {/* More dropdown */}
      {moreNav.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1",
              moreOpen
                ? "bg-[#2a2d31] text-white"
                : "text-[#9a9da1] hover:text-white hover:bg-[#222529]"
            )}
          >
            More
            <ChevronDown className={cn("w-3 h-3 transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#1a1d21] border border-[#2a2d31] rounded-lg shadow-xl py-1 min-w-[160px] z-50">
              {moreNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-[#2a2d31] text-white"
                      : "text-[#9a9da1] hover:text-white hover:bg-[#222529]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}

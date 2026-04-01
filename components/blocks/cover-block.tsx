"use client"

import { CoverBlock as CoverBlockType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import { usePlanStore } from '@/lib/store';
import { useState, useEffect, useRef, useCallback } from 'react';

interface CoverBlockProps {
  block: CoverBlockType;
  dragHandleProps?: any;
  logo?: string;
}

// Inline editable text — double-click to edit, blur/enter to save
function InlineEdit({
  value,
  onChange,
  className = '',
  placeholder = '',
  multiline = false,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }, [draft, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  };

  if (editing) {
    const shared = {
      ref: ref as any,
      value: draft,
      onChange: (e: any) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: `${className} bg-white/60 backdrop-blur-sm border border-[#FF6B35]/30 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[#FF6B35]/40 w-full`,
      placeholder,
    };
    return multiline
      ? <textarea {...shared} rows={3} />
      : <input {...shared} />;
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className={`${className} cursor-text hover:bg-black/[0.03] rounded px-1 -mx-1 transition-colors inline-block`}
      title="Double-click to edit"
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </span>
  );
}

export function CoverBlock({ block, dragHandleProps, logo }: CoverBlockProps) {
  const { updateBlock, deleteBlock } = usePlanStore();

  // Split title: last word gets the orange accent
  const titleWords = block.title.split(' ');
  const titleMain = titleWords.slice(0, -1).join(' ');
  const titleAccent = titleWords.slice(-1)[0] || '';

  return (
    <div className="relative group overflow-hidden shadow-xl aspect-[8.5/11]">
      <div className="hidden" {...dragHandleProps}>
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/60" />

      {/* Subtle decorative shapes */}
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#FF6B35]/8 to-[#FFB347]/12 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-[#00A7B5]/6 to-[#00A7B5]/3 blur-3xl" />
      <div className="absolute top-1/3 right-0 w-1 h-40 bg-gradient-to-b from-[#FF6B35]/0 via-[#FF6B35]/20 to-[#FF6B35]/0" />

      {/* Delete button */}
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button variant="secondary" size="icon" onClick={() => deleteBlock(block.id)} className="h-8 w-8 bg-white/90 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="relative px-14 py-14 h-full flex flex-col">
        {/* Top: Logos */}
        <div className="flex items-center">
          {logo && (
            <>
              <img src={logo} alt="Client logo" className="h-12 w-auto max-w-[160px] object-contain" />
              <div className="w-px h-8 bg-gray-300/80 mx-5" />
            </>
          )}
          <img
            src="https://trymaas.com/images/maas-logo.svg"
            alt="MaaS by CodeSM"
            className="h-9 w-auto max-w-[140px] object-contain"
          />
        </div>

        {/* Middle: Main content */}
        <div className="flex-1 flex flex-col justify-center -mt-4">
          <div className="space-y-7">
            {/* Badge */}
            <div className="inline-flex items-center gap-2">
              <div className="w-8 h-px bg-[#FF6B35]" />
              <InlineEdit
                value={block.badgeLabel || 'STRATEGIC ROADMAP'}
                onChange={(val) => updateBlock(block.id, { badgeLabel: val })}
                className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#FF6B35]"
                placeholder="STRATEGIC ROADMAP"
              />
            </div>

            {/* Title — inline editable, double-click */}
            <div>
              <InlineEdit
                value={block.title}
                onChange={(val) => updateBlock(block.id, { title: val })}
                className="text-[3.2rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 block"
                placeholder="Plan Title"
              />
            </div>

            {/* Subtitle */}
            <InlineEdit
              value={block.subtitle || ''}
              onChange={(val) => updateBlock(block.id, { subtitle: val })}
              className="text-[15px] leading-relaxed text-gray-500 max-w-lg block"
              placeholder="A brief description of the marketing strategy and objectives..."
              multiline
            />
          </div>
        </div>

        {/* Bottom: Client info + Period */}
        <div className="mt-auto">
          <div className="h-px bg-gradient-to-r from-[#00A7B5]/40 via-gray-200 to-[#FF6B35]/40 mb-6" />

          <div className="flex items-end justify-between">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#00A7B5]">
                Prepared For
              </p>
              <InlineEdit
                value={block.clientName}
                onChange={(val) => updateBlock(block.id, { clientName: val })}
                className="text-lg font-bold text-gray-900"
                placeholder="Client Name"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#00A7B5]">
                Execution Period
              </p>
              <InlineEdit
                value={block.executionPeriod || ''}
                onChange={(val) => updateBlock(block.id, { executionPeriod: val })}
                className="text-lg font-bold text-gray-900 text-right"
                placeholder="Q4 2025 — 2026"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-[#00A7B5]" />
        <div className="flex-[2] bg-gradient-to-r from-[#FF6B35] to-[#FFB347]" />
        <div className="flex-[0.5] bg-gray-900" />
      </div>
    </div>
  );
}

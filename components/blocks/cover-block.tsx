"use client"

import { CoverBlock as CoverBlockType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Pencil, Trash2, Check, X, ChevronDown } from 'lucide-react';
import { usePlanStore } from '@/lib/store';
import { useState, useEffect } from 'react';

interface CoverBlockProps {
  block: CoverBlockType;
  dragHandleProps?: any;
  logo?: string; // Added logo prop
}

export function CoverBlock({ block, dragHandleProps, logo }: CoverBlockProps) {
  const { updateBlock, deleteBlock } = usePlanStore();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(block.title);
  const [subtitle, setSubtitle] = useState(block.subtitle || '');
  const [clientName, setClientName] = useState(block.clientName);
  const [executionPeriod, setExecutionPeriod] = useState(block.executionPeriod || '');
  const [branding, setBranding] = useState(block.branding || 'CODESM MARKETING');
  const [badgeLabel, setBadgeLabel] = useState(block.badgeLabel || 'STRATEGIC ROADMAP');

  useEffect(() => {
    setTitle(block.title);
    setSubtitle(block.subtitle || '');
    setClientName(block.clientName);
    setExecutionPeriod(block.executionPeriod || '');
    setBranding(block.branding || 'CODESM MARKETING');
    setBadgeLabel(block.badgeLabel || 'STRATEGIC ROADMAP');
  }, [block]);

  const handleSave = () => {
    updateBlock(block.id, { 
      title, 
      subtitle, 
      clientName, 
      executionPeriod,
      branding,
      badgeLabel
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(block.title);
    setSubtitle(block.subtitle || '');
    setClientName(block.clientName);
    setExecutionPeriod(block.executionPeriod || '');
    setBranding(block.branding || 'CODESM MARKETING');
    setBadgeLabel(block.badgeLabel || 'STRATEGIC ROADMAP');
    setIsEditing(false);
  };

  return (
    <div className="relative group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl aspect-[8.5/11]">
      <div className="hidden" {...dragHandleProps}>
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Decorative elements */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#00A7B5] via-[#FF6B35] to-[#FF6B35]" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#FF6B35] to-[#FF8C5E] rounded-full -translate-y-1/3 translate-x-1/3" />
      
      {/* Action buttons */}
      <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {isEditing ? (
          <>
            <Button variant="secondary" size="icon" onClick={handleSave} className="h-9 w-9 bg-white/90 backdrop-blur-sm shadow-sm">
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button variant="secondary" size="icon" onClick={handleCancel} className="h-9 w-9 bg-white/90 backdrop-blur-sm shadow-sm">
              <X className="w-4 h-4 text-red-600" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="icon" onClick={() => setIsEditing(true)} className="h-9 w-9 bg-white/90 backdrop-blur-sm shadow-sm">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => deleteBlock(block.id)} className="h-9 w-9 bg-white/90 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      <div className="relative px-16 py-20 h-full flex flex-col justify-between bg-gradient-to-br from-white via-orange-50/20 to-teal-50/20">
        {/* Top section */}
        <div className="space-y-10">
          {logo && (
            <div className="absolute top-8 right-8 z-10">
              <div className="bg-white rounded-lg shadow-md p-3 border border-gray-100">
                <img 
                  src={logo || "/placeholder.svg"} 
                  alt="Customer logo" 
                  className="h-12 w-auto max-w-[120px] object-contain"
                />
              </div>
            </div>
          )}

          {/* Branding */}
          {isEditing ? (
            <Input
              value={branding}
              onChange={(e) => setBranding(e.target.value)}
              className="max-w-md font-semibold text-sm tracking-widest uppercase bg-white"
              placeholder="BRAND NAME"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-[#00A7B5] rounded-full" />
              <p className="font-semibold text-sm tracking-widest uppercase text-gray-800">
                {branding}
              </p>
            </div>
          )}

          {/* Badge */}
          {isEditing ? (
            <Input
              value={badgeLabel}
              onChange={(e) => setBadgeLabel(e.target.value)}
              className="max-w-xs bg-white"
              placeholder="STRATEGIC ROADMAP"
            />
          ) : (
            <div className="inline-block px-4 py-2 bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-md">
              <span className="text-xs font-bold tracking-widest uppercase text-[#FF6B35]">
                {badgeLabel}
              </span>
            </div>
          )}

          {/* Title and subtitle */}
          <div className="max-w-2xl space-y-6">
            {isEditing ? (
              <>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-5xl font-bold bg-white"
                  placeholder="Plan Title"
                />
                <Textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="text-base min-h-[100px] bg-white"
                  placeholder="A comprehensive description of the marketing strategy and objectives..."
                />
              </>
            ) : (
              <>
                <h1 className="text-6xl font-bold leading-tight tracking-tight">
                  {title.split(' ').slice(0, -1).join(' ')}{' '}
                  <span className="text-[#FF6B35]">
                    {title.split(' ').slice(-1)}
                  </span>
                </h1>
                <div className="w-24 h-1.5 bg-[#00A7B5] rounded-full" />
                {subtitle && (
                  <p className="text-base leading-relaxed text-gray-600 max-w-xl">
                    {subtitle}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom section */}
        <div className="flex items-end justify-between mt-auto pt-24">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00A7B5]">
              Prepared For
            </p>
            {isEditing ? (
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="text-xl font-bold max-w-xs bg-white"
                placeholder="Client Name"
              />
            ) : (
              <p className="text-xl font-bold text-gray-900">{clientName}</p>
            )}
          </div>

          <div className="space-y-2 text-right">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00A7B5]">
              Execution Period
            </p>
            {isEditing ? (
              <Input
                value={executionPeriod}
                onChange={(e) => setExecutionPeriod(e.target.value)}
                className="text-xl font-bold text-right max-w-xs bg-white"
                placeholder="Q4 2025 — 2026"
              />
            ) : (
              <p className="text-xl font-bold text-gray-900">{executionPeriod || 'TBD'}</p>
            )}
          </div>
        </div>

        {/* Down arrow indicator */}
        <div className="absolute bottom-8 right-8">
          <div className="w-10 h-10 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-lg">
            <ChevronDown className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {/* Bottom color bar */}
      <div className="absolute bottom-0 left-0 right-0 h-2 flex">
        <div className="flex-1 bg-[#00A7B5]" />
        <div className="flex-[1.5] bg-[#FF6B35]" />
        <div className="flex-1 bg-gray-900" />
      </div>
    </div>
  );
}

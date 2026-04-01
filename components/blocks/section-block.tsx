'use client';

import { SectionBlock as SectionBlockType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Plus, MoreVertical, Trash2, Pencil, Check, X, Sparkles, ImageIcon, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PHASE_COLORS = [
  '#1DB5C4', // Strategic Teal
  '#FF9500', // Primary Orange
  '#2A3441', // Executive Dark
  '#4F46E5', // indigo
  '#059669', // emerald
  '#7C3AED', // violet
  '#DB2777', // pink
  '#2563EB', // blue
  '#B45309', // amber-dark
  '#DC2626', // red
];

interface SectionBlockProps {
  block: SectionBlockType;
  onUpdate: (id: string, updates: Partial<SectionBlockType>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  dragHandleProps?: any;
  children?: React.ReactNode;
  isFirst?: boolean;
}

export function SectionBlock({
  block,
  onUpdate,
  onDelete,
  onAddChild,
  dragHandleProps,
  children,
  isFirst
}: SectionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(block.title);
  const [description, setDescription] = useState(block.description || '');
  const [icon, setIcon] = useState(block.icon || 'Folder');
  const [color, setColor] = useState(block.color || '#1DB5C4');
  const [coverImage, setCoverImage] = useState(block.coverImage || '');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'description' | null>(null);
  const [isDarkImage, setIsDarkImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);

  const SectionIcon = (LucideIcons as any)[block.icon || 'Folder'] || LucideIcons.Folder;
  const sectionColor = block.color || '#1DB5C4';
  const sectionNumber = String(block.sectionNumber || '01').padStart(2, '0');
  const hasCover = !!coverImage;

  // Detect image brightness to decide text color
  const detectImageBrightness = useCallback((src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 50;
      canvas.height = 30;
      ctx.drawImage(img, 0, 0, 50, 30);
      const data = ctx.getImageData(0, 0, 50, 30).data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      setIsDarkImage(avgBrightness < 140);
    };
    img.src = src;
  }, []);

  const saveInlineField = (field: 'title' | 'description') => {
    onUpdate(block.id, { [field]: field === 'title' ? title : description });
    setEditingField(null);
  };

  // Sync from props using individual values — NOT the block object reference,
  // which changes every render due to parent spreading { ...block, sectionNumber }.
  // Skip coverImage sync while generating to avoid resetting mid-flight.
  useEffect(() => { setTitle(block.title); }, [block.title]);
  useEffect(() => { setDescription(block.description || ''); }, [block.description]);
  useEffect(() => { setIcon(block.icon || 'Folder'); }, [block.icon]);
  useEffect(() => { setColor(block.color || '#1DB5C4'); }, [block.color]);
  useEffect(() => {
    if (!generatingRef.current) {
      setCoverImage(block.coverImage || '');
    }
  }, [block.coverImage]);

  useEffect(() => {
    if (coverImage) {
      detectImageBrightness(coverImage);
    } else {
      setIsDarkImage(false);
    }
  }, [coverImage, detectImageBrightness]);

  const handleSave = () => {
    onUpdate(block.id, { title, description, icon, color, coverImage });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(block.title);
    setDescription(block.description || '');
    setIcon(block.icon || 'Folder');
    setColor(block.color || '#1DB5C4');
    setCoverImage(block.coverImage || '');
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsGeneratingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'marketing-plans/phase-images');
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { imageUrl } = await res.json();
      setCoverImage(imageUrl);
      onUpdate(block.id, { coverImage: imageUrl });
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateImage = async () => {
    // Abort any in-flight request for THIS section before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    generatingRef.current = true;
    setIsGeneratingImage(true);

    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch('/api/generate-phase-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: block.title, description: block.description, color: sectionColor }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        console.error('Image generation failed:', res.status);
        return;
      }
      const data = await res.json();
      // Only apply if this request wasn't aborted (i.e. still the latest)
      if (!controller.signal.aborted && data.imageUrl) {
        setCoverImage(data.imageUrl);
        onUpdate(block.id, { coverImage: data.imageUrl });
      } else if (!data.imageUrl) {
        console.warn('Image generation unavailable:', data.error || data.fallback);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name !== 'AbortError') {
        console.error('Error generating phase image:', err);
      }
    } finally {
      // Only clear generating state if this is still the active request
      if (abortControllerRef.current === controller) {
        generatingRef.current = false;
        setIsGeneratingImage(false);
        abortControllerRef.current = null;
      }
    }
  };

  // When there's a cover, always use white text — images are designed to be dark
  const textColor = hasCover ? '#ffffff' : '#2A3441';
  const subtextColor = hasCover ? 'rgba(255,255,255,0.75)' : undefined;
  const numberColor = hasCover ? 'rgba(255,255,255,0.25)' : sectionColor;
  const numberOpacity = hasCover ? 0.5 : 0.13;

  return (
    <div className="w-full">
      <div className="hidden" {...dragHandleProps} />

      {/* ─── PHASE BANNER ─── */}
      <div className={`group relative ${hasCover ? 'py-20 -mx-10 sm:-mx-16 px-10 sm:px-16' : 'mt-4 mb-6'} ${isFirst && !hasCover ? 'mt-0' : ''}`}>

        {/* Loading skeleton while generating */}
        {isGeneratingImage && !coverImage && (
          <div className="absolute inset-0 overflow-hidden rounded-sm pointer-events-none">
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                background: `linear-gradient(135deg, ${sectionColor}15 0%, ${sectionColor}25 30%, ${sectionColor}15 50%, ${sectionColor}20 70%, ${sectionColor}10 100%)`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${sectionColor}20 50%, transparent 100%)`,
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        )}

        {/* Cover image background */}
        {hasCover && (
          <>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              {/* Dark overlay for white-text readability */}
              <div className="absolute inset-0" style={{
                background: 'rgba(0,0,0,0.4)'
              }} />
            </div>
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 text-[10px] rounded-full ${hasCover ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setCoverImage(''); onUpdate(block.id, { coverImage: '' }); }}
              >
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            </div>
          </>
        )}

        {/* Phase header row */}
        <div className="flex items-start gap-6 relative z-[1]">
          {/* Large phase number */}
          <span
            className="font-heading font-black leading-none tracking-tighter flex-shrink-0"
            style={{
              color: numberColor,
              opacity: numberOpacity,
              fontSize: hasCover ? '7rem' : '5rem',
            }}
          >
            {sectionNumber}
          </span>

          {/* Title + description */}
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                {isEditing || editingField === 'title' ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => { if (editingField === 'title') saveInlineField('title'); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (editingField === 'title') saveInlineField('title'); }
                      if (e.key === 'Escape') { setTitle(block.title); setEditingField(null); }
                    }}
                    className="font-heading font-bold h-auto py-0 border-none shadow-none bg-transparent focus-visible:ring-1"
                    style={{ fontSize: '2rem', color: textColor }}
                    autoFocus
                  />
                ) : (
                  <h2
                    className="font-heading font-bold cursor-text hover:opacity-60 transition-opacity leading-tight"
                    style={{ fontSize: hasCover ? '2.25rem' : '2rem', color: textColor }}
                    onClick={() => { setTitle(block.title); setEditingField('title'); }}
                  >
                    {block.title}
                  </h2>
                )}
                {/* Colored underline accent */}
                <div
                  className="mt-3 h-[3px] w-20 rounded-full"
                  style={{ backgroundColor: hasCover ? 'rgba(255,255,255,0.5)' : sectionColor }}
                />
              </div>

              {/* Collapse toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 h-auto hover:bg-transparent flex-shrink-0 ml-auto mt-2"
                style={{ color: hasCover ? 'rgba(255,255,255,0.7)' : sectionColor }}
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </Button>
            </div>

            {/* Description */}
            {isEditing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 text-sm min-h-[50px]"
                placeholder="Describe this phase..."
              />
            ) : editingField === 'description' ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => saveInlineField('description')}
                onKeyDown={(e) => { if (e.key === 'Escape') { setDescription(block.description || ''); setEditingField(null); } }}
                className="mt-2 text-sm min-h-[40px] border-none shadow-none bg-transparent focus-visible:ring-1"
                placeholder="Describe this phase..."
                autoFocus
              />
            ) : (
              <p
                className="mt-2 text-[15px] leading-relaxed cursor-text transition-colors"
                style={{ color: subtextColor || undefined }}
                onClick={() => { setDescription(block.description || ''); setEditingField('description'); }}
              >
                {block.description || <span className={`italic ${hasCover ? 'opacity-50' : 'opacity-40 text-muted-foreground'}`}>Click to add description...</span>}
              </p>
            )}

            {/* Edit mode: color picker + save/cancel */}
            {isEditing && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs font-medium text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {PHASE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? '#fff' : 'transparent',
                        boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded-full cursor-pointer" />
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSave} className="text-green-600 h-7 text-xs">
                    <Check className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="text-red-600 h-7 text-xs">
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons (hover) */}
          {!isEditing && (
            <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${hasCover ? '[&_button]:text-white/70 [&_button:hover]:text-white' : ''}`}>
              <Button variant="ghost" size="sm" onClick={handleGenerateImage} disabled={isGeneratingImage} className="h-7 w-7 p-0" title="Generate AI image">
                {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 w-7 p-0" title="Upload image">
                <ImageIcon className="w-3.5 h-3.5" />
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="ghost" size="sm" onClick={() => onAddChild(block.id)} className="h-7 w-7 p-0" title="Add block inside section">
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="w-3.5 h-3.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4 mr-2" /> Edit Phase</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete Phase</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {!hasCover && <div className="mt-6" />}
      </div>

      {/* Clean border below banner */}
      {hasCover && <div className="-mx-10 sm:-mx-16 border-b border-gray-200/60" />}

      {/* Children */}
      {isExpanded && children && (
        <div className="space-y-0">
          {children}
        </div>
      )}
    </div>
  );
}

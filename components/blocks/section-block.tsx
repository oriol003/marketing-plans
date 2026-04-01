'use client';

import { SectionBlock as SectionBlockType } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GripVertical, ChevronDown, ChevronRight, Plus, MoreVertical, Trash2, Pencil, Check, X, Upload } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';

interface SectionBlockProps {
  block: SectionBlockType;
  onUpdate: (id: string, updates: Partial<SectionBlockType>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  dragHandleProps?: any;
  children?: React.ReactNode;
}

export function SectionBlock({ 
  block, 
  onUpdate, 
  onDelete, 
  onAddChild,
  dragHandleProps,
  children 
}: SectionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(block.title);
  const [description, setDescription] = useState(block.description || '');
  const [icon, setIcon] = useState(block.icon || 'Folder');
  const [color, setColor] = useState(block.color || '#00A7B5');
  const [coverImage, setCoverImage] = useState(block.coverImage || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(block.title);
    setDescription(block.description || '');
    setIcon(block.icon || 'Folder');
    setColor(block.color || '#00A7B5');
    setCoverImage(block.coverImage || '');
  }, [block]);

  const handleSave = () => {
    onUpdate(block.id, { title, description, icon, color, coverImage });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(block.title);
    setDescription(block.description || '');
    setIcon(block.icon || 'Folder');
    setColor(block.color || '#00A7B5');
    setCoverImage(block.coverImage || '');
    setIsEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCoverImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="hidden" {...dragHandleProps} />
      
      <div className="w-full group">
        <div className="flex items-center gap-4 mb-6">
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0 h-auto hover:bg-transparent flex-shrink-0"
            style={{ color: block.color || '#00A7B5' }}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </Button>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddChild(block.id)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Block
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Section
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-3 pl-16">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-bold text-2xl h-auto py-2 flex-1"
              placeholder="Section title"
            />
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-16 h-10"
            />
            <Button variant="ghost" size="icon" onClick={handleSave} className="text-green-600 h-9 w-9">
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancel} className="text-red-600 h-9 w-9">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-6 pl-16">
            <span 
              className="text-7xl font-bold leading-none opacity-40 flex-shrink-0"
              style={{ color: block.color || '#00A7B5' }}
            >
              {String(block.sectionNumber || '01').padStart(2, '0')}
            </span>
            <h2 className="text-4xl font-bold text-foreground leading-tight font-heading flex-1">{block.title}</h2>
          </div>
        )}
      </div>

      {isExpanded && children && (
        <div className="space-y-8">
          {children}
        </div>
      )}
    </div>
  );
}

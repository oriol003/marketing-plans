"use client"

import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
}

const popularIcons = [
  'Target', 'TrendingUp', 'BarChart', 'Users', 'Mail', 'Calendar',
  'Clock', 'Zap', 'Award', 'Bookmark', 'Camera', 'Database',
  'FileText', 'Film', 'Image', 'Lightbulb', 'Map', 'MessageSquare',
  'Newspaper', 'Package', 'Palette', 'Search', 'Settings', 'Share2',
  'ShoppingCart', 'Smartphone', 'Star', 'Tag', 'ThumbsUp', 'Video'
];

export function IconPicker({ value = 'Package', onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const IconComponent = (LucideIcons as any)[value] || LucideIcons.Package;
  
  const filteredIcons = search 
    ? popularIcons.filter(icon => icon.toLowerCase().includes(search.toLowerCase()))
    : popularIcons;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10">
          <IconComponent className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <ScrollArea className="h-[300px] pr-4">
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map((iconName) => {
                const Icon = (LucideIcons as any)[iconName];
                if (!Icon) return null;
                
                return (
                  <Button
                    key={iconName}
                    variant={value === iconName ? "default" : "outline"}
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => {
                      onChange(iconName);
                      setOpen(false);
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

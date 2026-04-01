'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconPicker } from '@/components/icon-picker';
import { Plus, Pencil, Trash2, Blocks } from 'lucide-react';
import * as Icons from 'lucide-react';
import { TacticTemplate } from '@/lib/types';
import Link from 'next/link';

const CATEGORIES = [
  'Strategy',
  'Brand & Creative',
  'Social Media',
  'Direct Marketing',
  'Analytics',
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TacticTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TacticTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Strategy',
    defaultHours: 4,
    defaultDuration: 7,
    icon: 'Sparkles',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/tactic-templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'Strategy',
      defaultHours: 4,
      defaultDuration: 7,
      icon: 'Sparkles',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: TacticTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      defaultHours: template.defaultHours,
      defaultDuration: template.defaultDuration,
      icon: template.icon || 'Sparkles',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingTemplate) {
        // Update
        const response = await fetch(`/api/tactic-templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          await fetchTemplates();
          setIsDialogOpen(false);
        }
      } else {
        // Create
        const response = await fetch('/api/tactic-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          await fetchTemplates();
          setIsDialogOpen(false);
        }
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/tactic-templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.Sparkles;
    return IconComponent;
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, TacticTemplate[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-lg text-slate-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/plans" className="text-slate-500 hover:text-slate-700 transition-colors">
                Plans
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900 font-medium">Block Templates</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Block Manager</h1>
            <p className="mt-2 text-lg text-slate-600">
              Manage your marketing tactic templates
            </p>
          </div>
          <Button size="lg" onClick={handleCreate} className="gap-2">
            <Plus className="h-5 w-5" />
            New Template
          </Button>
        </div>

        {/* Templates by Category */}
        <div className="space-y-8">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category}>
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map((template) => {
                  const IconComponent = getIconComponent(template.icon || 'Sparkles');
                  return (
                    <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {template.name}
                          </h3>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{template.defaultHours}h</span>
                        <span>{template.defaultDuration} days</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Blocks className="h-16 w-16 text-slate-300 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">
              No templates yet
            </h2>
            <p className="text-slate-500 mb-6 max-w-md">
              Create your first tactic template to use in marketing plans.
            </p>
            <Button size="lg" onClick={handleCreate} className="gap-2">
              <Plus className="h-5 w-5" />
              Create Your First Template
            </Button>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
              <DialogDescription>
                Define a reusable marketing tactic template with default settings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Social Media Campaign"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe what this tactic involves..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <IconPicker
                    value={formData.icon}
                    onChange={(icon) => setFormData({ ...formData, icon })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hours">Default Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="1"
                    value={formData.defaultHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultHours: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Default Duration (days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.defaultDuration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultDuration: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

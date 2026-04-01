"use client"

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { tacticTemplates, tacticCategories } from '@/lib/tactic-templates';
import { usePlanStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { CustomTactic, TacticTemplate } from '@/lib/types';

interface SetupWizardProps {
  onComplete: (data: any) => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    clientName: '',
    objective: '',
    startDate: new Date().toISOString().split('T')[0],
    budget: '',
    selectedTactics: [] as string[],
    customTactics: [] as CustomTactic[]
  });
  
  const [isCustomTacticDialogOpen, setIsCustomTacticDialogOpen] = useState(false);
  const [newCustomTactic, setNewCustomTactic] = useState({ name: '', description: '' });
  const [dbTemplates, setDbTemplates] = useState<TacticTemplate[]>([]);

  const { setWizardData } = usePlanStore();

  // Fetch templates from DB on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/tactic-templates');
        if (response.ok) {
          const { templates } = await response.json();
          setDbTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    };
    fetchTemplates();
  }, []);

  const templates = (dbTemplates && dbTemplates.length > 0) ? dbTemplates : tacticTemplates;
  
  // Get unique categories from available templates
  const categories = Array.from(new Set(templates.map(t => t.category)));

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Complete wizard
      const wizardData = {
        ...formData,
        budget: formData.budget ? parseInt(formData.budget) : undefined
      };
      setWizardData(wizardData);
      onComplete(wizardData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleTactic = (tacticId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedTactics.includes(tacticId);
      if (isSelected) {
        return {
          ...prev,
          selectedTactics: prev.selectedTactics.filter(id => id !== tacticId)
        };
      } else {
        return {
          ...prev,
          selectedTactics: [...prev.selectedTactics, tacticId]
        };
      }
    });
  };

  const addCustomTactic = () => {
    if (!newCustomTactic.name || !newCustomTactic.description) return;
    
    const newTactic: CustomTactic = {
      id: `custom-${crypto.randomUUID()}`,
      name: newCustomTactic.name,
      description: newCustomTactic.description
    };

    setFormData(prev => ({
      ...prev,
      customTactics: [...prev.customTactics, newTactic],
      selectedTactics: [...prev.selectedTactics, newTactic.id]
    }));

    setNewCustomTactic({ name: '', description: '' });
    setIsCustomTacticDialogOpen(false);
  };

  const removeCustomTactic = (tacticId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({
      ...prev,
      customTactics: prev.customTactics.filter(t => t.id !== tacticId),
      selectedTactics: prev.selectedTactics.filter(id => id !== tacticId)
    }));
  };

  const isStepValid = () => {
    if (step === 1) return formData.clientName && formData.objective;
    if (step === 2) return formData.selectedTactics.length > 0;
    return true;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Create Marketing Plan</h1>
          <div className="text-sm text-muted-foreground">Step {step} of 3</div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="clientName" className="text-lg font-medium flex items-center gap-2">
                  <LucideIcons.Briefcase className="w-4 h-4 text-primary" /> Client Name
                </Label>
                <Input
                  id="clientName"
                  placeholder="e.g. Acme Corp"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="text-lg p-6"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective" className="text-lg font-medium flex items-center gap-2">
                  <LucideIcons.Target className="w-4 h-4 text-primary" /> Campaign Objective
                </Label>
                <Textarea
                  id="objective"
                  placeholder="What are the main goals for this marketing campaign? (e.g. Increase brand awareness, drive 500 leads, launch new product)"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  className="min-h-[120px] text-lg p-4 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-lg font-medium flex items-center gap-2">
                    <LucideIcons.Calendar className="w-4 h-4 text-primary" /> Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="text-lg p-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-lg font-medium flex items-center gap-2">
                    <LucideIcons.DollarSign className="w-4 h-4 text-primary" /> Estimated Budget (Optional)
                  </Label>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="e.g. 50000"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="text-lg p-6"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Select Tactics</h2>
                <p className="text-muted-foreground">Choose the marketing activities to include in this plan.</p>
              </div>
              
              <Dialog open={isCustomTacticDialogOpen} onOpenChange={setIsCustomTacticDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <LucideIcons.Plus className="w-4 h-4" /> Add Custom Tactic
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Tactic</DialogTitle>
                    <DialogDescription>
                      Define a custom marketing activity for this plan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="tactic-name">Tactic Name</Label>
                      <Input 
                        id="tactic-name" 
                        placeholder="e.g. Influencer Partnership" 
                        value={newCustomTactic.name}
                        onChange={(e) => setNewCustomTactic({...newCustomTactic, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tactic-desc">Context / Description</Label>
                      <Textarea 
                        id="tactic-desc" 
                        placeholder="Describe what this tactic involves..." 
                        value={newCustomTactic.description}
                        onChange={(e) => setNewCustomTactic({...newCustomTactic, description: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={addCustomTactic} disabled={!newCustomTactic.name || !newCustomTactic.description}>Add Tactic</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-8">
              {/* Custom Tactics Section */}
              {formData.customTactics.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-primary border-b pb-2">Custom Tactics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.customTactics.map(tactic => (
                      <Card 
                        key={tactic.id}
                        className={cn(
                          "cursor-pointer transition-all border-2 hover:border-primary/50",
                          formData.selectedTactics.includes(tactic.id) 
                            ? "border-primary bg-primary/5" 
                            : "border-transparent bg-muted/50"
                        )}
                        onClick={() => toggleTactic(tactic.id)}
                      >
                        <CardContent className="p-4 flex items-start gap-4">
                          <div className={cn(
                            "p-2 rounded-lg",
                            formData.selectedTactics.includes(tactic.id)
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground"
                          )}>
                            <LucideIcons.Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold">{tactic.name}</h4>
                              <div className="flex items-center gap-2">
                                {formData.selectedTactics.includes(tactic.id) && (
                                  <LucideIcons.Check className="w-4 h-4 text-primary" />
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => removeCustomTactic(tactic.id, e)}
                                >
                                  <LucideIcons.Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{tactic.description}</p>
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <LucideIcons.Briefcase className="w-3 h-3" /> Custom
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {categories.map(category => {
                const categoryTactics = templates.filter(t => t.category === category);
                if (categoryTactics.length === 0) return null;

                return (
                  <div key={category} className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryTactics.map(tactic => {
                        const IconComponent = tactic.icon 
                          ? (LucideIcons as any)[tactic.icon] || LucideIcons.Sparkles
                          : LucideIcons.Sparkles;

                        return (
                          <Card 
                            key={tactic.id}
                            className={cn(
                              "cursor-pointer transition-all border-2 hover:border-primary/50",
                              formData.selectedTactics.includes(tactic.id) 
                                ? "border-primary bg-primary/5" 
                                : "border-transparent bg-muted/50"
                            )}
                            onClick={() => toggleTactic(tactic.id)}
                          >
                            <CardContent className="p-4 flex items-start gap-4">
                              <div className={cn(
                                "p-2 rounded-lg",
                                formData.selectedTactics.includes(tactic.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground"
                              )}>
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold">{tactic.name}</h4>
                                  {formData.selectedTactics.includes(tactic.id) && (
                                    <LucideIcons.Check className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">{tactic.description}</p>
                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <LucideIcons.Briefcase className="w-3 h-3" /> {tactic.defaultHours}h
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <LucideIcons.Calendar className="w-3 h-3" /> {tactic.defaultDuration} days
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 text-center py-12"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <LucideIcons.Sparkles className="w-12 h-12 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Ready to Generate Plan</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                We'll use AI to generate a comprehensive marketing plan for <span className="font-semibold text-foreground">{formData.clientName}</span> based on your objective and selected tactics.
              </p>
            </div>

            <div className="bg-muted/30 rounded-xl p-6 max-w-md mx-auto text-left space-y-4 border">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Tactics Selected</span>
                <span className="font-semibold">{formData.selectedTactics.length}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Estimated Hours</span>
                <span className="font-semibold">
                  {formData.selectedTactics.reduce((acc, id) => {
                    const tactic = templates.find(t => t.id === id) || formData.customTactics.find(t => t.id === id);
                    return acc + (tactic?.defaultHours || 0);
                  }, 0)}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-semibold">{formData.startDate}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mt-12 pt-6 border-t">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 1}
          className="text-muted-foreground"
        >
          Back
        </Button>
        
        <Button
          onClick={handleNext}
          disabled={!isStepValid()}
          size="lg"
          className="gap-2"
        >
          {step === 3 ? (
            <>Generate Plan <LucideIcons.Sparkles className="w-4 h-4" /></>
          ) : (
            <>Next Step <LucideIcons.ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

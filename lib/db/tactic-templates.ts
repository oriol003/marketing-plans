import { createClient } from '@/lib/supabase/server';
import { TacticTemplate } from '@/lib/types';

export async function getTacticTemplates(): Promise<TacticTemplate[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tactic_templates')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching tactic templates:', error);
    throw error;
  }
  
  return (data || []).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    defaultHours: template.default_hours,
    defaultDuration: template.default_duration,
    icon: template.icon
  }));
}

export async function createTacticTemplate(template: Omit<TacticTemplate, 'id'>): Promise<TacticTemplate> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tactic_templates')
    .insert({
      name: template.name,
      description: template.description,
      category: template.category,
      default_hours: template.defaultHours,
      default_duration: template.defaultDuration,
      icon: template.icon
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating tactic template:', error);
    throw error;
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    defaultHours: data.default_hours,
    defaultDuration: data.default_duration,
    icon: data.icon
  };
}

export async function updateTacticTemplate(id: string, updates: Partial<TacticTemplate>): Promise<TacticTemplate> {
  const supabase = await createClient();
  
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.defaultHours !== undefined) dbUpdates.default_hours = updates.defaultHours;
  if (updates.defaultDuration !== undefined) dbUpdates.default_duration = updates.defaultDuration;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
  
  const { data, error } = await supabase
    .from('tactic_templates')
    .update({ ...dbUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating tactic template:', error);
    throw error;
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    defaultHours: data.default_hours,
    defaultDuration: data.default_duration,
    icon: data.icon
  };
}

export async function deleteTacticTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('tactic_templates')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting tactic template:', error);
    throw error;
  }
}

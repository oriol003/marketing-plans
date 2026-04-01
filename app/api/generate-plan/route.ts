import { generateTextGemini } from '@/lib/ai';
import { getTacticTemplates } from '@/lib/db/tactic-templates';
import { CustomTactic } from '@/lib/types';

export async function POST(req: Request) {
  try {
    console.log('[v0] API: Starting plan generation');

    const body = await req.json();
    console.log('[v0] API: Request body:', JSON.stringify(body, null, 2));

    const { clientName, objective, selectedTactics, startDate, customTactics = [] } = body;

    if (!clientName || !objective || !selectedTactics || !startDate) {
      console.error('[v0] API: Missing required fields');
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[v0] API: Fetching tactic templates from database...');
    const tacticTemplates = await getTacticTemplates();
    console.log('[v0] API: Loaded', tacticTemplates.length, 'templates from database');

    console.log('[v0] API: Generating introduction...');

    const { text: introduction } = await generateTextGemini({
      prompt: `
        Write a professional executive summary for a marketing proposal for "${clientName}".
        
        Campaign Objective: ${objective}
        
        The summary should be 2-3 paragraphs, persuasive, and outline the high-level strategy.
        Focus on how we will achieve the objective through a data-driven and creative approach.
        Do not mention specific tactics yet, keep it strategic.
      `,
    });

    console.log('[v0] API: Introduction generated, length:', introduction.length);
    console.log('[v0] API: Generating tactics in parallel...');

    // 2. Generate Tactic Content (Parallel)
    const tacticPromises = selectedTactics.map(async (tacticId: string, index: number) => {
      let template = tacticTemplates.find(t => t.id === tacticId);
      let isCustom = false;

      if (!template) {
        // Check if it's a custom tactic
        const customTactic = (customTactics as CustomTactic[]).find(t => t.id === tacticId);
        if (customTactic) {
          template = {
            id: customTactic.id,
            name: customTactic.name,
            description: customTactic.description,
            category: 'Custom Strategy',
            defaultHours: 5, // Default for custom
            defaultDuration: 7, // Default for custom
          };
          isCustom = true;
        } else {
          console.warn('[v0] API: Template not found for:', tacticId);
          return null;
        }
      }

      // Calculate dates based on sequence
      const start = new Date(startDate);
      start.setDate(start.getDate() + (index * 3));
      const end = new Date(start);
      end.setDate(end.getDate() + template.defaultDuration);

      console.log(`[v0] API: Generating content for tactic: ${template.name}`);

      const prompt = isCustom
        ? `
          Write a specific, detailed description for the custom marketing tactic: "${template.name}" for client "${clientName}".
          
          Context provided by user: "${template.description}"
          
          Campaign Objective: ${objective}
          
          Write 1-2 paragraphs explaining exactly how we will execute this custom tactic, why it matters for this specific client, and the expected outcome.
          Make it sound professional, agency-grade, and tailored to their objective.
        `
        : `
          Write a specific, detailed description for the marketing tactic: "${template.name}" for client "${clientName}".
          
          Context:
          - Objective: ${objective}
          - Category: ${template.category}
          - Standard Description: ${template.description}
          
          Write 1-2 paragraphs explaining exactly what we will do, why it matters for this specific client, and the expected outcome.
          Make it sound professional, agency-grade, and tailored to their objective.
        `;

      const { text: content } = await generateTextGemini({
        prompt: prompt,
      });

      return {
        id: crypto.randomUUID(),
        type: 'tactic',
        title: template.name,
        content: content,
        hours: template.defaultHours,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        category: template.category,
        order: index + 1
      };
    });

    const generatedTactics = (await Promise.all(tacticPromises)).filter(Boolean);
    console.log('[v0] API: Generated', generatedTactics.length, 'tactics');

    // Assemble the plan blocks
    const blocks = [
      {
        id: crypto.randomUUID(),
        type: 'text',
        title: 'Executive Summary',
        content: introduction,
        order: 0
      },
      ...generatedTactics
    ];

    console.log('[v0] API: Returning', blocks.length, 'blocks');
    return Response.json({ blocks });

  } catch (error) {
    console.error('[v0] API: Error generating plan:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

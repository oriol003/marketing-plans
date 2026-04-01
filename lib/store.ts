import { create } from 'zustand';
import { MarketingPlan, Block, WizardData } from './types';

interface PlanStore {
  currentPlan: MarketingPlan | null;
  wizardData: WizardData | null;
  isGenerating: boolean;
  generationProgress: string;
  
  // Actions
  setWizardData: (data: WizardData) => void;
  setCurrentPlan: (plan: MarketingPlan | null) => void;
  updatePlan: (updates: Partial<MarketingPlan>) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  deleteBlock: (blockId: string) => void;
  removeBlock: (blockId: string) => void;
  reorderBlocks: (startIndex: number, endIndex: number) => void;
  addBlock: (block: Block) => void;
  insertBlockAfter: (block: Block, afterBlockId?: string) => void;
  setGenerating: (isGenerating: boolean, progress?: string) => void;
  resetPlan: () => void;
}

function updateBlockInTree(blocks: Block[], blockId: string, updates: Partial<Block>): Block[] {
  return blocks.map(block => {
    if (block.id === blockId) {
      return { ...block, ...updates };
    }
    if (block.children && block.children.length > 0) {
      return {
        ...block,
        children: updateBlockInTree(block.children, blockId, updates)
      };
    }
    return block;
  });
}

function removeBlockFromTree(blocks: Block[], blockId: string): Block[] {
  return blocks
    .filter(block => block.id !== blockId)
    .map(block => {
      if (block.children && block.children.length > 0) {
        return {
          ...block,
          children: removeBlockFromTree(block.children, blockId)
        };
      }
      return block;
    });
}

function addBlockToTree(blocks: Block[], newBlock: Block): Block[] {
  if (!newBlock.parentId) {
    // Add to root level
    return [...blocks, newBlock];
  }
  
  return blocks.map(block => {
    if (block.id === newBlock.parentId) {
      // Found the parent, add to its children
      return {
        ...block,
        children: [...(block.children || []), newBlock]
      };
    }
    if (block.children && block.children.length > 0) {
      // Recursively search children
      return {
        ...block,
        children: addBlockToTree(block.children, newBlock)
      };
    }
    return block;
  });
}

function flattenBlocks(blocks: Block[]): Block[] {
  const flat: Block[] = [];
  
  function traverse(blockList: Block[]) {
    blockList.forEach(block => {
      flat.push(block);
      if (block.children && block.children.length > 0) {
        traverse(block.children);
      }
    });
  }
  
  traverse(blocks);
  return flat;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  currentPlan: null,
  wizardData: null,
  isGenerating: false,
  generationProgress: '',
  
  setWizardData: (data) => set({ wizardData: data }),
  
  setCurrentPlan: (plan) => set({ 
    currentPlan: plan ? { ...plan, blocks: plan.blocks || [] } : null 
  }),
  
  updatePlan: (updates) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    set({
      currentPlan: {
        ...currentPlan,
        ...updates,
        updatedAt: new Date().toISOString()
      }
    });
  },
  
  updateBlock: (blockId, updates) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    set({
      currentPlan: {
        ...currentPlan,
        blocks: updateBlockInTree(currentPlan.blocks, blockId, updates),
        updatedAt: new Date().toISOString()
      }
    });
  },
  
  deleteBlock: (blockId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    set({
      currentPlan: {
        ...currentPlan,
        blocks: removeBlockFromTree(currentPlan.blocks, blockId),
        updatedAt: new Date().toISOString()
      }
    });
  },

  removeBlock: (blockId) => {
    get().deleteBlock(blockId);
  },
  
  reorderBlocks: (startIndex, endIndex) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    // For now, only handle reordering at root level
    // In future, could be enhanced to handle reordering within parent contexts
    const blocks = [...currentPlan.blocks];
    const [removed] = blocks.splice(startIndex, 1);
    blocks.splice(endIndex, 0, removed);
    
    const reorderedBlocks = blocks.map((block, index) => ({
      ...block,
      order: index
    }));
    
    set({
      currentPlan: {
        ...currentPlan,
        blocks: reorderedBlocks,
        updatedAt: new Date().toISOString()
      }
    });
  },
  
  addBlock: (block) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    set({
      currentPlan: {
        ...currentPlan,
        blocks: addBlockToTree(currentPlan.blocks, block),
        updatedAt: new Date().toISOString()
      }
    });
  },

  insertBlockAfter: (block, afterBlockId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    
    if (!afterBlockId) {
      const newBlock = { ...block, order: 0 };
      const updatedBlocks = block.parentId 
        ? addBlockToTree(currentPlan.blocks, newBlock)
        : [newBlock, ...currentPlan.blocks.map(b => ({ ...b, order: b.order + 1 }))];
      
      set({
        currentPlan: {
          ...currentPlan,
          blocks: updatedBlocks,
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    function insertInTree(blocks: Block[]): { blocks: Block[], inserted: boolean } {
      const newBlocks: Block[] = [];
      let inserted = false;
      
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        
        // Handle children first
        if (b.children && b.children.length > 0) {
          const result = insertInTree(b.children);
          newBlocks.push({
            ...b,
            children: result.blocks
          });
          if (result.inserted) {
            inserted = true;
          }
        } else {
          newBlocks.push(b);
        }
        
        // If this is the target block, insert after it
        if (b.id === afterBlockId && !inserted) {
          // Set the new block's parentId to match the target block's parentId
          const newBlock = { ...block, parentId: b.parentId, order: b.order + 1 };
          newBlocks.push(newBlock);
          inserted = true;
        }
      }
      
      return { blocks: newBlocks, inserted };
    }
    
    const result = insertInTree(currentPlan.blocks);
    
    set({
      currentPlan: {
        ...currentPlan,
        blocks: result.blocks,
        updatedAt: new Date().toISOString()
      }
    });
  },

  setGenerating: (isGenerating, progress = '') => {
    set({ isGenerating, generationProgress: progress });
  },

  resetPlan: () => {
    set({ currentPlan: null, wizardData: null, isGenerating: false, generationProgress: '' });
  }
}));

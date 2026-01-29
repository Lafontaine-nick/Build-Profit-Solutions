/**
 * AI-Powered Budget Generator Service
 * Generates realistic construction budget line items based on project type and scope
 */

export interface BudgetLineItem {
  id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  markupPct: number;
  aiSuggested: boolean;
}

export interface ProjectInfo {
  projectId: string;
  projectType:
    | 'Residential'
    | 'Commercial'
    | 'Renovation'
    | 'New Build'
    | 'Remodel';
  projectSize: 'Small' | 'Medium' | 'Large';
  location?: string;
  estimatedDuration?: number; // weeks
}

// Construction cost databases (simplified)
const COST_DATABASE = {
  Labor: {
    'General labor': { unit: 'hr', cost: 45, markup: 0.15 },
    'Skilled labor': { unit: 'hr', cost: 65, markup: 0.2 },
    Supervisor: { unit: 'hr', cost: 85, markup: 0.25 },
    Electrician: { unit: 'hr', cost: 75, markup: 0.18 },
    Plumber: { unit: 'hr', cost: 70, markup: 0.18 },
    'HVAC technician': { unit: 'hr', cost: 80, markup: 0.2 },
  },
  Materials: {
    Concrete: { unit: 'cy', cost: 120, markup: 0.12 },
    Lumber: { unit: 'bf', cost: 8.5, markup: 0.15 },
    Drywall: { unit: 'sf', cost: 2.2, markup: 0.1 },
    Insulation: { unit: 'sf', cost: 1.8, markup: 0.12 },
    Paint: { unit: 'gal', cost: 45, markup: 0.2 },
    Flooring: { unit: 'sf', cost: 12, markup: 0.25 },
  },
  Equipment: {
    'Excavator rental': { unit: 'day', cost: 350, markup: 0.15 },
    'Crane rental': { unit: 'day', cost: 800, markup: 0.2 },
    Generator: { unit: 'day', cost: 150, markup: 0.18 },
    Scaffolding: { unit: 'day', cost: 200, markup: 0.15 },
  },
  Subcontractors: {
    'Electrical work': { unit: 'lot', cost: 15000, markup: 0.1 },
    'Plumbing work': { unit: 'lot', cost: 12000, markup: 0.1 },
    'HVAC installation': { unit: 'lot', cost: 18000, markup: 0.12 },
    Roofing: { unit: 'sf', cost: 8, markup: 0.15 },
    'Flooring installation': { unit: 'sf', cost: 6, markup: 0.2 },
  },
};

// Project templates based on type and size
const PROJECT_TEMPLATES = {
  'Residential-Small': {
    Labor: ['General labor', 'Skilled labor'],
    Materials: ['Concrete', 'Lumber', 'Drywall', 'Paint'],
    Equipment: ['Generator'],
    Subcontractors: ['Electrical work', 'Plumbing work'],
  },
  'Residential-Medium': {
    Labor: ['General labor', 'Skilled labor', 'Supervisor'],
    Materials: [
      'Concrete',
      'Lumber',
      'Drywall',
      'Insulation',
      'Paint',
      'Flooring',
    ],
    Equipment: ['Excavator rental', 'Generator'],
    Subcontractors: ['Electrical work', 'Plumbing work', 'HVAC installation'],
  },
  'Residential-Large': {
    Labor: [
      'General labor',
      'Skilled labor',
      'Supervisor',
      'Electrician',
      'Plumber',
    ],
    Materials: [
      'Concrete',
      'Lumber',
      'Drywall',
      'Insulation',
      'Paint',
      'Flooring',
    ],
    Equipment: ['Excavator rental', 'Crane rental', 'Generator', 'Scaffolding'],
    Subcontractors: [
      'Electrical work',
      'Plumbing work',
      'HVAC installation',
      'Roofing',
    ],
  },
  'Commercial-Small': {
    Labor: ['General labor', 'Skilled labor', 'Supervisor'],
    Materials: ['Concrete', 'Lumber', 'Drywall', 'Insulation', 'Paint'],
    Equipment: ['Generator', 'Scaffolding'],
    Subcontractors: ['Electrical work', 'Plumbing work', 'HVAC installation'],
  },
  'Commercial-Medium': {
    Labor: [
      'General labor',
      'Skilled labor',
      'Supervisor',
      'Electrician',
      'Plumber',
      'HVAC technician',
    ],
    Materials: [
      'Concrete',
      'Lumber',
      'Drywall',
      'Insulation',
      'Paint',
      'Flooring',
    ],
    Equipment: ['Excavator rental', 'Generator', 'Scaffolding'],
    Subcontractors: [
      'Electrical work',
      'Plumbing work',
      'HVAC installation',
      'Roofing',
    ],
  },
  'Commercial-Large': {
    Labor: [
      'General labor',
      'Skilled labor',
      'Supervisor',
      'Electrician',
      'Plumber',
      'HVAC technician',
    ],
    Materials: [
      'Concrete',
      'Lumber',
      'Drywall',
      'Insulation',
      'Paint',
      'Flooring',
    ],
    Equipment: ['Excavator rental', 'Crane rental', 'Generator', 'Scaffolding'],
    Subcontractors: [
      'Electrical work',
      'Plumbing work',
      'HVAC installation',
      'Roofing',
      'Flooring installation',
    ],
  },
  'Renovation-Small': {
    Labor: ['General labor', 'Skilled labor'],
    Materials: ['Drywall', 'Paint', 'Flooring'],
    Equipment: ['Generator'],
    Subcontractors: ['Electrical work', 'Plumbing work'],
  },
  'Renovation-Medium': {
    Labor: ['General labor', 'Skilled labor', 'Supervisor'],
    Materials: ['Lumber', 'Drywall', 'Insulation', 'Paint', 'Flooring'],
    Equipment: ['Generator', 'Scaffolding'],
    Subcontractors: ['Electrical work', 'Plumbing work', 'HVAC installation'],
  },
  'Renovation-Large': {
    Labor: [
      'General labor',
      'Skilled labor',
      'Supervisor',
      'Electrician',
      'Plumber',
    ],
    Materials: [
      'Concrete',
      'Lumber',
      'Drywall',
      'Insulation',
      'Paint',
      'Flooring',
    ],
    Equipment: ['Excavator rental', 'Generator', 'Scaffolding'],
    Subcontractors: [
      'Electrical work',
      'Plumbing work',
      'HVAC installation',
      'Roofing',
    ],
  },
};

// Size multipliers for quantities
const SIZE_MULTIPLIERS = {
  Small: 1,
  Medium: 2.5,
  Large: 5,
};

// Generate realistic quantities based on project size and type
function generateQuantity(
  category: string,
  item: string,
  projectSize: string,
  projectType: string
): number {
  const multiplier =
    SIZE_MULTIPLIERS[projectSize as keyof typeof SIZE_MULTIPLIERS];

  // Base quantities for different item types
  const baseQuantities: Record<string, Record<string, number>> = {
    Labor: {
      'General labor': 200,
      'Skilled labor': 150,
      Supervisor: 100,
      Electrician: 80,
      Plumber: 80,
      'HVAC technician': 60,
    },
    Materials: {
      Concrete: 50,
      Lumber: 2000,
      Drywall: 2000,
      Insulation: 1500,
      Paint: 20,
      Flooring: 1500,
    },
    Equipment: {
      'Excavator rental': 10,
      'Crane rental': 5,
      Generator: 30,
      Scaffolding: 20,
    },
    Subcontractors: {
      'Electrical work': 1,
      'Plumbing work': 1,
      'HVAC installation': 1,
      Roofing: 2000,
      'Flooring installation': 1500,
    },
  };

  const baseQty = baseQuantities[category]?.[item] || 100;
  return Math.round(baseQty * multiplier);
}

// Generate AI-powered budget
export async function generateDraftBudget(
  projectInfo: ProjectInfo
): Promise<BudgetLineItem[]> {
  return new Promise(resolve => {
    // Simulate AI processing time
    setTimeout(() => {
      const templateKey = `${projectInfo.projectType}-${projectInfo.projectSize}`;
      const template =
        PROJECT_TEMPLATES[templateKey as keyof typeof PROJECT_TEMPLATES] ||
        PROJECT_TEMPLATES['Residential-Medium'];

      const budgetItems: BudgetLineItem[] = [];
      let itemId = 1;

      // Generate items for each category
      Object.entries(template).forEach(([category, items]) => {
        items.forEach(itemName => {
          const costData =
            (COST_DATABASE as any)[category]?.[itemName];
          if (costData) {
            const qty = generateQuantity(
              category,
              itemName,
              projectInfo.projectSize,
              projectInfo.projectType
            );

            budgetItems.push({
              id: `ai_${itemId++}`,
              category,
              description: itemName,
              qty,
              unit: costData.unit,
              unitCost: costData.cost,
              markupPct: costData.markup,
              aiSuggested: true,
            });
          }
        });
      });

      // Add some project-specific items based on type
      if (
        projectInfo.projectType === 'Renovation' ||
        projectInfo.projectType === 'Remodel'
      ) {
        budgetItems.push({
          id: `ai_${itemId++}`,
          category: 'Materials',
          description: 'Demolition materials disposal',
          qty: 1,
          unit: 'lot',
          unitCost: 2500,
          markupPct: 0.15,
          aiSuggested: true,
        });
      }

      if (projectInfo.projectType === 'New Build') {
        budgetItems.push({
          id: `ai_${itemId++}`,
          category: 'Materials',
          description: 'Foundation materials',
          qty: 1,
          unit: 'lot',
          unitCost: 15000,
          markupPct: 0.12,
          aiSuggested: true,
        });
      }

      // Sort by category and cost
      budgetItems.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return b.qty * b.unitCost - a.qty * a.unitCost;
      });

      resolve(budgetItems);
    }, 2000); // 2 second delay to simulate AI processing
  });
}

// Calculate total budget from line items
export function calculateBudgetTotal(items: BudgetLineItem[]): number {
  return items.reduce((total, item) => {
    const baseCost = item.qty * item.unitCost;
    const markupCost = baseCost * item.markupPct;
    return total + baseCost + markupCost;
  }, 0);
}

// Validate budget items
export function validateBudgetItems(items: BudgetLineItem[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  items.forEach((item, index) => {
    if (!item.category.trim()) {
      errors.push(`Item ${index + 1}: Category is required`);
    }
    if (!item.description.trim()) {
      errors.push(`Item ${index + 1}: Description is required`);
    }
    if (item.qty <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }
    if (item.unitCost <= 0) {
      errors.push(`Item ${index + 1}: Unit cost must be greater than 0`);
    }
    if (item.markupPct < 0 || item.markupPct > 1) {
      errors.push(
        `Item ${index + 1}: Markup percentage must be between 0 and 1`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

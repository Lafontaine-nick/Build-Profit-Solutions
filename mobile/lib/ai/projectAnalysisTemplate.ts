/**
 * Project Analysis Response Template
 * 
 * Strict template structure for project_analysis intent responses
 */

export type ProjectAnalysisResponse = {
  summary: {
    budgetStatus: string;
    marginStatus: string;
    scheduleStatus: string;
  };
  budgetAndCosting: {
    planned: number;
    actual: number;
    topCostDrivers: Array<{ name: string; amount: number; percentage: number }>;
    missingCosts: string[];
    suspiciousEntries: string[];
  };
  profitability: {
    currentMargin: number;
    targetMargin: number;
    forecastAtCompletion: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    riskReason: string;
  };
  schedule: {
    milestonesAtRisk: Array<{ name: string; risk: string }>;
    next7DayActions: string[];
  };
  risksAndRecommendations: {
    prioritizedActions: Array<{ action: string; priority: 'High' | 'Medium' | 'Low'; reason: string }>;
  };
  nextBestActions: Array<{
    label: string;
    action: 'add_missing_cost' | 'update_schedule' | 'generate_change_order' | 'send_client_update';
    params?: Record<string, any>;
  }>;
  dataNeeded?: Array<{
    section: string;
    missingData: string;
    nextStep: string;
    toolCall?: string;
  }>;
};

/**
 * Parses a structured project analysis response from AI text
 */
export function parseProjectAnalysisResponse(text: string): ProjectAnalysisResponse | null {
  try {
    // Try to parse as JSON first (if AI returns structured JSON)
    if (text.trim().startsWith('{')) {
      return JSON.parse(text) as ProjectAnalysisResponse;
    }
    
    // Otherwise, try to extract structured data from markdown/text format
    // This is a fallback parser for when AI returns formatted text
    const analysis: Partial<ProjectAnalysisResponse> = {
      summary: {
        budgetStatus: extractSection(text, 'Budget Status', 'summary'),
        marginStatus: extractSection(text, 'Margin Status', 'summary'),
        scheduleStatus: extractSection(text, 'Schedule Status', 'summary'),
      },
      budgetAndCosting: {
        planned: extractNumber(text, 'Planned'),
        actual: extractNumber(text, 'Actual'),
        topCostDrivers: extractList(text, 'Top.*Cost.*Driver'),
        missingCosts: extractListItems(text, 'Missing.*Cost'),
        suspiciousEntries: extractListItems(text, 'Suspicious'),
      },
      profitability: {
        currentMargin: extractNumber(text, 'Current.*Margin'),
        targetMargin: extractNumber(text, 'Target.*Margin'),
        forecastAtCompletion: extractNumber(text, 'Forecast'),
        riskLevel: extractRiskLevel(text),
        riskReason: extractSection(text, 'Risk.*Reason', 'profitability'),
      },
      schedule: {
        milestonesAtRisk: extractMilestones(text),
        next7DayActions: extractListItems(text, 'Next.*7.*Day'),
      },
      risksAndRecommendations: {
        prioritizedActions: extractPrioritizedActions(text),
      },
      nextBestActions: extractNextActions(text),
    };
    
    return analysis as ProjectAnalysisResponse;
  } catch (e) {
    console.error('Error parsing project analysis response:', e);
    return null;
  }
}

/**
 * Validates that a project analysis response follows the template
 */
export function validateProjectAnalysisResponse(analysis: ProjectAnalysisResponse): {
  valid: boolean;
  missingSections: string[];
} {
  const missing: string[] = [];
  
  if (!analysis.summary || !analysis.summary.budgetStatus) missing.push('Summary - Budget Status');
  if (!analysis.summary?.marginStatus) missing.push('Summary - Margin Status');
  if (!analysis.summary?.scheduleStatus) missing.push('Summary - Schedule Status');
  
  if (!analysis.budgetAndCosting) missing.push('Budget & Costing');
  if (!analysis.profitability) missing.push('Profitability');
  if (!analysis.schedule) missing.push('Schedule');
  if (!analysis.risksAndRecommendations) missing.push('Risks & Recommendations');
  
  return {
    valid: missing.length === 0,
    missingSections: missing,
  };
}

// Helper functions for parsing
function extractSection(text: string, pattern: string, section: string): string {
  const regex = new RegExp(`${pattern}[:\\-]?\\s*([^\\n]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : 'Data needed';
}

function extractNumber(text: string, pattern: string): number {
  const regex = new RegExp(`${pattern}[:\\-]?\\s*\\$?([\\d,]+)`, 'i');
  const match = text.match(regex);
  if (match) {
    return parseFloat(match[1].replace(/,/g, '')) || 0;
  }
  return 0;
}

function extractList(text: string, pattern: string): Array<{ name: string; amount: number; percentage: number }> {
  // This would need more sophisticated parsing
  return [];
}

function extractListItems(text: string, pattern: string): string[] {
  const regex = new RegExp(`${pattern}[:\\-]?\\s*([^\\n]+(?:\\n[^\\n]+)*)`, 'i');
  const match = text.match(regex);
  if (match) {
    return match[1].split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function extractRiskLevel(text: string): 'Low' | 'Medium' | 'High' {
  if (/high/i.test(text)) return 'High';
  if (/medium/i.test(text)) return 'Medium';
  return 'Low';
}

function extractMilestones(text: string): Array<{ name: string; risk: string }> {
  // This would need more sophisticated parsing
  return [];
}

function extractPrioritizedActions(text: string): Array<{ action: string; priority: 'High' | 'Medium' | 'Low'; reason: string }> {
  // This would need more sophisticated parsing
  return [];
}

function extractNextActions(text: string): Array<{ label: string; action: string; params?: Record<string, any> }> {
  // This would need more sophisticated parsing
  return [];
}

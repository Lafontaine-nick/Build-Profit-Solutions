import Constants from 'expo-constants';

interface ExpenseValidation {
  isValid: boolean;
  confidence: number;
  suggestedCategory?: string;
  flags: {
    type:
      | 'unusual_amount'
      | 'duplicate'
      | 'wrong_category'
      | 'suspicious_vendor'
      | 'missing_receipt';
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion?: string;
  }[];
  recommendations: string[];
}

interface Expense {
  id: string;
  amount: number;
  vendor?: string;
  category?: string;
  date?: string;
  notes?: string;
  receiptUri?: string | null;
}

interface ProjectContext {
  projectType: string;
  budgetCategories: string[];
  averageExpenseAmount: number;
  recentExpenses: Expense[];
}

class AIExpenseValidationService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl =
      Constants.expoConfig?.extra?.apiBaseUrl ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      'http://localhost:3001';
  }

  async validateExpense(
    expense: Expense,
    projectContext: ProjectContext
  ): Promise<ExpenseValidation> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/ai/expense-validation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expense, projectContext }),
        }
      );

      if (!response.ok) {
        throw new Error(`Expense validation API error: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error in AIExpenseValidationService:', error);
      // Return mock validation for development
      return this.generateMockValidation(expense, projectContext);
    }
  }

  private generateMockValidation(
    expense: Expense,
    projectContext: ProjectContext
  ): ExpenseValidation {
    const flags: ExpenseValidation['flags'] = [];
    const recommendations: string[] = [];
    let confidence = 85;
    let suggestedCategory = expense.category;

    // Check for unusual amounts
    if (expense.amount > projectContext.averageExpenseAmount * 3) {
      flags.push({
        type: 'unusual_amount',
        severity: 'high',
        message: `Amount $${expense.amount} is unusually high (3x average)`,
        suggestion: 'Verify this expense amount and ensure receipt is attached',
      });
      confidence -= 20;
    } else if (expense.amount > projectContext.averageExpenseAmount * 2) {
      flags.push({
        type: 'unusual_amount',
        severity: 'medium',
        message: `Amount $${expense.amount} is above average`,
        suggestion: 'Double-check this expense amount',
      });
      confidence -= 10;
    }

    // Check for duplicate expenses
    const duplicateExpense = projectContext.recentExpenses.find(
      e =>
        e.vendor === expense.vendor &&
        Math.abs(e.amount - expense.amount) < 1 &&
        e.id !== expense.id
    );

    if (duplicateExpense) {
      flags.push({
        type: 'duplicate',
        severity: 'high',
        message: `Possible duplicate expense with ${expense.vendor}`,
        suggestion: 'Check if this expense was already recorded',
      });
      confidence -= 25;
    }

    // Check category appropriateness
    if (
      expense.category &&
      !projectContext.budgetCategories.includes(expense.category)
    ) {
      flags.push({
        type: 'wrong_category',
        severity: 'medium',
        message: `Category "${expense.category}" not in budget categories`,
        suggestion: `Consider: ${projectContext.budgetCategories.join(', ')}`,
      });
      confidence -= 15;

      // Suggest better category based on vendor
      suggestedCategory = this.suggestCategoryFromVendor(
        expense.vendor,
        projectContext.budgetCategories
      );
    }

    // Check for suspicious vendors
    if (expense.vendor && this.isSuspiciousVendor(expense.vendor)) {
      flags.push({
        type: 'suspicious_vendor',
        severity: 'medium',
        message: `Vendor "${expense.vendor}" may not be construction-related`,
        suggestion: 'Verify this is a legitimate construction expense',
      });
      confidence -= 10;
    }

    // Check for missing receipt
    if (!expense.receiptUri) {
      flags.push({
        type: 'missing_receipt',
        severity: 'low',
        message: 'No receipt attached',
        suggestion: 'Attach receipt for better expense tracking',
      });
      confidence -= 5;
    }

    // Generate recommendations
    if (flags.length === 0) {
      recommendations.push('✅ Expense looks good - no issues detected');
    } else {
      recommendations.push('⚠️ Review flagged items below');

      if (flags.some(f => f.type === 'unusual_amount')) {
        recommendations.push(
          '💰 Consider breaking down large expenses into line items'
        );
      }

      if (flags.some(f => f.type === 'wrong_category')) {
        recommendations.push('📂 Update category to match budget structure');
      }

      if (flags.some(f => f.type === 'duplicate')) {
        recommendations.push(
          '🔄 Check for duplicate entries in recent expenses'
        );
      }
    }

    return {
      isValid: flags.filter(f => f.severity === 'high').length === 0,
      confidence: Math.max(0, confidence),
      suggestedCategory,
      flags,
      recommendations,
    };
  }

  private suggestCategoryFromVendor(
    vendor: string | undefined,
    budgetCategories: string[]
  ): string {
    if (!vendor) return budgetCategories[0] || 'Other';

    const vendorLower = vendor.toLowerCase();

    // Common vendor patterns
    if (
      vendorLower.includes('home depot') ||
      vendorLower.includes('lowes') ||
      vendorLower.includes('menards')
    ) {
      return (
        budgetCategories.find(cat => cat.toLowerCase().includes('material')) ||
        'Materials'
      );
    }

    if (
      vendorLower.includes('grainger') ||
      vendorLower.includes('harbor freight')
    ) {
      return (
        budgetCategories.find(cat => cat.toLowerCase().includes('labor')) ||
        'Labor'
      );
    }

    if (vendorLower.includes('uhaul') || vendorLower.includes('equipment')) {
      return (
        budgetCategories.find(cat => cat.toLowerCase().includes('equipment')) ||
        'Equipment'
      );
    }

    return budgetCategories[0] || 'Other';
  }

  private isSuspiciousVendor(vendor: string): boolean {
    const suspiciousPatterns = [
      'restaurant',
      'cafe',
      'coffee',
      'bar',
      'hotel',
      'travel',
      'entertainment',
      'clothing',
      'fashion',
      'jewelry',
      'cosmetics',
      'pharmacy',
      'grocery',
    ];

    const vendorLower = vendor.toLowerCase();
    return suspiciousPatterns.some(pattern => vendorLower.includes(pattern));
  }
}

const aiExpenseValidationService = new AIExpenseValidationService();
export default aiExpenseValidationService;

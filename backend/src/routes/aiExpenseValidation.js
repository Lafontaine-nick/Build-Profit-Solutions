const express = require('express');
const router = express.Router();

// AI Expense Validation endpoint
router.post('/expense-validation', async (req, res) => {
  try {
    let { expense = {}, projectContext = {} } = req.body;
    // Add data validation with defaults
    if (!expense) {
      expense = { amount: 0, category: 'Other', description: '', vendor: '' };
    }
    if (!projectContext) {
      projectContext = {
        averageExpenseAmount: 500,
        recentExpenses: [],
        budgetCategories: ['Materials', 'Labor', 'Equipment', 'Other']
      };
    }
    if (!projectContext.averageExpenseAmount) {
      projectContext.averageExpenseAmount = 500;
    }
    if (!projectContext.recentExpenses) {
      projectContext.recentExpenses = [];
    }
    if (!projectContext.budgetCategories) {
      projectContext.budgetCategories = ['Materials', 'Labor', 'Equipment', 'Other'];
    }

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const flags = [];
    const recommendations = [];
    let confidence = 85;
    let suggestedCategory = expense.category;

    // Check for unusual amounts
    if (expense.amount > projectContext.averageExpenseAmount * 3) {
      flags.push({
        type: 'unusual_amount',
        severity: 'high',
        message: `Amount $${expense.amount} is unusually high (3x average)`,
        suggestion: 'Verify this expense amount and ensure receipt is attached'
      });
      confidence -= 20;
    } else if (expense.amount > projectContext.averageExpenseAmount * 2) {
      flags.push({
        type: 'unusual_amount',
        severity: 'medium',
        message: `Amount $${expense.amount} is above average`,
        suggestion: 'Double-check this expense amount'
      });
      confidence -= 10;
    }

    // Check for duplicate expenses
    const duplicateExpense = projectContext.recentExpenses.find(e => 
      e.vendor === expense.vendor && 
      Math.abs(e.amount - expense.amount) < 1 && 
      e.id !== expense.id
    );
    
    if (duplicateExpense) {
      flags.push({
        type: 'duplicate',
        severity: 'high',
        message: `Possible duplicate expense with ${expense.vendor}`,
        suggestion: 'Check if this expense was already recorded'
      });
      confidence -= 25;
    }

    // Check category appropriateness
    if (expense.category && !projectContext.budgetCategories.includes(expense.category)) {
      flags.push({
        type: 'wrong_category',
        severity: 'medium',
        message: `Category "${expense.category}" not in budget categories`,
        suggestion: `Consider: ${projectContext.budgetCategories.join(', ')}`
      });
      confidence -= 15;
      
      // Suggest better category based on vendor
      suggestedCategory = suggestCategoryFromVendor(expense.vendor, projectContext.budgetCategories);
    }

    // Check for suspicious vendors
    if (expense.vendor && isSuspiciousVendor(expense.vendor)) {
      flags.push({
        type: 'suspicious_vendor',
        severity: 'medium',
        message: `Vendor "${expense.vendor}" may not be construction-related`,
        suggestion: 'Verify this is a legitimate construction expense'
      });
      confidence -= 10;
    }

    // Check for missing receipt
    if (!expense.receiptUri) {
      flags.push({
        type: 'missing_receipt',
        severity: 'low',
        message: 'No receipt attached',
        suggestion: 'Attach receipt for better expense tracking'
      });
      confidence -= 5;
    }

    // Generate recommendations
    if (flags.length === 0) {
      recommendations.push('✅ Expense looks good - no issues detected');
    } else {
      recommendations.push('⚠️ Review flagged items below');
      
      if (flags.some(f => f.type === 'unusual_amount')) {
        recommendations.push('💰 Consider breaking down large expenses into line items');
      }
      
      if (flags.some(f => f.type === 'wrong_category')) {
        recommendations.push('📂 Update category to match budget structure');
      }
      
      if (flags.some(f => f.type === 'duplicate')) {
        recommendations.push('🔄 Check for duplicate entries in recent expenses');
      }
    }

    const validation = {
      isValid: flags.filter(f => f.severity === 'high').length === 0,
      confidence: Math.max(0, confidence),
      suggestedCategory,
      flags,
      recommendations
    };
    
    res.status(200).json({ 
      success: true, 
      data: validation,
      confidence: Math.max(0, confidence)
    });
    
  } catch (error) {
    console.error('Expense validation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to validate expense' 
    });
  }
});

function suggestCategoryFromVendor(vendor, budgetCategories) {
  if (!vendor) return budgetCategories[0] || 'Other';
  
  const vendorLower = vendor.toLowerCase();
  
  // Common vendor patterns
  if (vendorLower.includes('home depot') || vendorLower.includes('lowes') || vendorLower.includes('menards')) {
    return budgetCategories.find(cat => cat.toLowerCase().includes('material')) || 'Materials';
  }
  
  if (vendorLower.includes('grainger') || vendorLower.includes('harbor freight')) {
    return budgetCategories.find(cat => cat.toLowerCase().includes('labor')) || 'Labor';
  }
  
  if (vendorLower.includes('uhaul') || vendorLower.includes('equipment')) {
    return budgetCategories.find(cat => cat.toLowerCase().includes('equipment')) || 'Equipment';
  }
  
  return budgetCategories[0] || 'Other';
}

function isSuspiciousVendor(vendor) {
  const suspiciousPatterns = [
    'restaurant', 'cafe', 'coffee', 'bar', 'hotel', 'travel', 'entertainment',
    'clothing', 'fashion', 'jewelry', 'cosmetics', 'pharmacy', 'grocery'
  ];
  
  const vendorLower = vendor.toLowerCase();
  return suspiciousPatterns.some(pattern => vendorLower.includes(pattern));
}

module.exports = router;

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { formatMoneyFull } from '../lib/budgetUtils';

export interface BudgetExportData {
  projectTitle: string;
  totalBudget: number;
  totalSpent: number;
  buckets: Array<{
    name: string;
    budget: number;
    spent: number;
  }>;
  expenses: Array<{
    vendor: string;
    amount: number;
    category: string;
    date: string;
  }>;
  purchaseOrders?: Array<{
    vendor: string;
    amount: number;
    status: string;
  }>;
}

export async function exportBudgetPDF(data: BudgetExportData) {
  try {
    const budgetUsedPct = ((data.totalSpent / data.totalBudget) * 100).toFixed(1);
    const remaining = data.totalBudget - data.totalSpent;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, Arial, sans-serif;
            padding: 30px;
            background: #f5f7fa;
          }
          .header {
            background: linear-gradient(135deg, #0d2745 0%, #173659 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
          }
          h1 { margin: 0 0 10px 0; font-size: 32px; }
          .subtitle { opacity: 0.9; font-size: 16px; }
          .summary {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
          }
          .summary-card {
            flex: 1;
            background: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .summary-value { font-size: 28px; font-weight: 900; color: #173659; }
          .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
          .category {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .category-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f3f7;
          }
          .category-name { font-size: 20px; font-weight: 700; color: #0d2745; }
          .category-pct {
            font-size: 16px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 8px;
            background: #e9f1ff;
            color: #173659;
          }
          .budget-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f3f7;
          }
          .label { color: #666; font-size: 14px; }
          .value { font-weight: 700; color: #0d2745; font-size: 15px; }
          .over-budget { color: #ff6b6b; }
          .under-budget { color: #2ecc71; }
          .footer {
            margin-top: 30px;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${data.projectTitle}</h1>
          <div class="subtitle">Budget Report • Generated ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">${formatMoneyFull(data.totalBudget, { decimals: 0 })}</div>
            <div class="summary-label">Total Budget</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatMoneyFull(data.totalSpent, { decimals: 0 })}</div>
            <div class="summary-label">Total Spent</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${budgetUsedPct}%</div>
            <div class="summary-label">Budget Used</div>
          </div>
          <div class="summary-card">
            <div class="summary-value ${remaining >= 0 ? 'under-budget' : 'over-budget'}">${formatMoneyFull(Math.abs(remaining), { decimals: 0 })}</div>
            <div class="summary-label">${remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
          </div>
        </div>

        <h2 style="color: #0d2745; margin-bottom: 20px;">Budget Categories</h2>
        ${data.buckets.map(bucket => {
          const pct = ((bucket.spent / bucket.budget) * 100).toFixed(1);
          return `
            <div class="category">
              <div class="category-header">
                <div class="category-name">${bucket.name}</div>
                <div class="category-pct">${pct}%</div>
              </div>
              <div class="budget-row">
                <span class="label">Budget</span>
                <span class="value">${formatMoneyFull(bucket.budget, { decimals: 0 })}</span>
              </div>
              <div class="budget-row">
                <span class="label">Spent</span>
                <span class="value">${formatMoneyFull(bucket.spent, { decimals: 0 })}</span>
              </div>
              <div class="budget-row">
                <span class="label">Remaining</span>
                <span class="value ${(bucket.budget - bucket.spent) >= 0 ? 'under-budget' : 'over-budget'}">
                  ${formatMoneyFull(Math.abs(bucket.budget - bucket.spent), { decimals: 0 })}
                </span>
              </div>
            </div>
          `;
        }).join('')}

        <div class="footer">
          Build Profit Solutions © ${new Date().getFullYear()}<br>
          This is a computer-generated report
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${data.projectTitle} - Budget Report`,
      UTI: 'com.adobe.pdf',
    });
    Alert.alert('Success!', 'Budget report exported and ready to share');
  } catch (error) {
    console.error('PDF export error:', error);
    Alert.alert('Export Failed', 'Could not generate PDF report');
  }
} 
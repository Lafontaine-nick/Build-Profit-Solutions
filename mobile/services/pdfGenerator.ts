import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface PDFOptions {
  title: string;
  subtitle?: string;
  logo?: string;
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
  clientInfo: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  notes?: string;
  terms?: string;
  footer?: string;
}

class PDFGeneratorService {
  async generateEstimatePDF(
    estimate: any,
    options: PDFOptions
  ): Promise<string> {
    try {
      const html = this.generateEstimateHTML(estimate, options);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      }

      return uri;
    } catch (error) {
      console.error('Failed to generate estimate PDF:', error);
      throw error;
    }
  }

  async generateInvoicePDF(invoice: any, options: PDFOptions): Promise<string> {
    try {
      const html = this.generateInvoiceHTML(invoice, options);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      }

      return uri;
    } catch (error) {
      console.error('Failed to generate invoice PDF:', error);
      throw error;
    }
  }

  async generateProjectReportPDF(
    project: any,
    options: PDFOptions
  ): Promise<string> {
    try {
      const html = this.generateProjectReportHTML(project, options);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      }

      return uri;
    } catch (error) {
      console.error('Failed to generate project report PDF:', error);
      throw error;
    }
  }

  private generateEstimateHTML(estimate: any, options: PDFOptions): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${options.title}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #43cea2;
              padding-bottom: 20px;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .subtitle {
              font-size: 16px;
              color: #7f8c8d;
            }
            .info-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .company-info, .client-info {
              flex: 1;
            }
            .company-info {
              text-align: left;
            }
            .client-info {
              text-align: right;
            }
            .info-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              background-color: #43cea2;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #ecf0f1;
            }
            .items-table tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .totals {
              text-align: right;
              margin-bottom: 30px;
            }
            .total-row {
              padding: 8px 0;
              font-weight: bold;
            }
            .total-amount {
              font-size: 18px;
              color: #43cea2;
            }
            .notes, .terms {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-left: 4px solid #43cea2;
            }
            .notes-title, .terms-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
              color: #7f8c8d;
              font-size: 12px;
            }
            .estimate-details {
              background-color: #f8f9fa;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .estimate-details h3 {
              margin-top: 0;
              color: #2c3e50;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .detail-label {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${options.logo ? `<img src="${options.logo}" alt="Logo" class="logo">` : ''}
            <div class="title">${options.title}</div>
            ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
          </div>

          <div class="info-section">
            <div class="company-info">
              <div class="info-title">From:</div>
              <div>${options.companyInfo.name}</div>
              <div>${options.companyInfo.address}</div>
              <div>Phone: ${options.companyInfo.phone}</div>
              <div>Email: ${options.companyInfo.email}</div>
              ${options.companyInfo.website ? `<div>Website: ${options.companyInfo.website}</div>` : ''}
            </div>
            <div class="client-info">
              <div class="info-title">To:</div>
              <div>${options.clientInfo.name}</div>
              <div>${options.clientInfo.address}</div>
              ${options.clientInfo.phone ? `<div>Phone: ${options.clientInfo.phone}</div>` : ''}
              ${options.clientInfo.email ? `<div>Email: ${options.clientInfo.email}</div>` : ''}
            </div>
          </div>

          ${
            estimate
              ? `
            <div class="estimate-details">
              <h3>Project Details</h3>
              <div class="detail-row">
                <span class="detail-label">Project Type:</span>
                <span>${estimate.factors?.projectType || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Square Footage:</span>
                <span>${estimate.factors?.squareFootage?.toLocaleString() || 'N/A'} sq ft</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Material Grade:</span>
                <span>${estimate.factors?.materialGrade || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Timeline:</span>
                <span>${estimate.factors?.timeline || 'N/A'} months</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Confidence Level:</span>
                <span>${estimate.confidence || 'N/A'}%</span>
              </div>
            </div>
          `
              : ''
          }

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${options.items
                .map(
                  item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
                  <td>$${item.rate.toLocaleString()}</td>
                  <td>$${item.amount.toLocaleString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${options.totals.subtotal.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>Tax (8%):</span>
              <span>$${options.totals.tax.toLocaleString()}</span>
            </div>
            <div class="total-row total-amount">
              <span>Total:</span>
              <span>$${options.totals.total.toLocaleString()}</span>
            </div>
          </div>

          ${
            options.notes
              ? `
            <div class="notes">
              <div class="notes-title">Notes:</div>
              <div>${options.notes}</div>
            </div>
          `
              : ''
          }

          ${
            options.terms
              ? `
            <div class="terms">
              <div class="terms-title">Terms & Conditions:</div>
              <div>${options.terms}</div>
            </div>
          `
              : ''
          }

          <div class="footer">
            ${options.footer || 'Thank you for your business!'}
          </div>
        </body>
      </html>
    `;
  }

  private generateInvoiceHTML(invoice: any, options: PDFOptions): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${options.title}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e74c3c;
              padding-bottom: 20px;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .subtitle {
              font-size: 16px;
              color: #7f8c8d;
            }
            .invoice-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .invoice-details {
              text-align: right;
            }
            .info-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .company-info, .client-info {
              flex: 1;
            }
            .company-info {
              text-align: left;
            }
            .client-info {
              text-align: right;
            }
            .info-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              background-color: #e74c3c;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #ecf0f1;
            }
            .items-table tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .totals {
              text-align: right;
              margin-bottom: 30px;
            }
            .total-row {
              padding: 8px 0;
              font-weight: bold;
            }
            .total-amount {
              font-size: 18px;
              color: #e74c3c;
            }
            .payment-info {
              background-color: #f8f9fa;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .payment-info h3 {
              margin-top: 0;
              color: #2c3e50;
            }
            .notes, .terms {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-left: 4px solid #e74c3c;
            }
            .notes-title, .terms-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
              color: #7f8c8d;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${options.logo ? `<img src="${options.logo}" alt="Logo" class="logo">` : ''}
            <div class="title">${options.title}</div>
            ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
          </div>

          <div class="invoice-info">
            <div>
              <strong>Invoice #:</strong> ${invoice?.number || 'N/A'}<br>
              <strong>Issue Date:</strong> ${invoice?.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'N/A'}<br>
              <strong>Due Date:</strong> ${invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
            </div>
            <div class="invoice-details">
              <strong>Status:</strong> ${invoice?.status || 'N/A'}<br>
              <strong>Balance:</strong> $${invoice?.balance?.toLocaleString() || '0'}
            </div>
          </div>

          <div class="info-section">
            <div class="company-info">
              <div class="info-title">From:</div>
              <div>${options.companyInfo.name}</div>
              <div>${options.companyInfo.address}</div>
              <div>Phone: ${options.companyInfo.phone}</div>
              <div>Email: ${options.companyInfo.email}</div>
              ${options.companyInfo.website ? `<div>Website: ${options.companyInfo.website}</div>` : ''}
            </div>
            <div class="client-info">
              <div class="info-title">To:</div>
              <div>${options.clientInfo.name}</div>
              <div>${options.clientInfo.address}</div>
              ${options.clientInfo.phone ? `<div>Phone: ${options.clientInfo.phone}</div>` : ''}
              ${options.clientInfo.email ? `<div>Email: ${options.clientInfo.email}</div>` : ''}
            </div>
          </div>

          ${
            invoice?.paidAmount
              ? `
            <div class="payment-info">
              <h3>Payment Information</h3>
              <div><strong>Amount Paid:</strong> $${invoice.paidAmount.toLocaleString()}</div>
              <div><strong>Remaining Balance:</strong> $${invoice.balance.toLocaleString()}</div>
            </div>
          `
              : ''
          }

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${options.items
                .map(
                  item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
                  <td>$${item.rate.toLocaleString()}</td>
                  <td>$${item.amount.toLocaleString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${options.totals.subtotal.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>Tax:</span>
              <span>$${options.totals.tax.toLocaleString()}</span>
            </div>
            <div class="total-row total-amount">
              <span>Total:</span>
              <span>$${options.totals.total.toLocaleString()}</span>
            </div>
          </div>

          ${
            options.notes
              ? `
            <div class="notes">
              <div class="notes-title">Notes:</div>
              <div>${options.notes}</div>
            </div>
          `
              : ''
          }

          ${
            options.terms
              ? `
            <div class="terms">
              <div class="terms-title">Payment Terms:</div>
              <div>${options.terms}</div>
            </div>
          `
              : ''
          }

          <div class="footer">
            ${options.footer || 'Thank you for your business!'}
          </div>
        </body>
      </html>
    `;
  }

  private generateProjectReportHTML(project: any, options: PDFOptions): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${options.title}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #3498db;
              padding-bottom: 20px;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .subtitle {
              font-size: 16px;
              color: #7f8c8d;
            }
            .project-summary {
              background-color: #f8f9fa;
              padding: 20px;
              margin-bottom: 30px;
              border-radius: 5px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .summary-item {
              padding: 10px;
              background-color: white;
              border-radius: 3px;
            }
            .summary-label {
              font-weight: bold;
              color: #2c3e50;
            }
            .cost-breakdown {
              margin-bottom: 30px;
            }
            .breakdown-title {
              font-size: 18px;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 15px;
            }
            .breakdown-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #ecf0f1;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
              color: #7f8c8d;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${options.logo ? `<img src="${options.logo}" alt="Logo" class="logo">` : ''}
            <div class="title">${options.title}</div>
            ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
          </div>

          <div class="project-summary">
            <h3>Project Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Project Name:</div>
                <div>${project?.name || 'N/A'}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Status:</div>
                <div>${project?.status || 'N/A'}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Location:</div>
                <div>${project?.location || 'N/A'}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Timeline:</div>
                <div>${project?.timeline || 'N/A'} months</div>
              </div>
            </div>
          </div>

          <div class="cost-breakdown">
            <div class="breakdown-title">Cost Breakdown</div>
            ${
              project?.materialsTotal
                ? `
              <div class="breakdown-item">
                <span>Materials:</span>
                <span>$${project.materialsTotal.toLocaleString()}</span>
              </div>
            `
                : ''
            }
            ${
              project?.laborTotal
                ? `
              <div class="breakdown-item">
                <span>Labor:</span>
                <span>$${project.laborTotal.toLocaleString()}</span>
              </div>
            `
                : ''
            }
            ${
              project?.equipmentTotal
                ? `
              <div class="breakdown-item">
                <span>Equipment:</span>
                <span>$${project.equipmentTotal.toLocaleString()}</span>
              </div>
            `
                : ''
            }
            ${
              project?.overheadTotal
                ? `
              <div class="breakdown-item">
                <span>Overhead:</span>
                <span>$${project.overheadTotal.toLocaleString()}</span>
              </div>
            `
                : ''
            }
            <div class="breakdown-item" style="font-weight: bold; border-top: 2px solid #3498db;">
              <span>Total:</span>
              <span>$${(project?.totalBid || 0).toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            ${options.footer || 'Project Report Generated by Build Profit Solutions'}
          </div>
        </body>
      </html>
    `;
  }

  async sharePDF(uri: string, filename: string): Promise<void> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: filename,
        });
      }
    } catch (error) {
      console.error('Failed to share PDF:', error);
      throw error;
    }
  }

  async savePDF(uri: string, filename: string): Promise<string> {
    try {
      const documentsDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const destinationUri = `${documentsDir}${filename}`;

      await FileSystem.copyAsync({
        from: uri,
        to: destinationUri,
      });

      return destinationUri;
    } catch (error) {
      console.error('Failed to save PDF:', error);
      throw error;
    }
  }
}

export const pdfGenerator = new PDFGeneratorService();

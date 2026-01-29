import { apiService } from './api';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  items: InvoiceItem[];
  notes?: string;
  terms?: string;
  paymentMethod?: string;
  reminderDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method:
    | 'check'
    | 'cash'
    | 'credit_card'
    | 'bank_transfer'
    | 'paypal'
    | 'stripe';
  reference?: string;
  date: string;
  notes?: string;
}

class InvoiceService {
  async generateInvoice(projectData: any, clientData: any): Promise<Invoice> {
    try {
      const invoice: Invoice = {
        id: `INV-${Date.now()}`,
        number: this.generateInvoiceNumber(),
        clientId: clientData.id,
        clientName: clientData.name,
        projectId: projectData.id,
        projectName: projectData.name,
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        status: 'draft',
        subtotal: projectData.totalBid || 0,
        taxRate: 0.08, // 8% tax rate
        taxAmount: (projectData.totalBid || 0) * 0.08,
        total: (projectData.totalBid || 0) * 1.08,
        paidAmount: 0,
        balance: (projectData.totalBid || 0) * 1.08,
        items: this.generateInvoiceItems(projectData),
        notes: 'Thank you for your business!',
        terms: 'Net 30 - Payment due within 30 days',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await apiService.post<Invoice>('/api/invoices', invoice);
      return response?.data || invoice;
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  }

  private generateInvoiceItems(projectData: any): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    // Materials
    if (projectData.materialsTotal) {
      items.push({
        id: '1',
        description: 'Materials and Supplies',
        quantity: 1,
        unit: 'lot',
        rate: projectData.materialsTotal,
        amount: projectData.materialsTotal,
      });
    }

    // Labor
    if (projectData.laborTotal) {
      items.push({
        id: '2',
        description: 'Labor and Installation',
        quantity: 1,
        unit: 'lot',
        rate: projectData.laborTotal,
        amount: projectData.laborTotal,
      });
    }

    // Equipment
    if (projectData.equipmentTotal) {
      items.push({
        id: '3',
        description: 'Equipment and Tools',
        quantity: 1,
        unit: 'lot',
        rate: projectData.equipmentTotal,
        amount: projectData.equipmentTotal,
      });
    }

    // Overhead
    if (projectData.overheadTotal) {
      items.push({
        id: '4',
        description: 'Project Management and Overhead',
        quantity: 1,
        unit: 'lot',
        rate: projectData.overheadTotal,
        amount: projectData.overheadTotal,
      });
    }

    return items;
  }

  async getInvoices(filters?: {
    status?: string;
    clientId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Invoice[]> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      const endpoint = `/api/invoices${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('🔍 Fetching invoices from endpoint:', endpoint);
      const response = await apiService.get<Invoice[]>(endpoint);
      console.log('📦 Invoice response received:', response);
      // apiService.get returns { data, status }, extract data
      const invoices = response?.data || [];
      console.log('📄 Extracted invoices:', invoices?.length || 0, 'invoices');
      return invoices;
    } catch (error) {
      console.error('Failed to get invoices:', error);
      return [];
    }
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    try {
      const response = await apiService.get<Invoice>(`/api/invoices/${id}`);
      return response?.data || null;
    } catch (error) {
      console.error('Failed to get invoice:', error);
      return null;
    }
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    try {
      const response = await apiService.put<Invoice>(`/api/invoices/${id}`, updates);
      return response?.data || updates as Invoice;
    } catch (error) {
      console.error('Failed to update invoice:', error);
      throw error;
    }
  }

  async sendInvoice(id: string): Promise<void> {
    try {
      await apiService.put(`/api/invoices/${id}/send`, { status: 'sent' });
    } catch (error) {
      console.error('Failed to send invoice:', error);
      throw error;
    }
  }

  async recordPayment(
    invoiceId: string,
    paymentData: Omit<Payment, 'id'>
  ): Promise<Payment> {
    try {
      const payment: Payment = {
        id: `PAY-${Date.now()}`,
        ...paymentData,
      };

      const result = await apiService.post<Payment>(
        `/api/invoices/${invoiceId}/payments`,
        payment
      );
      const paymentResponse = result?.data || payment as Payment;

      // Update invoice balance
      await this.updateInvoiceBalance(invoiceId, paymentData.amount);

      return paymentResponse;
    } catch (error) {
      console.error('Failed to record payment:', error);
      throw error;
    }
  }

  private async updateInvoiceBalance(
    invoiceId: string,
    paymentAmount: number
  ): Promise<void> {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) return;

      const newPaidAmount = invoice.paidAmount + paymentAmount;
      const newBalance = invoice.total - newPaidAmount;
      const newStatus = newBalance <= 0 ? 'paid' : invoice.status;

      await this.updateInvoice(invoiceId, {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
      });
    } catch (error) {
      console.error('Failed to update invoice balance:', error);
    }
  }

  async getPaymentHistory(invoiceId: string): Promise<Payment[]> {
    try {
      const response = await apiService.get<Payment[]>(`/api/invoices/${invoiceId}/payments`);
      return response?.data || [];
    } catch (error) {
      console.error('Failed to get payment history:', error);
      return [];
    }
  }

  async generateInvoicePDF(invoiceId: string): Promise<string> {
    try {
      const response = await apiService.post<{ pdfUrl: string }>(
        `/api/invoices/${invoiceId}/pdf`,
        {}
      );
      return response?.data?.pdfUrl || '';
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      throw error;
    }
  }

  async getInvoiceAnalytics(): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueAmount: number;
    averagePaymentTime: number;
    paymentRate: number;
  }> {
    try {
      const response = await apiService.get('/api/invoices/analytics');
      return response?.data || {
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        overdueAmount: 0,
        averagePaymentTime: 0,
        paymentRate: 0,
      };
    } catch (error) {
      console.error('Failed to get invoice analytics:', error);
      return {
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        overdueAmount: 0,
        averagePaymentTime: 0,
        paymentRate: 0,
      };
    }
  }

  async sendPaymentReminder(invoiceId: string, reminderDate?: string): Promise<void> {
    try {
      await apiService.post(`/api/invoices/${invoiceId}/remind`, {
        reminderDate: reminderDate || new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
      throw error;
    }
  }

  async cancelInvoice(invoiceId: string, reason?: string): Promise<void> {
    try {
      await apiService.put(`/api/invoices/${invoiceId}/cancel`, {
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Invoice cancelled',
      });
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();

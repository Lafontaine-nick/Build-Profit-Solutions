const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../middleware/authenticateToken');

// Storage file path
const STORAGE_FILE = path.join(__dirname, '../../storage/invoices.json');

router.use(authenticateToken);

// Helper function to load invoices from disk
async function loadInvoices() {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    }
    throw error;
  }
}

// Helper function to save invoices to disk
async function saveInvoices(invoices) {
  const dir = path.dirname(STORAGE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STORAGE_FILE, JSON.stringify(invoices, null, 2));
}

// Initialize with sample invoices if file doesn't exist
async function initializeInvoices() {
  try {
    const loadedInvoices = await loadInvoices();
    if (loadedInvoices.length === 0) {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      // Subscription plan prices (marketed prices - no tax)
      const BASIC_PRICE = 25;
      const PROFESSIONAL_PRICE = 49;
      const BUSINESS_PRICE = 79;
      
      const calculateTotals = (subtotal) => {
        // No tax - prices are as marketed
        return {
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          total: subtotal,
        };
      };
      
      const sampleInvoices = [
        {
          id: 'INV-202501-001',
          number: 'INV-202501-001',
          clientId: 'subscription-1',
          clientName: 'Build Profit Solutions',
          projectId: 'subscription',
          projectName: 'Basic Plan Subscription',
          issueDate: new Date(now - 30 * oneDay).toISOString(), // 30 days ago
          dueDate: new Date(now).toISOString(), // Today
          status: 'paid',
          ...calculateTotals(BASIC_PRICE),
          paidAmount: calculateTotals(BASIC_PRICE).total,
          balance: 0,
          items: [
            { id: '1', description: 'Basic Plan - Monthly Subscription', quantity: 1, unit: 'month', rate: BASIC_PRICE, amount: BASIC_PRICE },
          ],
          notes: 'Thank you for your subscription!',
          terms: 'Monthly subscription - Auto-renewal',
          createdAt: new Date(now - 30 * oneDay).toISOString(),
          updatedAt: new Date(now - 30 * oneDay).toISOString(),
        },
        {
          id: 'INV-202502-002',
          number: 'INV-202502-002',
          clientId: 'subscription-2',
          clientName: 'Build Profit Solutions',
          projectId: 'subscription',
          projectName: 'Professional Plan Subscription',
          issueDate: new Date(now - 10 * oneDay).toISOString(), // 10 days ago
          dueDate: new Date(now + 20 * oneDay).toISOString(), // 20 days from now
          status: 'sent',
          ...calculateTotals(PROFESSIONAL_PRICE),
          paidAmount: 0,
          balance: calculateTotals(PROFESSIONAL_PRICE).total,
          items: [
            { id: '1', description: 'Professional Plan - Monthly Subscription', quantity: 1, unit: 'month', rate: PROFESSIONAL_PRICE, amount: PROFESSIONAL_PRICE },
          ],
          notes: 'Payment due for your Professional Plan subscription.',
          terms: 'Monthly subscription - Auto-renewal',
          createdAt: new Date(now - 10 * oneDay).toISOString(),
          updatedAt: new Date(now - 10 * oneDay).toISOString(),
        },
        {
          id: 'INV-202502-003',
          number: 'INV-202502-003',
          clientId: 'subscription-3',
          clientName: 'Build Profit Solutions',
          projectId: 'subscription',
          projectName: 'Business Plan Subscription',
          issueDate: new Date(now - 35 * oneDay).toISOString(), // 35 days ago
          dueDate: new Date(now - 5 * oneDay).toISOString(), // 5 days ago (overdue)
          status: 'overdue',
          ...calculateTotals(BUSINESS_PRICE),
          paidAmount: 0,
          balance: calculateTotals(BUSINESS_PRICE).total,
          items: [
            { id: '1', description: 'Business Plan - Monthly Subscription', quantity: 1, unit: 'month', rate: BUSINESS_PRICE, amount: BUSINESS_PRICE },
          ],
          notes: 'Your Business Plan subscription payment is overdue. Please remit payment as soon as possible.',
          terms: 'Monthly subscription - Auto-renewal',
          createdAt: new Date(now - 35 * oneDay).toISOString(),
          updatedAt: new Date(now - 5 * oneDay).toISOString(),
        },
        {
          id: 'INV-202503-004',
          number: 'INV-202503-004',
          clientId: 'subscription-4',
          clientName: 'Build Profit Solutions',
          projectId: 'subscription',
          projectName: 'Basic Plan Subscription',
          issueDate: new Date(now - 3 * oneDay).toISOString(), // 3 days ago
          dueDate: new Date(now + 27 * oneDay).toISOString(), // 27 days from now
          status: 'sent',
          ...calculateTotals(BASIC_PRICE),
          paidAmount: 0,
          balance: calculateTotals(BASIC_PRICE).total,
          items: [
            { id: '1', description: 'Basic Plan - Monthly Subscription', quantity: 1, unit: 'month', rate: BASIC_PRICE, amount: BASIC_PRICE },
          ],
          notes: 'Thank you for choosing our Basic Plan!',
          terms: 'Monthly subscription - Auto-renewal',
          createdAt: new Date(now - 3 * oneDay).toISOString(),
          updatedAt: new Date(now - 3 * oneDay).toISOString(),
        },
      ];
      await saveInvoices(sampleInvoices);
      console.log('📄 Initialized with', sampleInvoices.length, 'subscription invoice samples');
      // Update the module-level invoices variable
      invoices = sampleInvoices;
      return sampleInvoices;
    }
    // Update the module-level invoices variable
    invoices = loadedInvoices;
    return loadedInvoices;
  } catch (error) {
    console.error('Error initializing invoices:', error);
    return [];
  }
}

// Initialize on module load
let invoices = [];
initializeInvoices().then(data => {
  invoices = data;
  console.log('📄 Loaded', invoices.length, 'invoices from storage');
});

// GET /api/invoices - Get all invoices with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, clientId, dateFrom, dateTo } = req.query;
    
    // Reload from disk to ensure we have latest data
    invoices = await loadInvoices();
    
    // Initialize with sample invoices if empty
    if (invoices.length === 0) {
      invoices = await initializeInvoices();
    }
    
    let filtered = [...invoices];
    
    // Apply filters
    if (status) {
      filtered = filtered.filter(inv => inv.status === status);
    }
    if (clientId) {
      filtered = filtered.filter(inv => inv.clientId === clientId);
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(inv => new Date(inv.issueDate) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter(inv => new Date(inv.issueDate) <= toDate);
    }
    
    // Sort by issue date (newest first)
    filtered.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const invoice = invoices.find(inv => inv.id === req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Helper function to recalculate invoice totals from items
function recalculateInvoiceTotals(invoice) {
  // Calculate subtotal from items
  const calculatedSubtotal = invoice.items && invoice.items.length > 0
    ? invoice.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    : (parseFloat(invoice.subtotal) || 0);
  
  // Calculate tax
  const taxRate = parseFloat(invoice.taxRate) || 0.08;
  const calculatedTaxAmount = calculatedSubtotal * taxRate;
  
  // Calculate total
  const calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
  
  // Calculate balance
  const paidAmount = parseFloat(invoice.paidAmount) || 0;
  const calculatedBalance = Math.max(0, calculatedTotal - paidAmount);
  
  return {
    subtotal: Math.round(calculatedSubtotal * 100) / 100,
    taxRate: taxRate,
    taxAmount: Math.round(calculatedTaxAmount * 100) / 100,
    total: Math.round(calculatedTotal * 100) / 100,
    balance: Math.round(calculatedBalance * 100) / 100,
  };
}

// POST /api/invoices - Create new invoice
router.post('/', async (req, res) => {
  try {
    invoices = await loadInvoices();
    
    // Recalculate totals from items
    const recalculated = recalculateInvoiceTotals(req.body);
    
    const newInvoice = {
      ...req.body,
      ...recalculated,
      id: req.body.id || `INV-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    invoices.push(newInvoice);
    await saveInvoices(invoices);
    
    console.log('✅ Created invoice:', newInvoice.id, '- Total:', newInvoice.total);
    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const index = invoices.findIndex(inv => inv.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Merge updates
    const updatedInvoice = {
      ...invoices[index],
      ...req.body,
      id: req.params.id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };
    
    // Recalculate totals if items were updated
    if (req.body.items || req.body.subtotal !== undefined) {
      const recalculated = recalculateInvoiceTotals(updatedInvoice);
      Object.assign(updatedInvoice, recalculated);
    }
    
    invoices[index] = updatedInvoice;
    await saveInvoices(invoices);
    
    console.log('✅ Updated invoice:', req.params.id, '- Total:', invoices[index].total);
    res.json(invoices[index]);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// PUT /api/invoices/:id/send - Send invoice
router.put('/:id/send', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const index = invoices.findIndex(inv => inv.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    invoices[index].status = 'sent';
    invoices[index].updatedAt = new Date().toISOString();
    
    await saveInvoices(invoices);
    console.log('✅ Sent invoice:', req.params.id);
    res.json(invoices[index]);
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// POST /api/invoices/:id/remind - Schedule payment reminder
router.post('/:id/remind', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const index = invoices.findIndex(inv => inv.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = invoices[index];
    const { reminderDate } = req.body;
    const scheduledDate = reminderDate ? new Date(reminderDate) : new Date();
    
    // Store reminder date on invoice
    invoice.reminderDate = scheduledDate.toISOString();
    invoice.updatedAt = new Date().toISOString();
    
    await saveInvoices(invoices);
    
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    
    // In production, this would schedule an email/SMS for the reminder date
    console.log('📧 Payment reminder scheduled for invoice:', req.params.id, 'on', formattedDate);
    
    res.json({ 
      success: true, 
      message: `Reminder scheduled for ${formattedDate}`,
      reminderDate: invoice.reminderDate,
    });
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    res.status(500).json({ error: 'Failed to schedule reminder' });
  }
});

// POST /api/invoices/:id/pdf - Generate PDF (mock)
router.post('/:id/pdf', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const invoice = invoices.find(inv => inv.id === req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Mock PDF URL - in production, generate actual PDF
    const pdfUrl = `https://build-profit-solutions.com/invoices/${invoice.id}.pdf`;
    console.log('📄 PDF generated for invoice:', req.params.id);
    res.json({ pdfUrl, success: true });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// PUT /api/invoices/:id/cancel - Cancel invoice
router.put('/:id/cancel', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const index = invoices.findIndex(inv => inv.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    invoices[index].status = 'cancelled';
    invoices[index].notes = req.body.notes || invoices[index].notes;
    invoices[index].updatedAt = new Date().toISOString();
    
    await saveInvoices(invoices);
    console.log('✅ Cancelled invoice:', req.params.id);
    res.json(invoices[index]);
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({ error: 'Failed to cancel invoice' });
  }
});

// POST /api/invoices/:id/payments - Record payment
router.post('/:id/payments', async (req, res) => {
  try {
    invoices = await loadInvoices();
    const index = invoices.findIndex(inv => inv.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = invoices[index];
    const paymentAmount = parseFloat(req.body.amount) || 0;
    
    // Ensure total is accurate before recording payment
    const recalculated = recalculateInvoiceTotals(invoice);
    invoice.total = recalculated.total;
    
    // Update paid amount
    invoice.paidAmount = (invoice.paidAmount || 0) + paymentAmount;
    
    // Recalculate balance
    invoice.balance = Math.max(0, invoice.total - invoice.paidAmount);
    
    // Update status if fully paid (use small threshold for floating point)
    if (invoice.balance <= 0.01) {
      invoice.status = 'paid';
      invoice.balance = 0;
    }
    
    invoice.updatedAt = new Date().toISOString();
    
    await saveInvoices(invoices);
    
    const payment = {
      id: `PAY-${Date.now()}`,
      invoiceId: req.params.id,
      amount: paymentAmount,
      ...req.body,
      date: new Date().toISOString(),
    };
    
    console.log('✅ Recorded payment for invoice:', req.params.id, '- New balance:', invoice.balance);
    res.status(201).json({ message: 'Payment recorded', payment, invoice });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET /api/invoices/:id/payments - Get payment history
router.get('/:id/payments', async (req, res) => {
  try {
    // Mock payment history - in production, store payments separately
    const payments = [];
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/invoices/analytics - Get invoice analytics
router.get('/analytics', async (req, res) => {
  try {
    invoices = await loadInvoices();
    
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.balance, 0);
    
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const averagePaymentTime = paidInvoices.length > 0
      ? 25 // Mock average days
      : 0;
    
    const paymentRate = totalInvoiced > 0
      ? (totalPaid / totalInvoiced) * 100
      : 0;
    
    res.json({
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      overdueAmount,
      averagePaymentTime,
      paymentRate,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;


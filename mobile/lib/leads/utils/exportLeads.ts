/**
 * Lead Export Utilities
 * CSV and other export formats
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Lead } from '../types';

export async function exportLeadsToCSV(leads: Lead[]): Promise<void> {
  try {
    // Create CSV header
    const headers = [
      'ID',
      'Name',
      'Email',
      'Phone',
      'Company',
      'City',
      'State',
      'Project Type',
      'Budget Min',
      'Budget Max',
      'Timeline',
      'AI Score',
      'Stage',
      'Source',
      'Created At',
      'Description',
    ].join(',');

    // Create CSV rows
    const rows = leads.map(lead => {
      return [
        lead.id,
        `"${lead.contact.name || ''}"`,
        `"${lead.contact.email || ''}"`,
        `"${lead.contact.phone || ''}"`,
        `"${lead.contact.company || ''}"`,
        `"${lead.location?.city || ''}"`,
        `"${lead.location?.state || ''}"`,
        lead.project.type,
        lead.project.budgetMin || '',
        lead.project.budgetMax || '',
        lead.project.timeline || '',
        lead.aiScore || '',
        lead.stage,
        lead.source,
        lead.createdAt,
        `"${(lead.description || '').replace(/"/g, '""')}"`, // Escape quotes
      ].join(',');
    });

    // Combine header and rows
    const csv = [headers, ...rows].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads_export_${timestamp}.csv`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: 'utf8',
    });

    // Share file
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Leads',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

export async function exportLeadsToJSON(leads: Lead[]): Promise<void> {
  try {
    const json = JSON.stringify(leads, null, 2);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads_export_${timestamp}.json`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: 'utf8',
    });

    // Share file
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Leads (JSON)',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

// Generate summary stats for export
export function generateExportSummary(leads: Lead[]): string {
  const totalLeads = leads.length;
  const byStage = leads.reduce((acc, lead) => {
    acc[lead.stage] = (acc[lead.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((sum, l) => sum + (l.aiScore || 0), 0) / leads.length)
    : 0;

  const totalValue = leads.reduce((sum, l) => {
    const avg = ((l.project.budgetMin || 0) + (l.project.budgetMax || 0)) / 2;
    return sum + avg;
  }, 0);

  return `
Export Summary
--------------
Total Leads: ${totalLeads}
Average Score: ${avgScore}
Total Pipeline Value: $${totalValue.toLocaleString()}

Leads by Stage:
${Object.entries(byStage)
  .map(([stage, count]) => `  ${stage}: ${count}`)
  .join('\n')}
`;
}


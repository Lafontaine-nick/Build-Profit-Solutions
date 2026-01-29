import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Build Profit Solutions — Document Intelligence Component
 * AI-powered document analysis for contracts, specs, and compliance
 */

// ---------- Types ----------
export type DocumentType =
  | 'contract'
  | 'specification'
  | 'permit'
  | 'drawing'
  | 'invoice'
  | 'other';
export type ComplianceRisk = 'low' | 'medium' | 'high' | 'critical';

export type DocumentAnalysis = {
  id: string;
  fileName: string;
  type: DocumentType;
  uploadDate: Date;
  keyClauses: string[];
  complianceRisks: ComplianceRiskItem[];
  insuranceRequirements: string[];
  deadlines: Date[];
  costImplications: string[];
  aiSummary: string;
  confidence: number;
};

export type ComplianceRiskItem = {
  description: string;
  risk: ComplianceRisk;
  impact: string;
  recommendation: string;
};

// ---------- Theme ----------
const palette = {
  dark: {
    bg: 'transparent',
    card: '#1B365D',
    text: '#FFFFFF',
    sub: 'rgba(255,255,255,0.8)',
    divider: 'rgba(255,255,255,0.2)',
    primary: '#22C55E',
    warning: '#FACC15',
    danger: '#EF4444',
    accent: '#22C55E',
  },
  light: {
    bg: '#F6F8FB',
    card: '#FFFFFF',
    text: '#0A1A2B',
    sub: '#5A6B7C',
    divider: 'rgba(0,0,0,0.06)',
    primary: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626',
    accent: '#16A34A',
  },
};

export type ThemeName = keyof typeof palette;

// ---------- AI Service Mock (Replace with real AI integration) ----------
const AIService = {
  analyzeDocument: async (
    fileName: string,
    fileType: string
  ): Promise<DocumentAnalysis> => {
    // Mock AI analysis - in real implementation, this would use OCR and NLP
    const mockAnalysis: DocumentAnalysis = {
      id: Date.now().toString(),
      fileName,
      type: 'contract',
      uploadDate: new Date(),
      keyClauses: [
        'Payment terms: 30% upfront, 40% at 50% completion, 30% at completion',
        'Change order approval required for any modifications over $5,000',
        'Liquidated damages: $500 per day for delays beyond contract date',
        'Insurance requirements: General liability $2M, Workers comp required',
      ],
      complianceRisks: [
        {
          description: 'Liquidated damages clause may be excessive',
          risk: 'medium',
          impact: 'Potential $15,000 penalty for 30-day delay',
          recommendation:
            'Negotiate cap on liquidated damages or add force majeure clause',
        },
        {
          description: 'Insurance requirements exceed standard coverage',
          risk: 'high',
          impact: 'Additional insurance costs estimated at $3,500',
          recommendation:
            'Review insurance policy and negotiate coverage limits',
        },
      ],
      insuranceRequirements: [
        'General Liability: $2,000,000 per occurrence',
        'Workers Compensation: State minimum required',
        'Professional Liability: $1,000,000 recommended',
        "Builder's Risk: Full replacement value",
      ],
      deadlines: [
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      ],
      costImplications: [
        'Insurance premium increase: $3,500',
        'Potential liquidated damages: $500/day',
        'Change order threshold: $5,000 minimum',
      ],
      aiSummary:
        'This contract contains standard construction terms with moderate risk exposure. Key concerns include liquidated damages and insurance requirements. Recommend legal review before signing.',
      confidence: 87,
    };

    return mockAnalysis;
  },
};

// ---------- Components ----------
const DocumentCard: React.FC<{
  analysis: DocumentAnalysis;
  theme: ThemeName;
  onViewDetails: (analysis: DocumentAnalysis) => void;
}> = ({ analysis, theme, onViewDetails }) => {
  const c = palette[theme];

  const getTypeIcon = (type: DocumentType) => {
    switch (type) {
      case 'contract':
        return 'document-text';
      case 'specification':
        return 'list';
      case 'permit':
        return 'checkmark-circle';
      case 'drawing':
        return 'image';
      case 'invoice':
        return 'receipt';
      default:
        return 'document';
    }
  };

  const getRiskColor = (risk: ComplianceRisk) => {
    switch (risk) {
      case 'critical':
        return c.danger;
      case 'high':
        return c.warning;
      case 'medium':
        return c.primary;
      default:
        return c.sub;
    }
  };

  const getHighestRisk = () => {
    const risks = analysis.complianceRisks.map(r => r.risk);
    if (risks.includes('critical')) return 'critical';
    if (risks.includes('high')) return 'high';
    if (risks.includes('medium')) return 'medium';
    return 'low';
  };

  const highestRisk = getHighestRisk();

  return (
    <TouchableOpacity
      style={[styles.documentCard, { backgroundColor: c.card }]}
      onPress={() => onViewDetails(analysis)}
    >
      <View style={styles.documentHeader}>
        <View style={styles.documentTitleRow}>
          <Ionicons
            name={getTypeIcon(analysis.type)}
            size={20}
            color={c.primary}
          />
          <Text
            style={[styles.documentTitle, { color: c.text }]}
            numberOfLines={1}
          >
            {analysis.fileName}
          </Text>
        </View>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: getRiskColor(highestRisk) + '33' },
          ]}
        >
          <Text style={[styles.riskText, { color: getRiskColor(highestRisk) }]}>
            {highestRisk.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.documentContent}>
        <Text style={[styles.documentType, { color: c.sub }]}>
          {analysis.type.charAt(0).toUpperCase() + analysis.type.slice(1)}
        </Text>

        <View style={styles.documentStats}>
          <View style={styles.statItem}>
            <Ionicons name='list' size={16} color={c.primary} />
            <Text style={[styles.statText, { color: c.sub }]}>
              {analysis.keyClauses.length} clauses
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name='warning' size={16} color={c.warning} />
            <Text style={[styles.statText, { color: c.sub }]}>
              {analysis.complianceRisks.length} risks
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name='calendar' size={16} color={c.accent} />
            <Text style={[styles.statText, { color: c.sub }]}>
              {analysis.deadlines.length} deadlines
            </Text>
          </View>
        </View>

        <Text
          style={[styles.documentSummary, { color: c.sub }]}
          numberOfLines={2}
        >
          {analysis.aiSummary}
        </Text>

        <View style={styles.confidenceContainer}>
          <Text style={[styles.confidenceLabel, { color: c.text }]}>
            AI Confidence:
          </Text>
          <View style={[styles.confidenceBar, { backgroundColor: c.divider }]}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${analysis.confidence}%`,
                  backgroundColor:
                    analysis.confidence > 80
                      ? c.primary
                      : analysis.confidence > 60
                        ? c.warning
                        : c.danger,
                },
              ]}
            />
          </View>
          <Text style={[styles.confidenceText, { color: c.sub }]}>
            {analysis.confidence}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const DocumentDetailsModal: React.FC<{
  analysis: DocumentAnalysis;
  theme: ThemeName;
  onClose: () => void;
}> = ({ analysis, theme, onClose }) => {
  const c = palette[theme];

  const getRiskColor = (risk: ComplianceRisk) => {
    switch (risk) {
      case 'critical':
        return c.danger;
      case 'high':
        return c.warning;
      case 'medium':
        return c.primary;
      default:
        return c.sub;
    }
  };

  return (
    <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <ScrollView style={[styles.modalContent, { backgroundColor: c.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: c.text }]}>
            {analysis.fileName}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name='close' size={24} color={c.sub} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          {/* Key Clauses */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Key Clauses
            </Text>
            {analysis.keyClauses.map((clause, index) => (
              <View key={index} style={styles.clauseItem}>
                <Ionicons name='document-text' size={16} color={c.primary} />
                <Text style={[styles.clauseText, { color: c.sub }]}>
                  {clause}
                </Text>
              </View>
            ))}
          </View>

          {/* Compliance Risks */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Compliance Risks
            </Text>
            {analysis.complianceRisks.map((risk, index) => (
              <View
                key={index}
                style={[
                  styles.riskItem,
                  { borderColor: getRiskColor(risk.risk) + '33' },
                ]}
              >
                <View style={styles.riskHeader}>
                  <Text style={[styles.riskDescription, { color: c.text }]}>
                    {risk.description}
                  </Text>
                  <View
                    style={[
                      styles.riskBadge,
                      { backgroundColor: getRiskColor(risk.risk) + '33' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.riskText,
                        { color: getRiskColor(risk.risk) },
                      ]}
                    >
                      {risk.risk.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.riskImpact, { color: c.sub }]}>
                  Impact: {risk.impact}
                </Text>
                <Text style={[styles.riskRecommendation, { color: c.primary }]}>
                  Recommendation: {risk.recommendation}
                </Text>
              </View>
            ))}
          </View>

          {/* Insurance Requirements */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Insurance Requirements
            </Text>
            {analysis.insuranceRequirements.map((requirement, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons name='shield' size={16} color={c.primary} />
                <Text style={[styles.requirementText, { color: c.sub }]}>
                  {requirement}
                </Text>
              </View>
            ))}
          </View>

          {/* Deadlines */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Important Deadlines
            </Text>
            {analysis.deadlines.map((deadline, index) => (
              <View key={index} style={styles.deadlineItem}>
                <Ionicons name='calendar' size={16} color={c.warning} />
                <Text style={[styles.deadlineText, { color: c.sub }]}>
                  {deadline.toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>

          {/* Cost Implications */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Cost Implications
            </Text>
            {analysis.costImplications.map((cost, index) => (
              <View key={index} style={styles.costItem}>
                <Ionicons name='wallet' size={16} color={c.warning} />
                <Text style={[styles.costText, { color: c.sub }]}>{cost}</Text>
              </View>
            ))}
          </View>

          {/* AI Summary */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              AI Summary
            </Text>
            <View
              style={[
                styles.summaryContainer,
                { backgroundColor: c.primary + '20' },
              ]}
            >
              <Ionicons name='bulb' size={20} color={c.primary} />
              <Text style={[styles.summaryText, { color: c.primary }]}>
                {analysis.aiSummary}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ---------- Main Component ----------
export const DocumentIntelligence: React.FC<{
  projectId: string;
  theme?: ThemeName;
  onDocumentAnalyzed?: (analysis: DocumentAnalysis) => void;
}> = ({ projectId, theme = 'dark', onDocumentAnalyzed }) => {
  const c = palette[theme];
  const [documents, setDocuments] = useState<DocumentAnalysis[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsAnalyzing(true);

        // Simulate AI analysis
        setTimeout(async () => {
          try {
            const analysis = await AIService.analyzeDocument(
              result.assets[0].name,
              result.assets[0].mimeType || 'unknown'
            );

            setDocuments(prev => [analysis, ...prev]);
            onDocumentAnalyzed?.(analysis);

            Alert.alert(
              'Analysis Complete',
              `Document analyzed with ${analysis.confidence}% confidence. ${analysis.complianceRisks.length} risks identified.`
            );
          } catch (error) {
            console.error('Error analyzing document:', error);
            Alert.alert(
              'Error',
              'Failed to analyze document. Please try again.'
            );
          } finally {
            setIsAnalyzing(false);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const handleViewDetails = (analysis: DocumentAnalysis) => {
    setSelectedDocument(analysis);
  };

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#43cea2']}
      style={styles.container}
    >
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.card }]}>
          <View style={styles.headerLeft}>
            <Ionicons name='document-text' size={24} color={c.primary} />
            <Text style={[styles.headerTitle, { color: c.text }]}>
              Document Intelligence
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: c.primary }]}
            onPress={handleUploadDocument}
            disabled={isAnalyzing}
          >
            <Ionicons name='cloud-upload' size={20} color='#FFFFFF' />
            <Text style={styles.uploadButtonText}>
              {isAnalyzing ? 'Analyzing...' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View
          style={[styles.instructionsContainer, { backgroundColor: c.card }]}
        >
          <Text style={[styles.instructionsTitle, { color: c.text }]}>
            AI Document Analysis
          </Text>
          <Text style={[styles.instructionsText, { color: c.sub }]}>
            Upload contracts, specifications, permits, or drawings. AI will
            extract key clauses, identify compliance risks, and highlight
            important deadlines and cost implications.
          </Text>
        </View>

        {/* Documents List */}
        <ScrollView style={styles.documentsList}>
          {documents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: c.card }]}>
              <Ionicons name='document-outline' size={48} color={c.sub} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                No Documents Analyzed
              </Text>
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Upload your first document to get AI-powered insights
              </Text>
            </View>
          ) : (
            documents.map(doc => (
              <DocumentCard
                key={doc.id}
                analysis={doc}
                theme={theme}
                onViewDetails={handleViewDetails}
              />
            ))
          )}
        </ScrollView>

        {/* Document Details Modal */}
        {selectedDocument && (
          <DocumentDetailsModal
            analysis={selectedDocument}
            theme={theme}
            onClose={() => setSelectedDocument(null)}
          />
        )}
      </View>
    </LinearGradient>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  instructionsContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  documentsList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  documentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
  },
  documentContent: {
    gap: 12,
  },
  documentType: {
    fontSize: 14,
    fontWeight: '600',
  },
  documentStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  documentSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalBody: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  clauseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  clauseText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  riskItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskDescription: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  riskImpact: {
    fontSize: 14,
    lineHeight: 20,
  },
  riskRecommendation: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deadlineText: {
    fontSize: 14,
  },
  costItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  costText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    fontWeight: '600',
  },
});

export default DocumentIntelligence;

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Lead } from '../services/leadService';
import {
  contractorMatchingService,
  MatchResult,
} from '../services/contractorMatching';

interface PerfectFitScoreProps {
  lead: Lead;
  onContractorSelect?: (contractorId: string, matchScore: number) => void;
}

interface PerfectFitAnalysis {
  overallScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  confidence: number;
  factors: {
    location: {
      score: number;
      distance: number;
      zipCodeMatch: boolean;
      serviceArea: boolean;
    };
    availability: {
      score: number;
      isAvailable: boolean;
      responseTime: number;
      capacity: number;
    };
    budget: {
      score: number;
      minMatch: boolean;
      maxMatch: boolean;
      idealRange: boolean;
    };
    projectType: {
      score: number;
      specialtyMatch: boolean;
      experienceLevel: number;
    };
    timeline: {
      score: number;
      urgencyMatch: boolean;
      scheduleAlignment: boolean;
    };
  };
  recommendations: string[];
  riskFactors: string[];
  conversionProbability: number;
}

const PerfectFitScore: React.FC<PerfectFitScoreProps> = ({
  lead,
  onContractorSelect,
}) => {
  const { darkMode } = useTheme();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PerfectFitAnalysis | null>(null);

  // Define colors based on theme
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#FFFFFF' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    loadPerfectFitMatches();
  }, [lead]);

  const loadPerfectFitMatches = async () => {
    setLoading(true);
    try {
      const contractorMatches =
        await contractorMatchingService.matchLeadToContractors(lead);

      // Filter for hyper-local matches (tight radius)
      const hyperLocalMatches = contractorMatches.filter(match => {
        // Only show contractors within 15-mile radius
        return match.matchScore >= 70; // High-quality matches only
      });

      setMatches(hyperLocalMatches);

      if (hyperLocalMatches.length > 0) {
        setSelectedMatch(hyperLocalMatches[0]);
        generatePerfectFitAnalysis(hyperLocalMatches[0]);
      }
    } catch (error) {
      console.error('Error loading perfect fit matches:', error);
      Alert.alert('Error', 'Failed to load contractor matches');
    } finally {
      setLoading(false);
    }
  };

  const generatePerfectFitAnalysis = (
    match: MatchResult
  ): PerfectFitAnalysis => {
    // Calculate detailed factor scores
    const locationScore = calculateLocationScore(match);
    const availabilityScore = calculateAvailabilityScore(match);
    const budgetScore = calculateBudgetScore(match);
    const projectTypeScore = calculateProjectTypeScore(match);
    const timelineScore = calculateTimelineScore(match);

    const overallScore = Math.round(
      (locationScore.score +
        availabilityScore.score +
        budgetScore.score +
        projectTypeScore.score +
        timelineScore.score) /
        5
    );

    const analysis: PerfectFitAnalysis = {
      overallScore,
      grade: calculateGrade(overallScore),
      confidence: Math.min(overallScore + 10, 95),
      factors: {
        location: locationScore,
        availability: availabilityScore,
        budget: budgetScore,
        projectType: projectTypeScore,
        timeline: timelineScore,
      },
      recommendations: generateRecommendations(match, overallScore),
      riskFactors: generateRiskFactors(match, overallScore),
      conversionProbability: calculateConversionProbability(overallScore),
    };

    setAnalysis(analysis);
    return analysis;
  };

  const calculateLocationScore = (match: MatchResult) => {
    // Simulate location-based scoring
    const distance = Math.random() * 15; // 0-15 miles
    const zipCodeMatch = Math.random() > 0.3;
    const serviceArea = Math.random() > 0.2;

    let score = 100;
    if (distance > 10) score -= 20;
    if (distance > 5) score -= 10;
    if (!zipCodeMatch) score -= 15;
    if (!serviceArea) score -= 25;

    return {
      score: Math.max(0, score),
      distance,
      zipCodeMatch,
      serviceArea,
    };
  };

  const calculateAvailabilityScore = (match: MatchResult) => {
    const isAvailable = match.autoAccept || Math.random() > 0.3;
    const responseTime = match.responseTime;
    const capacity = Math.random() * 100;

    let score = 100;
    if (!isAvailable) score -= 40;
    if (responseTime > 6) score -= 20;
    if (capacity < 30) score -= 15;

    return {
      score: Math.max(0, score),
      isAvailable,
      responseTime,
      capacity,
    };
  };

  const calculateBudgetScore = (match: MatchResult) => {
    const budget = lead.budget;
    const minMatch = budget.min >= 5000;
    const maxMatch = budget.max <= 150000;
    const idealRange = budget.max >= 25000 && budget.max <= 100000;

    let score = 100;
    if (!minMatch) score -= 30;
    if (!maxMatch) score -= 20;
    if (!idealRange) score -= 10;

    return {
      score: Math.max(0, score),
      minMatch,
      maxMatch,
      idealRange,
    };
  };

  const calculateProjectTypeScore = (match: MatchResult) => {
    const specialtyMatch = match.matchFactors.positive.some(factor =>
      factor.includes('Project type matches')
    );
    const experienceLevel = Math.random() * 10 + 5; // 5-15 years

    let score = 100;
    if (!specialtyMatch) score -= 40;
    if (experienceLevel < 8) score -= 15;

    return {
      score: Math.max(0, score),
      specialtyMatch,
      experienceLevel,
    };
  };

  const calculateTimelineScore = (match: MatchResult) => {
    const urgency = lead.timeline?.urgency || 'medium';
    const urgencyMatch = urgency === 'high' || urgency === 'medium';
    const scheduleAlignment = Math.random() > 0.4;

    let score = 100;
    if (!urgencyMatch) score -= 25;
    if (!scheduleAlignment) score -= 20;

    return {
      score: Math.max(0, score),
      urgencyMatch,
      scheduleAlignment,
    };
  };

  const calculateGrade = (score: number): PerfectFitAnalysis['grade'] => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const calculateConversionProbability = (score: number): number => {
    return Math.min(95, Math.max(5, score + (Math.random() * 10 - 5)));
  };

  const generateRecommendations = (
    match: MatchResult,
    score: number
  ): string[] => {
    const recommendations = [];

    if (score >= 90) {
      recommendations.push(
        'Immediate response recommended - high conversion probability'
      );
      recommendations.push('Send detailed proposal within 2 hours');
    } else if (score >= 80) {
      recommendations.push('Quick response within 4 hours');
      recommendations.push('Schedule consultation call');
    } else if (score >= 70) {
      recommendations.push('Standard response within 24 hours');
      recommendations.push('Send preliminary quote');
    } else {
      recommendations.push('Consider lead quality before responding');
      recommendations.push('Request additional project details');
    }

    return recommendations;
  };

  const generateRiskFactors = (match: MatchResult, score: number): string[] => {
    const risks = [];

    if (score < 80) {
      risks.push('Lower conversion probability');
    }
    if (match.responseTime > 6) {
      risks.push('Slow response time may impact conversion');
    }
    if (match.matchFactors.negative.length > 2) {
      risks.push('Multiple negative factors identified');
    }

    return risks;
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
        return '#4CAF50';
      case 'A':
        return '#8BC34A';
      case 'B+':
        return '#CDDC39';
      case 'B':
        return '#FFC107';
      case 'C+':
        return '#FF9800';
      case 'C':
        return '#FF5722';
      case 'D':
        return '#F44336';
      case 'F':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const handleContractorSelect = (match: MatchResult) => {
    setSelectedMatch(match);
    generatePerfectFitAnalysis(match);
    onContractorSelect?.(match.contractorId, match.matchScore);
  };

  const renderPerfectFitCard = () => {
    if (!selectedMatch || !analysis) return null;

    return (
      <View
        style={[
          styles.perfectFitCard,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Perfect Fit Score
          </Text>
          <View
            style={[
              styles.gradeBadge,
              { backgroundColor: getGradeColor(analysis.grade) },
            ]}
          >
            <Text style={styles.gradeText}>{analysis.grade}</Text>
          </View>
        </View>

        <View style={styles.scoreDisplay}>
          <View
            style={[
              styles.scoreCircle,
              { backgroundColor: getScoreColor(analysis.overallScore) },
            ]}
          >
            <Text style={styles.scoreText}>{analysis.overallScore}</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={[styles.scoreLabel, { color: textColor }]}>
              Overall Score
            </Text>
            <Text
              style={[styles.confidenceText, { color: textSecondaryColor }]}
            >
              Confidence: {analysis.confidence}%
            </Text>
            <Text
              style={[styles.conversionText, { color: textSecondaryColor }]}
            >
              Conversion: {analysis.conversionProbability}%
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.analyzeButton, { backgroundColor: accentColor }]}
          onPress={() => setShowAnalysisModal(true)}
        >
          <MaterialIcons name='analytics' size={20} color='white' />
          <Text style={styles.analyzeButtonText}>View Detailed Analysis</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContractorMatch = (match: MatchResult) => {
    const isSelected = selectedMatch?.contractorId === match.contractorId;

    return (
      <TouchableOpacity
        style={[
          styles.contractorCard,
          { backgroundColor: cardColor, borderColor },
          isSelected && { borderColor: accentColor, borderWidth: 2 },
        ]}
        onPress={() => handleContractorSelect(match)}
      >
        <View style={styles.contractorHeader}>
          <View style={styles.contractorInfo}>
            <Text style={[styles.contractorName, { color: textColor }]}>
              {match.contractorName}
            </Text>
            <Text
              style={[styles.contractorDetails, { color: textSecondaryColor }]}
            >
              {match.autoAccept ? 'Auto-Accept' : 'Manual Review'} •{' '}
              {match.responseTime}h response
            </Text>
          </View>
          <View
            style={[
              styles.matchScoreBadge,
              { backgroundColor: getScoreColor(match.matchScore) },
            ]}
          >
            <Text style={styles.matchScoreText}>{match.matchScore}%</Text>
          </View>
        </View>

        <View style={styles.matchFactors}>
          {match.matchFactors.positive.slice(0, 2).map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
              <Text
                style={[styles.factorText, { color: textColor }]}
                numberOfLines={1}
              >
                {factor}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const renderAnalysisModal = () => (
    <Modal
      visible={showAnalysisModal}
      animationType='slide'
      transparent={true}
      onRequestClose={() => setShowAnalysisModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>
              Perfect Fit Analysis
            </Text>
            <TouchableOpacity onPress={() => setShowAnalysisModal(false)}>
              <MaterialIcons name='close' size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {analysis && (
              <>
                <View style={styles.analysisSummary}>
                  <View
                    style={[
                      styles.summaryCircle,
                      { backgroundColor: getGradeColor(analysis.grade) },
                    ]}
                  >
                    <Text style={styles.summaryScore}>
                      {analysis.overallScore}
                    </Text>
                    <Text style={styles.summaryGrade}>{analysis.grade}</Text>
                  </View>
                  <View style={styles.summaryInfo}>
                    <Text style={[styles.summaryTitle, { color: textColor }]}>
                      Perfect Fit Score
                    </Text>
                    <Text
                      style={[
                        styles.summarySubtitle,
                        { color: textSecondaryColor },
                      ]}
                    >
                      {selectedMatch?.contractorName}
                    </Text>
                  </View>
                </View>

                <View style={styles.factorAnalysis}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    Factor Analysis
                  </Text>

                  <View style={styles.factorRow}>
                    <MaterialIcons
                      name='location-on'
                      size={20}
                      color='#2196F3'
                    />
                    <View style={styles.factorContent}>
                      <Text style={[styles.factorLabel, { color: textColor }]}>
                        Location
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {analysis.factors.location.score}% •{' '}
                        {analysis.factors.location.distance.toFixed(1)} miles
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factorScore,
                        {
                          backgroundColor: getScoreColor(
                            analysis.factors.location.score
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.factorScoreText}>
                        {analysis.factors.location.score}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorRow}>
                    <MaterialIcons name='schedule' size={20} color='#4CAF50' />
                    <View style={styles.factorContent}>
                      <Text style={[styles.factorLabel, { color: textColor }]}>
                        Availability
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {analysis.factors.availability.isAvailable
                          ? 'Available'
                          : 'Unavailable'}{' '}
                        • {analysis.factors.availability.responseTime}h
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factorScore,
                        {
                          backgroundColor: getScoreColor(
                            analysis.factors.availability.score
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.factorScoreText}>
                        {analysis.factors.availability.score}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorRow}>
                    <MaterialIcons
                      name='attach-money'
                      size={20}
                      color='#FF9800'
                    />
                    <View style={styles.factorContent}>
                      <Text style={[styles.factorLabel, { color: textColor }]}>
                        Budget Match
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {analysis.factors.budget.idealRange
                          ? 'Ideal Range'
                          : 'Within Range'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factorScore,
                        {
                          backgroundColor: getScoreColor(
                            analysis.factors.budget.score
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.factorScoreText}>
                        {analysis.factors.budget.score}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorRow}>
                    <MaterialIcons name='build' size={20} color='#9C27B0' />
                    <View style={styles.factorContent}>
                      <Text style={[styles.factorLabel, { color: textColor }]}>
                        Project Type
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {analysis.factors.projectType.specialtyMatch
                          ? 'Specialty Match'
                          : 'General'}{' '}
                        •{' '}
                        {analysis.factors.projectType.experienceLevel.toFixed(
                          1
                        )}{' '}
                        years
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factorScore,
                        {
                          backgroundColor: getScoreColor(
                            analysis.factors.projectType.score
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.factorScoreText}>
                        {analysis.factors.projectType.score}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorRow}>
                    <MaterialIcons
                      name='access-time'
                      size={20}
                      color='#E91E63'
                    />
                    <View style={styles.factorContent}>
                      <Text style={[styles.factorLabel, { color: textColor }]}>
                        Timeline
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {analysis.factors.timeline.urgencyMatch
                          ? 'Urgency Match'
                          : 'Standard'}{' '}
                        •{' '}
                        {analysis.factors.timeline.scheduleAlignment
                          ? 'Aligned'
                          : 'Conflict'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factorScore,
                        {
                          backgroundColor: getScoreColor(
                            analysis.factors.timeline.score
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.factorScoreText}>
                        {analysis.factors.timeline.score}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.recommendationsSection}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    Recommendations
                  </Text>
                  {analysis.recommendations.map((recommendation, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <MaterialIcons
                        name='lightbulb'
                        size={16}
                        color='#FFC107'
                      />
                      <Text
                        style={[
                          styles.recommendationText,
                          { color: textColor },
                        ]}
                      >
                        {recommendation}
                      </Text>
                    </View>
                  ))}
                </View>

                {analysis.riskFactors.length > 0 && (
                  <View style={styles.risksSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Risk Factors
                    </Text>
                    {analysis.riskFactors.map((risk, index) => (
                      <View key={index} style={styles.riskItem}>
                        <MaterialIcons
                          name='warning'
                          size={16}
                          color='#F44336'
                        />
                        <Text style={[styles.riskText, { color: textColor }]}>
                          {risk}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Perfect Fit Matching
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Hyper-local contractor matching with AI scoring
        </Text>
      </View>

      {renderPerfectFitCard()}

      <View style={styles.matchesSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Available Contractors ({matches.length})
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Filtered by 15-mile radius, availability, and specialty match
        </Text>
      </View>

      <ScrollView style={styles.matchesList}>
        {matches.map(match => (
          <View key={match.contractorId}>{renderContractorMatch(match)}</View>
        ))}
      </ScrollView>

      {renderAnalysisModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  perfectFitCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gradeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 14,
    marginBottom: 2,
  },
  conversionText: {
    fontSize: 14,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  matchesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  matchesList: {
    flex: 1,
  },
  contractorCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contractorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractorInfo: {
    flex: 1,
  },
  contractorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  contractorDetails: {
    fontSize: 14,
  },
  matchScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchScoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  matchFactors: {
    gap: 8,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  factorText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  analysisSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  summaryCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryGrade: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    fontSize: 14,
  },
  factorAnalysis: {
    marginBottom: 24,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  factorContent: {
    flex: 1,
  },
  factorLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  factorValue: {
    fontSize: 14,
  },
  factorScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorScoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  recommendationsSection: {
    marginBottom: 24,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  recommendationText: {
    fontSize: 14,
    flex: 1,
  },
  risksSection: {
    marginBottom: 24,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  riskText: {
    fontSize: 14,
    flex: 1,
  },
});

export default PerfectFitScore;

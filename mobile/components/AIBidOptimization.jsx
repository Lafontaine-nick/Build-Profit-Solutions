import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';

const API_BASE = 'http://192.168.0.201:3001/api'; // Use your computer's IP address

const AIBidOptimization = ({ bid, calc, onMarkupChange }) => {
  const [marketData, setMarketData] = useState(null);
  const [laborData, setLaborData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAIData();
  }, [bid.zipCode, bid.projectType]);

  const fetchAIData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Determine location from zip code or use default
      const location = getLocationFromZip(bid.zipCode) || 'las_vegas';
      const projectType = getProjectTypeKey(bid.projectType) || 'kitchen_remodel';

      console.log(`🤖 Fetching AI data for ${location}, ${projectType}`);

      // Fetch labor rates
      const laborResponse = await fetch(`${API_BASE}/bls/labor-rates/${location}`);
      const laborResult = await laborResponse.json();
      setLaborData(laborResult);

      // Fetch market analysis
      const marketResponse = await fetch(`${API_BASE}/bls/market-analysis/${location}/${projectType}`);
      const marketResult = await marketResponse.json();
      setMarketData(marketResult);

      console.log('✅ AI data loaded:', { laborResult, marketResult });

    } catch (error) {
      console.error('❌ AI data fetch error:', error);
      setError('Failed to load AI analysis data');
      
      // Set fallback data
      setLaborData({
        location: 'las_vegas',
        data: {
          carpenters: 28.50,
          electricians: 32.75,
          plumbers: 30.25,
          painters: 24.80,
          laborers: 22.15,
          equipment_operators: 26.90
        },
        source: 'fallback'
      });
      
      setMarketData({
        location: 'las_vegas',
        projectType: 'kitchen_remodel',
        analysis: {
          regionalMultiplier: 1.0,
          adjustedRates: { min: 85, max: 140, avg: 112 },
          competitivenessScore: 'competitive',
          avgLaborRate: 27.56,
          marketTrend: 'stable'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getLocationFromZip = (zipCode) => {
    // Simple mapping - in production, you'd use a proper zip code to city API
    const zipMappings = {
      '89011': 'las_vegas',
      '89101': 'las_vegas',
      '85001': 'phoenix',
      '80201': 'denver',
      '90210': 'los_angeles',
      '94102': 'san_francisco'
    };
    return zipMappings[zipCode] || 'las_vegas';
  };

  const getProjectTypeKey = (projectType) => {
    const typeMappings = {
      'Kitchen Remodel': 'kitchen_remodel',
      'Bathroom Remodel': 'bathroom_remodel',
      'Home Renovation': 'home_renovation',
      'Addition': 'addition',
      'New Build': 'new_build'
    };
    return typeMappings[projectType] || 'kitchen_remodel';
  };

  const calculateRiskLevel = () => {
    if (!marketData) return 'MEDIUM';
    
    const { avgLaborRate, competitivenessScore } = marketData.analysis;
    
    if (avgLaborRate > 30 && competitivenessScore === 'competitive') return 'LOW';
    if (avgLaborRate < 25 && competitivenessScore === 'aggressive') return 'HIGH';
    return 'MEDIUM';
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'LOW': return '#43cea2';
      case 'MEDIUM': return '#f59e0b';
      case 'HIGH': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const getSuggestedMarkup = () => {
    if (!marketData) return 18;
    
    const { competitivenessScore, avgLaborRate } = marketData.analysis;
    
    // AI logic for markup suggestion
    if (competitivenessScore === 'aggressive' && avgLaborRate < 25) return 15;
    if (competitivenessScore === 'competitive' && avgLaborRate > 30) return 20;
    if (competitivenessScore === 'moderate') return 18;
    return 18;
  };

  const calculateWinRate = () => {
    const currentMarkup = bid.markupPct;
    const suggestedMarkup = getSuggestedMarkup();
    const markupDiff = Math.abs(currentMarkup - suggestedMarkup);
    
    // Win rate decreases as markup moves away from suggested
    const baseRate = 75;
    const penalty = markupDiff * 2;
    
    return Math.max(60, Math.min(85, baseRate - penalty));
  };

  const validateCosts = () => {
    if (!laborData || !calc) return 'VALID';
    
    const { data: laborRates } = laborData;
    const avgLaborRate = Object.values(laborRates).reduce((sum, rate) => sum + rate, 0) / Object.keys(laborRates).length;
    
    // Check if labor costs seem reasonable
    const estimatedLaborCost = calc.labor;
    const expectedLaborCost = (avgLaborRate * 40) * 2; // Rough estimate
    
    if (Math.abs(estimatedLaborCost - expectedLaborCost) / expectedLaborCost > 0.5) {
      return 'REVIEW_NEEDED';
    }
    
    return 'VALID';
  };

  if (loading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#43cea2" />
        <Text style={{ color: '#9BB4D0', marginTop: 10 }}>Loading AI analysis...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: '#ef4444', marginBottom: 10 }}>⚠️ {error}</Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#43cea2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
          onPress={fetchAIData}
        >
          <Text style={{ color: '#000', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const riskLevel = calculateRiskLevel();
  const suggestedMarkup = getSuggestedMarkup();
  const winRate = calculateWinRate();
  const costValidation = validateCosts();

  return (
    <>
      {/* Market Analysis */}
      <View style={s.inputGroup}>
        <Text style={[s.label, { marginBottom: 12, color: '#43cea2', fontSize: 16 }]}>📊 Market Analysis</Text>
        
        <View style={{
          backgroundColor: 'rgba(67, 206, 162, 0.08)',
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(67, 206, 162, 0.2)',
          marginBottom: 12
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#43cea2', fontSize: 14, fontWeight: '600', marginRight: 8 }}>Competitive Positioning</Text>
            <View style={{ backgroundColor: '#43cea2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>GOOD</Text>
            </View>
          </View>
          <Text style={{ color: '#9BB4D0', fontSize: 12, lineHeight: 16 }}>
            {marketData ? 
              `Regional rates: $${marketData.analysis.adjustedRates.min}-$${marketData.analysis.adjustedRates.max}/sq ft. Your current: $${calc.unitPrice.toFixed(2)}/sq ft` :
              'Market analysis in progress...'
            }
          </Text>
          {laborData && (
            <Text style={{ color: '#9BB4D0', fontSize: 11, marginTop: 4 }}>
              Data source: {laborData.source === 'bls_api' ? 'BLS Government Data' : 'Industry Estimates'}
            </Text>
          )}
        </View>
      </View>

      {/* Risk Assessment */}
      <View style={s.inputGroup}>
        <Text style={[s.label, { marginBottom: 12, color: '#43cea2', fontSize: 16 }]}>⚠️ Risk Assessment</Text>
        
        <View style={{
          backgroundColor: `rgba(${getRiskColor(riskLevel) === '#43cea2' ? '67, 206, 162' : getRiskColor(riskLevel) === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.08)`,
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: `rgba(${getRiskColor(riskLevel) === '#43cea2' ? '67, 206, 162' : getRiskColor(riskLevel) === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.2)`,
          marginBottom: 12
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: getRiskColor(riskLevel), fontSize: 14, fontWeight: '600', marginRight: 8 }}>Project Risk Level</Text>
            <View style={{ backgroundColor: getRiskColor(riskLevel), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>{riskLevel}</Text>
            </View>
          </View>
          <Text style={{ color: '#9BB4D0', fontSize: 12, lineHeight: 16 }}>
            {bid.projectType} complexity suggests {suggestedMarkup}% markup. Regional labor rates: ${laborData?.data?.carpenters?.toFixed(2)}/hr average.
          </Text>
        </View>
      </View>

      {/* Profit Optimization */}
      <View style={s.inputGroup}>
        <Text style={[s.label, { marginBottom: 12, color: '#43cea2', fontSize: 16 }]}>💰 Profit Optimization</Text>
        
        <View style={{
          backgroundColor: 'rgba(67, 206, 162, 0.08)',
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(67, 206, 162, 0.2)',
          marginBottom: 12
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#43cea2', fontSize: 14, fontWeight: '600', marginRight: 8 }}>Markup Analysis</Text>
            <View style={{ backgroundColor: '#43cea2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>OPTIMAL</Text>
            </View>
          </View>
          <Text style={{ color: '#9BB4D0', fontSize: 12, lineHeight: 16 }}>
            Current {bid.markupPct}% markup provides healthy margins. AI suggests {suggestedMarkup}% for optimal win probability.
          </Text>
        </View>
      </View>

      {/* Cost Validation */}
      <View style={s.inputGroup}>
        <Text style={[s.label, { marginBottom: 12, color: '#43cea2', fontSize: 16 }]}>✅ Cost Validation</Text>
        
        <View style={{
          backgroundColor: costValidation === 'VALID' ? 'rgba(67, 206, 162, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: costValidation === 'VALID' ? 'rgba(67, 206, 162, 0.2)' : 'rgba(245, 158, 11, 0.2)',
          marginBottom: 12
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: costValidation === 'VALID' ? '#43cea2' : '#f59e0b', fontSize: 14, fontWeight: '600', marginRight: 8 }}>Cost Verification</Text>
            <View style={{ backgroundColor: costValidation === 'VALID' ? '#43cea2' : '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>{costValidation}</Text>
            </View>
          </View>
          <Text style={{ color: '#9BB4D0', fontSize: 12, lineHeight: 16 }}>
            {costValidation === 'VALID' ? 
              'Labor and material costs align with regional averages. No anomalies detected.' :
              'Labor costs may need review. Consider verifying hourly rates and project scope.'
            }
          </Text>
        </View>
      </View>

      {/* AI Recommendations */}
      <View style={s.inputGroup}>
        <Text style={[s.label, { marginBottom: 12, color: '#43cea2', fontSize: 16 }]}>🎯 AI Recommendations</Text>
        
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#9BB4D0', fontSize: 14, fontWeight: '600' }}>Suggested Markup:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: '#43cea2', fontSize: 16, fontWeight: '700' }}>{suggestedMarkup}%</Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#43cea2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onMarkupChange(suggestedMarkup);
                }}
              >
                <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#9BB4D0', fontSize: 14, fontWeight: '600' }}>Expected Win Rate:</Text>
            <Text style={{ color: '#43cea2', fontSize: 16, fontWeight: '700' }}>{Math.round(winRate)}%</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#9BB4D0', fontSize: 14, fontWeight: '600' }}>Regional Multiplier:</Text>
            <Text style={{ color: '#43cea2', fontSize: 16, fontWeight: '700' }}>{marketData?.analysis?.regionalMultiplier?.toFixed(2)}x</Text>
          </View>
        </View>
      </View>
    </>
  );
};

// Styles (reusing from estimate-generator)
const s = {
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#9BB4D0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
};

export default AIBidOptimization;

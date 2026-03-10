import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

/** -----------------------
 *  Theme matching the app
 *  ---------------------- */
const baseColors = {
  bg: '#0d2745',
  bgTop: '#0b1c38',
  bgBottom: '#43cea2',
  card: '#173659',
  cardDark: '#132f54',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#e9f1ff',
  textDim: '#a7bed9',
  accent: '#38d39f',
  accentDim: 'rgba(56,211,159,0.2)',
  button: '#38d39f',
  buttonText: '#0d2745',
  chip: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.08)',
  yellow: '#ffd166',
  orange: '#fbbf24',
  red: '#f87171',
  green: '#34d399',
};

export default function ProjectAnalysis({ bid, calc, onMarkupChange }) {
  const { theme } = useTheme();
  const themeColors = useMemo(() => getColors(theme), [theme]);
  const darkMode = themeColors.bg === '#000000';
  const palette = useMemo(() => ({
    ...baseColors,
    text: darkMode ? baseColors.text : themeColors.text,
    textDim: darkMode ? baseColors.textDim : themeColors.sub,
    card: darkMode ? baseColors.card : themeColors.bg,
    cardDark: darkMode ? baseColors.cardDark : themeColors.bg,
    chip: darkMode ? baseColors.chip : (themeColors.surface2 || themeColors.bg),
    divider: darkMode ? baseColors.divider : themeColors.line,
    accentText: darkMode ? '#FFFFFF' : themeColors.text,
    mutedOpacity: darkMode ? 0.7 : 1,
    subtleOpacity: darkMode ? 0.6 : 1,
    faintOpacity: darkMode ? 0.5 : 1,
  }), [darkMode, themeColors]);
  const styles = useMemo(() => getStyles(palette), [palette]);

  // Early return if data is not ready
  if (!bid || !calc) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading project data...</Text>
      </View>
    );
  }

  // Tab state
  const [activeTab, setActiveTab] = useState('scenario');
  
  // AI Data state
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [selectedLabor, setSelectedLabor] = useState(null);
  
  // Track if AI markup has been applied
  const [aiMarkupApplied, setAiMarkupApplied] = useState(false);
  // Use ref to capture the FIRST markup value we see - this NEVER changes
  const initialMarkupRef = useRef(null);
  if (initialMarkupRef.current === null && bid?.markupPct !== undefined) {
    initialMarkupRef.current = Number(bid.markupPct);
  }
  const [originalMarkup] = useState(() => initialMarkupRef.current || 15);
  const [aiSuggestedValue, setAiSuggestedValue] = useState(null);

  // Scenario controls - adjustments to base values
  // Default to no adjustments (all zeros) on load
  const [adj, setAdj] = useState(() => {
    // Start with no adjustments selected
    return { 
      laborPct: 0, 
      materialPct: 0, 
      markupPct: 0,
      overheadPct: 0 
    };
  });
  
  // Animation values
  const totalBidAnim = useRef(new Animated.Value(0)).current;
  const profitMarginColorAnim = useRef(new Animated.Value(0)).current;

  // Fetch AI data on component mount
  useEffect(() => {
    const fetchAIData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try multiple API endpoints
        const API_ENDPOINTS = [
          'http://192.168.1.115:3001/api',
          'http://localhost:3001/api',
          'http://127.0.0.1:3001/api'
        ];
        
        const projectType = bid.projectType || 'kitchen_remodel';
        const location = bid.projectCity?.toLowerCase().replace(/\s/g, '_') || 'las_vegas';

        console.log(`🔍 Fetching market analysis for ${projectType} in ${location}`);

        let marketData = null;
        let laborData = null;
        let lastError = null;

        // Try each endpoint
        for (const API_BASE of API_ENDPOINTS) {
          try {
            // Fetch Market Analysis
            const marketRes = await fetch(`${API_BASE}/bls/market-analysis/${location}/${projectType}`, {
              timeout: 5000 // 5 second timeout
            });
            
            if (marketRes.ok) {
              marketData = await marketRes.json();
            } else {
              throw new Error(`Market API returned ${marketRes.status}`);
            }

            // Fetch Labor Rates
            const laborRes = await fetch(`${API_BASE}/bls/labor-rates/${location}`, {
              timeout: 5000 // 5 second timeout
            });
            
            if (laborRes.ok) {
              laborData = await laborRes.json();
            } else {
              throw new Error(`Labor API returned ${laborRes.status}`);
            }

            // If we get here, both requests succeeded
            setAiData({ marketData, laborData });
            console.log('✅ Market analysis data loaded successfully');
            return; // Exit the loop

          } catch (endpointError) {
            // Silently try next endpoint - don't log every failure
            lastError = endpointError;
            continue; // Try next endpoint
          }
        }

        // If we get here, all endpoints failed - this is expected if backend is not running
        // Silently fall through to offline mode

      } catch (err) {
        // Only log if it's an unexpected error (not network failure)
        if (!err?.message?.includes('Network request failed') && !err?.message?.includes('All API endpoints failed')) {
          console.error("❌ AI Data Fetch Error:", err);
        }
        // Don't set error state - just use offline mode silently
        
        // Set fallback data for offline mode
        setAiData({
          marketData: {
            location: bid.projectCity || 'Unknown',
            projectType: bid.projectType || 'kitchen_remodel',
            analysis: {
              regionalMultiplier: 1.0,
              adjustedRates: { min: 85, max: 140, avg: 112 },
              competitivenessScore: 'moderate',
              avgLaborRate: 25.50,
              marketTrend: 'stable'
            },
            lastUpdated: new Date().toISOString()
          },
          laborData: {
            data: {
              'General Labor': 25.50,
              'Skilled Labor': 32.75,
              'Specialized': 45.00
            }
          }
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAIData();
  }, [bid?.projectType, bid?.projectCity]);

  // Base values from the current bid
  const base = useMemo(() => {
    // Calculate total overhead same way as step 6
    const totalOverhead = (bid?.insuranceOverhead || 0) + 
                          (bid?.equipment || 0) + 
                          (bid?.facilities || 0) + 
                          (bid?.otherOverhead || 0);
    
    return {
      labor: Number(calc?.labor || 0),
      materials: Number(calc?.materials || 0),
      overhead: Number(calc?.overhead || 0),
      totalOverhead: totalOverhead, // Total overhead for net profit calculation
      contingency: Number(calc?.contingency || 0),
      markupPct: Number(bid?.markupPct || 25), // Use actual markup from bid (default 25 to match step 6)
      originalTotalBid: Number(calc?.grandTotal || calc?.total || 0), // Original contract price
      subtotal: Number(calc?.subtotal || 0), // Subtotal for net profit percentage calculation (includes permit costs)
      permitCosts: Number(calc?.permitCosts || 0), // Permit costs to include in adjustedSubtotal
      profit: Number(calc?.profit || 0), // Gross profit from calc
    };
  }, [calc, bid]);

  // Simulated/adjusted values
  const sim = useMemo(() => {
    const labor = base.labor * (1 + adj.laborPct / 100);
    const materials = base.materials * (1 + adj.materialPct / 100);
    const overhead = base.overhead * (1 + adj.overheadPct / 100);
    const directCost = labor + materials;
    // Include permit costs so adjustedSubtotal matches base.subtotal when no adjustments
    // This ensures sim.netProfit matches base.profit - base.totalOverhead when all adjustments are 0
    const adjustedSubtotal = directCost + overhead + base.permitCosts;
    
    // Calculate if markup is manually adjusted (inline to avoid dependency issues)
    // All presets have markupPct: 0, so any non-zero value is manually adjusted
    const isMarkupManuallyAdjustedInline = adj.markupPct !== 0;
    
    // If markup is manually adjusted, recalculate the bid
    // If it's a preset scenario, keep the original bid fixed
    let totalBid, profit, marginPct;
    
    if (isMarkupManuallyAdjustedInline) {
      // Pricing strategy mode: bid adjustment is a direct percentage change of the original bid
      // +2% Bid means: New Bid = Original Bid × 1.02
      // NOT: increase markup percentage by 2%
      const bidAdjustmentFactor = 1 + (adj.markupPct / 100);
      totalBid = base.originalTotalBid * bidAdjustmentFactor;
      
      // Calculate profit from the adjusted bid
      // Profit = Total Bid - Adjusted Costs
      profit = totalBid - adjustedSubtotal;
      marginPct = totalBid > 0 ? (profit / totalBid) * 100 : 0;
      
      // Keep decimal precision - only round when displaying (2 decimal places)
      
    } else {
      // Execution outcome mode: bid stays fixed, costs change, profit adjusts
      totalBid = base.originalTotalBid; // Keep original contract price
      
      // Check if there are any cost adjustments active
      const hasCostAdjustments = adj.laborPct !== 0 || adj.materialPct !== 0 || adj.overheadPct !== 0;
      
      if (hasCostAdjustments) {
        // When costs change: Profit = Bid - Adjusted Costs (profit decreases when costs increase)
        profit = totalBid - adjustedSubtotal;
      } else {
        // When no adjustments: Use markup method to match step 6 exactly
        // This ensures profit matches base.profit when no adjustments are active
        profit = (adjustedSubtotal * base.markupPct) / 100;
      }
      
      marginPct = totalBid > 0 ? (profit / totalBid) * 100 : 0;
    }
    
    // Calculate net profit (profit - totalOverhead) same way as step 6
    const adjustedTotalOverhead = base.totalOverhead * (1 + adj.overheadPct / 100);
    
    // When only bid adjustment is active (no cost adjustments), profit change should equal bid change
    let netProfit;
    if (isMarkupManuallyAdjustedInline && adj.laborPct === 0 && adj.materialPct === 0 && adj.overheadPct === 0) {
      // Pure bid adjustment: net profit change = bid change exactly
      // This ensures profitDelta matches bidDelta when only bid is adjusted
      const originalNetProfit = base.profit - base.totalOverhead;
      const bidDelta = totalBid - base.originalTotalBid;
      netProfit = originalNetProfit + bidDelta;
    } else {
      // Normal calculation: profit - overhead
      netProfit = profit - adjustedTotalOverhead;
    }
    
    // Keep both metrics explicit:
    // - On-cost return: net profit / total cost
    // - Margin on revenue: net profit / total bid
    const netProfitOnCostPct = adjustedSubtotal > 0 ? (netProfit / adjustedSubtotal) * 100 : 0;
    const netProfitMarginPct = totalBid > 0 ? (netProfit / totalBid) * 100 : 0;
    
    const result = { 
      labor, 
      materials, 
      overhead, 
      totalBid, 
      profit, // Gross profit
      netProfit, // Net profit after overhead (matches step 6)
      marginPct, // Profit margin (profit/totalBid * 100) - keeping for backward compatibility
      netProfitOnCostPct,
      netProfitMarginPct,
      markupPct: base.markupPct + adj.markupPct, 
      directCost,
      subtotal: adjustedSubtotal,
      originalBid: base.originalTotalBid,
      isExecutionMode: !isMarkupManuallyAdjustedInline,
      totalOverhead: adjustedTotalOverhead
    };
    
    return result;
  }, [adj, base]);

  // Visual bar chart data
  const chartBars = useMemo(() => {
    return [
      { label: "Labor", value: adj.laborPct, base: base.labor },
      { label: "Materials", value: adj.materialPct, base: base.materials },
      { label: "Overhead", value: adj.overheadPct, base: base.overhead },
      { label: "Markup", value: adj.markupPct, base: base.markupPct },
    ].map((b) => ({
      ...b,
      height: Math.min(100, Math.max(10, Math.abs(b.value) * 5)), // visual scaling
      positive: b.value >= 0,
      color: b.value >= 0 ? palette.accent : palette.orange,
    }));
  }, [adj, base]);

  // AI Insight/Tip
  const aiTip = useMemo(() => {
    // Calculate ORIGINAL NET profit from base costs (no adjustments) with original markup
    // This is the baseline before any adjustments (preset or bid)
    // Net profit = gross profit - total overhead (same calculation as step 6)
    // Use base.profit directly (which comes from calc.profit) to match step 6 exactly
    const originalNetProfit = base.profit - base.totalOverhead;
    
    // Calculate net profit delta - total change from original to final
    // This includes BOTH preset cost adjustments AND bid markup adjustments
    const profitDelta = sim.netProfit - originalNetProfit;
    
    // Calculate bid change (for bid adjustment scenarios)
    const bidDelta = sim.totalBid - base.originalTotalBid;
    
    // Use margin on revenue for customer-facing risk labels
    let suggestion, color;
    if (sim.netProfitMarginPct < 5) {
      suggestion = "❌ At risk — one issue could erase profit.";
      color = palette.red;
    } else if (sim.netProfitMarginPct < 8) {
      suggestion = "⚠️ Thin margin — minor overruns reduce profit.";
      color = palette.yellow;
    } else if (sim.netProfitMarginPct < 15) {
      suggestion = "✅ Healthy margin — absorbs moderate cost overruns.";
      color = palette.green;
    } else {
      suggestion = "✅ Strong margin — well-protected against overruns.";
      color = palette.green;
    }
    
    return {
      text: suggestion,
      profitDelta: profitDelta, // Keep decimal precision
      originalProfit: originalNetProfit, // Keep decimal precision
      bidDelta: bidDelta, // Bid change
      originalBid: base.originalTotalBid, // Original bid
      color: color,
      isExecutionMode: sim.isExecutionMode,
    };
  }, [sim, base]);

  // Calculate AI suggested markup ONCE when AI data first loads
  useEffect(() => {
    if (!aiData || aiSuggestedValue !== null) return;
    
    const competitiveness = aiData.marketData.analysis.competitivenessScore;
    
    // Get project-specific markup benchmarks
    const getProjectMarkupBenchmarks = (projectType) => {
      switch(projectType) {
        case 'kitchen_remodel': return { min: 15, max: 25, optimal: 20 }; // Kitchen: 15-25% range
        case 'bathroom_remodel': return { min: 12, max: 22, optimal: 17 }; // Bathroom: 12-22% range  
        case 'room_addition':
        case 'home_addition': return { min: 10, max: 18, optimal: 15 }; // Major remodel: 10-18% range
        case 'new_build': return { min: 8, max: 15, optimal: 12 }; // New build: 8-15% range
        default: return { min: 12, max: 20, optimal: 16 }; // General: 12-20% range
      }
    };
    
    const projectType = bid?.projectType || 'kitchen_remodel';
    const benchmarks = getProjectMarkupBenchmarks(projectType);
    const baselineMarkup = benchmarks.optimal; // Use optimal for this project type
    
    const materialsCost = base.materials;
    const inflationBuffer = Math.round(materialsCost * 0.042); // 4.2% inflation
    const baselineMarkupBuffer = Math.round((materialsCost * baselineMarkup) / 100);
    const needsInflationProtection = baselineMarkupBuffer < inflationBuffer;
    
    let suggestedMarkup = baselineMarkup;
    let reasoning = `Optimal markup for ${projectType.replace('_', ' ')} projects`;
    
    // Factor in inflation protection
    if (needsInflationProtection) {
      const inflationMarkup = Math.ceil((inflationBuffer / materialsCost) * 100);
      suggestedMarkup = Math.max(suggestedMarkup, inflationMarkup);
      reasoning = `Materials inflation protection required for ${projectType.replace('_', ' ')}`;
    }
    
    // Then apply market-based adjustments
    if (competitiveness === 'aggressive') {
      suggestedMarkup = Math.max(suggestedMarkup - 2, benchmarks.min);
      reasoning = needsInflationProtection ? 
        `Competitive market + inflation protection needed for ${projectType.replace('_', ' ')}` :
        `Competitive market detected - lowering markup for ${projectType.replace('_', ' ')}`;
    } else if (competitiveness === 'premium') {
      suggestedMarkup = Math.min(suggestedMarkup + 3, benchmarks.max);
      reasoning = needsInflationProtection ?
        `Premium market + inflation protection for ${projectType.replace('_', ' ')}` :
        `Premium market detected - increasing markup for ${projectType.replace('_', ' ')}`;
    } else {
      if (needsInflationProtection) {
        suggestedMarkup = Math.max(suggestedMarkup, 18);
        reasoning = "Balanced market with inflation protection";
      } else if (baselineMarkup < 15) {
        suggestedMarkup = 18;
        reasoning = "Optimal markup for balanced market conditions";
      } else {
        suggestedMarkup = baselineMarkup;
        reasoning = "Current markup is optimal for market conditions";
      }
    }
    
    const inflationMarkup = Math.ceil((inflationBuffer / materialsCost) * 100);
    setAiSuggestedValue({
      suggested: suggestedMarkup,
      reasoning: reasoning,
      inflationProtected: suggestedMarkup >= inflationMarkup
    });
  }, [aiData, base.materials, aiSuggestedValue]);

  // AI Suggested Markup - uses the stored suggestion and calculates current change
  const aiSuggestedMarkup = useMemo(() => {
    if (!aiSuggestedValue) return null;
    
    const currentMarkup = Number(bid?.markupPct || 15);
    
    return {
      suggested: aiSuggestedValue.suggested,
      current: currentMarkup,
      change: aiSuggestedValue.suggested - currentMarkup,
      reasoning: aiSuggestedValue.reasoning,
      isApplied: aiMarkupApplied,
      inflationProtected: aiSuggestedValue.inflationProtected
    };
  }, [aiSuggestedValue, bid?.markupPct, aiMarkupApplied]);

  // Reset adjustments - clear all scenario adjustments (lets user apply only Bid Adjustment if desired)
  const resetScenario = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAdj({
      laborPct: 0,
      materialPct: 0,
      markupPct: 0,
      overheadPct: 0,
    });
  };
  
  // Check if any adjustments are active
  const hasChanges = useMemo(() => {
    return adj.laborPct !== 0 || adj.materialPct !== 0 || adj.markupPct !== 0 || adj.overheadPct !== 0;
  }, [adj]);
  
  // Preset definitions
  const presets = {
    typical: { 
      name: 'Typical Friction',
      laborPct: 5, 
      materialPct: 3, 
      markupPct: 0, 
      overheadPct: 2 
    },
    bad: { 
      name: 'Bad Remodel',
      laborPct: 15, 
      materialPct: 10, 
      markupPct: 0, 
      overheadPct: 5 
    },
    smooth: { 
      name: 'Smooth Job',
      laborPct: -5, 
      materialPct: -3, 
      markupPct: 0, 
      overheadPct: -2 
    },
  };
  
  // Check which preset is active
  // Note: markupPct is ignored in preset detection - presets can have bid adjustments applied
  const getActivePreset = useMemo(() => {
    if (adj.laborPct === presets.typical.laborPct && 
        adj.materialPct === presets.typical.materialPct && 
        adj.overheadPct === presets.typical.overheadPct) {
      return 'typical';
    }
    if (adj.laborPct === presets.bad.laborPct && 
        adj.materialPct === presets.bad.materialPct && 
        adj.overheadPct === presets.bad.overheadPct) {
      return 'bad';
    }
    if (adj.laborPct === presets.smooth.laborPct && 
        adj.materialPct === presets.smooth.materialPct && 
        adj.overheadPct === presets.smooth.overheadPct) {
      return 'smooth';
    }
    return null;
  }, [adj]);
  
  // Check if bid adjustment is active (non-zero)
  const isMarkupManuallyAdjusted = useMemo(() => adj.markupPct !== 0, [adj.markupPct]);
  
  // Get preset details for display
  const getPresetDetails = useMemo(() => {
    if (!getActivePreset) return null;
    
    const preset = presets[getActivePreset];
    const parts = [];
    
    if (preset.laborPct !== 0) {
      parts.push(`Labor ${preset.laborPct > 0 ? '+' : ''}${preset.laborPct}%`);
    }
    if (preset.materialPct !== 0) {
      parts.push(`Materials ${preset.materialPct > 0 ? '+' : ''}${preset.materialPct}%`);
    }
    if (preset.overheadPct !== 0) {
      parts.push(`Overhead ${preset.overheadPct > 0 ? '+' : ''}${preset.overheadPct}%`);
    }
    // Markup removed from presets - it doesn't affect preset calculations
    
    // AI explanations for each scenario
    const aiExplanations = {
      typical: "Most projects experience small inefficiencies — minor rework, material overages, and admin drag. These don't break the job, but they quietly reduce margin if not planned for.",
      bad: "Remodels often uncover hidden conditions and scope creep. Labor inefficiencies and rework compound quickly, which is why margins collapse on poorly scoped renovations.",
      smooth: "Tight scope, experienced crews, and clean sequencing reduce waste and downtime. These gains protect margin — but require strong planning and execution."
    };
    
    return {
      name: preset.name,
      details: parts.join(' • '),
      aiExplanation: aiExplanations[getActivePreset]
    };
  }, [getActivePreset]);
  
  // Animate when values change
  const prevTotalBidRef = useRef(0);
  const prevMarginRef = useRef(0);
  
  useEffect(() => {
    if (sim.totalBid > 0 && prevTotalBidRef.current !== sim.totalBid) {
      Animated.sequence([
        Animated.timing(totalBidAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(totalBidAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      prevTotalBidRef.current = sim.totalBid;
    }
  }, [sim.totalBid]);
  
  useEffect(() => {
    // Animate based on margin on revenue (not markup-style return on cost)
    if (sim.netProfitMarginPct && prevMarginRef.current !== sim.netProfitMarginPct) {
      const targetValue = sim.netProfitMarginPct < 5 ? 0 : sim.netProfitMarginPct < 8 ? 0.5 : sim.netProfitMarginPct < 15 ? 0.75 : 1;
      Animated.timing(profitMarginColorAnim, {
        toValue: targetValue,
        duration: 200,
        useNativeDriver: false,
      }).start();
      prevMarginRef.current = sim.netProfitMarginPct;
    }
  }, [sim.netProfitMarginPct]);

  // Adjustment quick buttons
  const QuickAdjust = ({ label, field, delta }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAdj((p) => ({ ...p, [field]: p[field] + delta }));
      }}
      style={styles.chip}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );

  // Tab switching with haptic feedback
  const switchTab = (tabName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tabName);
  };

  return (
    <View style={styles.container}>
      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: darkMode ? palette.text : '#000000' }]}>
                🎯 Project Outcome Scenarios
              </Text>
              {hasChanges && (
                <TouchableOpacity onPress={resetScenario} style={styles.resetBtn}>
                  <Text style={styles.resetText}>Clear scenario</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.cardSubtitle, { color: darkMode ? palette.textDim : '#475569' }]}>
              Adjust variables to see impacts on total bid, net profit, and margin on revenue.
            </Text>

            {/* Preset Scenarios */}
            <Text style={[styles.sectionLabel, { marginBottom: 8, fontSize: 12, textAlign: 'center', color: '#38d39f' }]}>
              Click to see potential impacts on profit
            </Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const preset = presets.typical;
                  setAdj(preset);
                }}
                style={[
                  styles.presetChip,
                  getActivePreset === 'typical' && styles.presetChipActive
                ]}
              >
                <Text style={[
                  styles.presetChipText,
                  getActivePreset === 'typical' && styles.presetChipTextActive
                ]}>
                  Typical Friction
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const preset = presets.bad;
                  setAdj(preset);
                }}
                style={[
                  styles.presetChip,
                  getActivePreset === 'bad' && styles.presetChipActive
                ]}
              >
                <Text style={[
                  styles.presetChipText,
                  getActivePreset === 'bad' && styles.presetChipTextActive
                ]}>
                  Bad Remodel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const preset = presets.smooth;
                  setAdj(preset);
                }}
                style={[
                  styles.presetChip,
                  getActivePreset === 'smooth' && styles.presetChipActive
                ]}
              >
                <Text style={[
                  styles.presetChipText,
                  getActivePreset === 'smooth' && styles.presetChipTextActive
                ]}>
                  Smooth Job
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Preset Applied Indicator */}
            {getPresetDetails && (
              <View>
                <View style={styles.presetAppliedIndicator}>
                  <Text style={styles.presetAppliedText}>
                    <Text style={{ fontWeight: '700' }}>{getPresetDetails.name} applied:</Text> {getPresetDetails.details}
                  </Text>
                </View>
                {getPresetDetails.name === 'Typical Friction' && (
                  <Text style={styles.presetDefaultNote}>
                    Typical Friction selected — reflects most real-world jobs
                  </Text>
                )}
                {/* AI Explanation */}
                <View style={styles.aiExplanationCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <MaterialIcons name="psychology" size={16} color={palette.accent} style={{ marginRight: 6 }} />
                    <Text style={styles.aiExplanationLabel}>AI Project Manager Insight</Text>
                  </View>
                  <Text style={styles.aiExplanationText}>
                    {getPresetDetails.aiExplanation}
                  </Text>
                </View>
              </View>
            )}

            {/* Cost Risk Section */}
            <Text style={styles.sectionLabel}>Cost Risk</Text>
            <View style={styles.chipRow}>
              <QuickAdjust label="↑ Labor +10%" field="laborPct" delta={10} />
              <QuickAdjust label="↓ Labor -10%" field="laborPct" delta={-10} />
              <QuickAdjust label="↑ Materials +5%" field="materialPct" delta={5} />
              <QuickAdjust label="↓ Materials -5%" field="materialPct" delta={-5} />
            </View>

            {/* Business Drag Section */}
            <Text style={styles.sectionLabel}>Business Drag</Text>
            <View style={styles.chipRow}>
              <QuickAdjust label="↑ Overhead +10%" field="overheadPct" delta={10} />
              <QuickAdjust label="↓ Overhead -10%" field="overheadPct" delta={-10} />
            </View>

            {/* Pricing Strategy Section */}
            <Text style={styles.sectionLabel}>Bid Adjustment</Text>
            <Text style={[styles.sectionLabel, { fontSize: 11, marginTop: 0, marginBottom: 4, opacity: palette.mutedOpacity, fontWeight: '400' }]}>
              What if you had charged more/less?
            </Text>
            {isMarkupManuallyAdjusted && (
              <View style={{ backgroundColor: 'rgba(56, 211, 159, 0.1)', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(56, 211, 159, 0.3)' }}>
                <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>
                  ⚡ Bid Adjustment Active: Bid will recalculate
                </Text>
              </View>
            )}
            <View style={styles.chipRow}>
              <QuickAdjust label="+2% Bid" field="markupPct" delta={2} />
              <QuickAdjust label="-2% Bid" field="markupPct" delta={-2} />
            </View>

            {/* Live Deltas */}
            <View style={styles.deltaRow}>
              {[
                { label: "Labor", value: adj.laborPct, color: adj.laborPct > 0 ? palette.orange : adj.laborPct < 0 ? palette.green : palette.textDim },
                { label: "Materials", value: adj.materialPct, color: adj.materialPct > 0 ? palette.yellow : adj.materialPct < 0 ? palette.green : palette.textDim },
                { label: "Overhead", value: adj.overheadPct, color: adj.overheadPct > 0 ? palette.orange : adj.overheadPct < 0 ? palette.green : palette.textDim },
                { label: "Bid", value: adj.markupPct, color: adj.markupPct > 0 ? palette.accent : adj.markupPct < 0 ? palette.red : palette.textDim },
              ].map((item) => (
                <View key={item.label} style={styles.deltaItem}>
                  <Text style={styles.deltaLabel}>{item.label}</Text>
                  <Text style={[styles.deltaValue, { color: item.color }]}>
                    {item.value > 0 ? '+' : ''}{item.value}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Simulation Summary */}
            <View style={styles.simSummary}>
              <View style={styles.simRow}>
                <Text style={[styles.simLabel, { opacity: palette.subtleOpacity }]}>Labor:</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.simValue, { opacity: palette.subtleOpacity }]}>${sim.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.laborPct !== 0) && (
                    <Text style={[styles.simLabel, { fontSize: 11, marginTop: 2, opacity: palette.faintOpacity, color: adj.laborPct > 0 ? palette.orange : palette.green }]}>
                      {adj.laborPct > 0 ? '+' : ''}${(base.labor * (adj.laborPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.simRow}>
                <Text style={[styles.simLabel, { opacity: palette.subtleOpacity }]}>Materials:</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.simValue, { opacity: palette.subtleOpacity }]}>${sim.materials.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.materialPct !== 0) && (
                    <Text style={[styles.simLabel, { fontSize: 11, marginTop: 2, opacity: palette.faintOpacity, color: adj.materialPct > 0 ? palette.yellow : palette.green }]}>
                      {adj.materialPct > 0 ? '+' : ''}${(base.materials * (adj.materialPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.simRow}>
                <Text style={[styles.simLabel, { opacity: palette.subtleOpacity }]}>Overhead:</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.simValue, { opacity: palette.subtleOpacity }]}>${sim.overhead.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.overheadPct !== 0) && (
                    <Text style={[styles.simLabel, { fontSize: 11, marginTop: 2, opacity: palette.faintOpacity, color: adj.overheadPct > 0 ? palette.orange : palette.green }]}>
                      {adj.overheadPct > 0 ? '+' : ''}${(base.overhead * (adj.overheadPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              {Math.abs(aiTip.bidDelta) > 0.01 && (
                <View style={styles.simRow}>
                  <Text style={[styles.simLabel, { opacity: palette.subtleOpacity }]}>Total Bid Change:</Text>
                  <Text style={[styles.simValue, { opacity: palette.subtleOpacity, color: aiTip.bidDelta >= 0 ? palette.green : palette.red }]}>
                    {aiTip.bidDelta >= 0 ? '+' : ''}${aiTip.bidDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
              <View style={[styles.simRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.simLabelBold}>
                    {sim.isExecutionMode ? 'Original Bid:' : 'Total Bid (Adjusted):'}
                  </Text>
                  {!sim.isExecutionMode && (
                    <View>
                      <Text style={[styles.simLabel, { fontSize: 11, marginTop: 2, opacity: palette.subtleOpacity }]}>
                        Original: ${sim.originalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={[styles.simLabel, { fontSize: 11, marginTop: 2, opacity: palette.subtleOpacity, color: palette.accent }]}>
                        Change: {sim.totalBid > sim.originalBid ? '+' : ''}${(sim.totalBid - sim.originalBid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )}
                </View>
                <Animated.Text 
                  style={[
                    styles.simValueBoldLarge,
                    {
                      color: !sim.isExecutionMode ? palette.accent : palette.text,
                      transform: [{
                        scale: totalBidAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.05]
                        })
                      }]
                    }
                  ]}
                >
                  ${sim.totalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Animated.Text>
              </View>
              <View style={styles.simRow}>
                <Text style={[styles.simLabel, { opacity: palette.mutedOpacity }]}>Estimated Net Profit:</Text>
                <Text style={[styles.simValue, { 
                  color: sim.netProfit >= 0 ? palette.green : palette.red,
                  fontWeight: '700'
                }]}>
                  ${sim.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.simRow}>
                <Text style={styles.simLabelBold}>Net Profit Margin (Revenue):</Text>
                <Animated.Text 
                  style={[
                    styles.simValueBold, 
                    { 
                      fontWeight: '800',
                      color: profitMarginColorAnim.interpolate({
                        inputRange: [0, 0.5, 0.75, 1],
                        outputRange: [palette.red, palette.yellow, palette.green, palette.green]
                      })
                    }
                  ]}
                >
                  {sim.netProfitMarginPct.toFixed(1)}%
                </Animated.Text>
              </View>
              {/* Break-Even Line */}
              {sim.netProfitOnCostPct > 0 && (
                <View style={styles.breakEvenRow}>
                  <Text style={styles.breakEvenText}>
                    Break-even if costs rise ~{sim.netProfitOnCostPct.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>

          {/* AI Insight */}
          <View style={styles.aiTipCard}>
            <Text style={[styles.aiTipText, { color: aiTip.color || palette.text }]}>{aiTip.text}</Text>
            {(aiTip.profitDelta !== 0 || Math.abs(sim.netProfit - aiTip.originalProfit) > 0.01) && (
              <View style={styles.aiTipDeltaContainer}>
                <Text style={styles.aiTipDeltaLabel}>Estimated profit after scenario:{'\n'}</Text>
                <Text style={styles.aiTipDeltaText}>
                  Original: <Text style={{ color: aiTip.originalProfit >= 0 ? palette.green : palette.red }}>${aiTip.originalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text> • 
                  Change: <Text style={{ color: aiTip.profitDelta >= 0 ? palette.green : palette.red }}>{aiTip.profitDelta >= 0 ? '+' : '-'}${Math.abs(aiTip.profitDelta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text> • 
                  New: <Text style={{ color: sim.netProfit >= 0 ? palette.green : palette.red }}>${sim.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

      {/* More Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={{ flex: 1 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
          <StatusBar style="light" />
          
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.modalBackButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>📊 Detailed Analysis</Text>
              <View style={{ width: 40 }} />
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {aiData && (
              <View>
                {/* Labor Rate Breakdown */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>💰 Detailed Labor Rates</Text>
                  <View style={styles.detailCard}>
                    {Object.entries(aiData.laborData.data).map(([trade, rate]) => (
                      <View key={trade} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{trade.charAt(0).toUpperCase() + trade.slice(1)}</Text>
                        <Text style={styles.detailValue}>${rate}/hour</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Materials Inflation Analysis */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📈 Materials Inflation Analysis</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.inflationRow}>
                      <Text style={styles.detailLabel}>Current Materials Cost:</Text>
                      <Text style={styles.detailValue}>${(calc?.materials || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.inflationRow}>
                      <Text style={styles.detailLabel}>Projected 6-Month Inflation:</Text>
                      <Text style={[styles.detailValue, { color: palette.orange }]}>+4.2%</Text>
                    </View>
                    <View style={styles.inflationRow}>
                      <Text style={styles.detailLabel}>Inflated Materials Cost:</Text>
                      <Text style={styles.detailValue}>
                        ${Math.round((calc?.materials || 0) * 1.042).toLocaleString()}
                      </Text>
                    </View>
                    <View style={[styles.inflationRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.divider }]}>
                      <Text style={styles.detailLabel}>Inflation Buffer Needed:</Text>
                      <Text style={[styles.detailValue, { color: palette.accent }]}>
                        +${Math.round((calc?.materials || 0) * 0.042).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bid Accommodation Analysis */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>🛡️ Bid Inflation Protection</Text>
                  <View style={styles.detailCard}>
                    {(() => {
                      const currentMaterials = calc?.materials || 0;
                      const inflationBuffer = Math.round(currentMaterials * 0.042);
                      const currentMarkup = bid?.markupPct || 15;
                      const markupBuffer = Math.round((currentMaterials * currentMarkup) / 100);
                      const isProtected = markupBuffer >= inflationBuffer;
                      
                      return (
                        <>
                          <View style={styles.inflationRow}>
                            <Text style={styles.detailLabel}>Current Markup Buffer:</Text>
                            <Text style={[styles.detailValue, { color: isProtected ? palette.green : palette.red }]}>
                              ${markupBuffer.toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.inflationRow}>
                            <Text style={styles.detailLabel}>Inflation Risk:</Text>
                            <Text style={[styles.detailValue, { color: isProtected ? palette.green : palette.red }]}>
                              {isProtected ? '✅ Protected' : '⚠️ At Risk'}
                            </Text>
                          </View>
                          {!isProtected && (
                            <View style={styles.warningCard}>
                              <Text style={styles.warningText}>
                                ⚠️ Your current {currentMarkup}% markup may not cover projected materials inflation. 
                                Consider increasing markup by {Math.ceil((inflationBuffer - markupBuffer) / (currentMaterials / 100))}% 
                                to maintain profitability.
                              </Text>
                            </View>
                          )}
                          {isProtected && (
                            <View style={styles.successCard}>
                              <Text style={styles.successText}>
                                ✅ Your {currentMarkup}% markup provides adequate buffer for projected materials inflation.
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>
                </View>

                {/* AI Recommendation Details */}
                {aiSuggestedMarkup && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>🤖 AI Recommendation Details</Text>
                    <View style={styles.detailCard}>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Current Markup:</Text> {aiSuggestedMarkup.current}%
                      </Text>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Suggested Markup:</Text> {aiSuggestedMarkup.suggested}%
                      </Text>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Change:</Text> {aiSuggestedMarkup.change > 0 ? '+' : ''}{aiSuggestedMarkup.change}%
                      </Text>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Reasoning:</Text> {aiSuggestedMarkup.reasoning}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Market Insights */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📈 Market Insights</Text>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailText}>
                      Based on the current market analysis, your area shows {aiData.marketData.analysis.competitivenessScore} competition levels with a {aiData.marketData.analysis.marketTrend} trend.
                    </Text>
                    <Text style={styles.detailText}>
                      The regional multiplier of {aiData.marketData.analysis.regionalMultiplier}x indicates how your local rates compare to national averages.
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[
                      styles.modalPrimaryBtn,
                      aiSuggestedMarkup?.isApplied && styles.modalAppliedBtn
                    ]}
                    onPress={() => {
                      if (aiSuggestedMarkup && onMarkupChange) {
                        if (aiSuggestedMarkup.isApplied) {
                          // Undo AI markup - restore original
                          onMarkupChange(originalMarkup);
                          setAiMarkupApplied(false);
                        } else {
                          // Apply AI markup
                          onMarkupChange(aiSuggestedMarkup.suggested);
                          setAiMarkupApplied(true);
                        }
                        setShowDetailsModal(false);
                      }
                    }}
                  >
                    <Text style={[
                      styles.modalPrimaryBtnText,
                      aiSuggestedMarkup?.isApplied && styles.modalAppliedBtnText
                    ]}>
                      {aiSuggestedMarkup?.isApplied ? 
                        `Undo AI Suggestion (${originalMarkup}%)` :
                        'Apply AI Suggestion'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Labor Rate Details Modal */}
      <Modal
        visible={showLaborModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLaborModal(false)}
      >
        <View style={styles.laborModalOverlay}>
          <View style={styles.laborModalContent}>
            <View style={styles.laborModalHeader}>
              <Text style={styles.laborModalTitle}>
                {selectedLabor ? selectedLabor.trade.charAt(0).toUpperCase() + selectedLabor.trade.slice(1) : ''}
              </Text>
              <TouchableOpacity 
                style={styles.laborModalCloseButton}
                onPress={() => setShowLaborModal(false)}
              >
                <MaterialIcons name="close" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.laborModalBody}>
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Trade Type:</Text>
                <Text style={styles.laborModalValue}>
                  {selectedLabor ? selectedLabor.trade.charAt(0).toUpperCase() + selectedLabor.trade.slice(1) : ''}
                </Text>
              </View>
              
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Hourly Rate:</Text>
                <Text style={[styles.laborModalValue, { color: palette.accent, fontSize: 20, fontWeight: '800' }]}>
                  ${selectedLabor ? selectedLabor.rate : 0}/hour
                </Text>
              </View>
              
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Daily Rate (8hrs):</Text>
                <Text style={[styles.laborModalValue, { color: palette.text, fontSize: 16, fontWeight: '700' }]}>
                  ${selectedLabor ? (selectedLabor.rate * 8).toLocaleString() : 0}/day
                </Text>
              </View>
              
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Weekly Rate (40hrs):</Text>
                <Text style={[styles.laborModalValue, { color: palette.text, fontSize: 16, fontWeight: '700' }]}>
                  ${selectedLabor ? (selectedLabor.rate * 40).toLocaleString() : 0}/week
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (palette) => StyleSheet.create({
  container: {
    gap: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: palette.accent,
  },
  tabText: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeTabText: {
    color: palette.buttonText,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    flexShrink: 1,
  },
  cardSubtitle: {
    color: palette.textDim,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
    fontSize: 14,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.chip,
    flexShrink: 0,
    marginLeft: 8,
  },
  resetText: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 13,
  },

  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: palette.chip,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  presetChipActive: {
    backgroundColor: 'rgba(56, 211, 159, 0.1)',
    borderWidth: 2,
    borderColor: '#38d39f',
  },
  presetChipText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  presetChipTextActive: {
    color: '#38d39f',
    fontWeight: '700',
    textAlign: 'center',
  },
  presetAppliedIndicator: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(56, 211, 159, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 211, 159, 0.2)',
  },
  presetAppliedText: {
    color: palette.text,
    fontSize: 12,
    lineHeight: 16,
  },
  presetDefaultNote: {
    color: palette.textDim,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  aiExplanationCard: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    backgroundColor: palette.chip,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.divider,
  },
  aiExplanationLabel: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiExplanationText: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  legalDisclaimer: {
    color: palette.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    opacity: palette.subtleOpacity,
    fontStyle: 'italic',
  },
  sectionLabel: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  chip: {
    backgroundColor: palette.chip,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.divider,
  },
  chipText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 13,
  },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 20,
    marginBottom: 16,
    height: 120,
    paddingHorizontal: 8,
  },
  barWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  bar: {
    width: '100%',
    maxWidth: 40,
    borderRadius: 6,
    minHeight: 10,
  },
  barLabel: {
    color: palette.textDim,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  barValue: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },

  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 12,
  },
  deltaItem: {
    alignItems: 'center',
    flex: 1,
  },
  deltaLabel: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  deltaValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  simSummary: {
    backgroundColor: palette.chip,
    borderWidth: 2,
    borderColor: palette.divider,
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simLabel: {
    color: palette.textDim,
    fontSize: 14,
  },
  simValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  simLabelBold: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  simValueBold: {
    color: palette.accent,
    fontSize: 17,
    fontWeight: '800',
  },
  simValueBoldLarge: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
  },
  breakEvenRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  breakEvenText: {
    color: palette.textDim,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  columns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  versionCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.divider,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  versionTitle: {
    color: palette.accent,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  versionLabel: {
    color: palette.textDim,
    fontSize: 13,
  },
  versionValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  versionNotes: {
    color: palette.textDim,
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },

  exportRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportBtnText: {
    color: palette.accent,
    fontWeight: '800',
    fontSize: 15,
  },

  aiTipCard: {
    marginTop: 4,
    backgroundColor: palette.chip,
    borderWidth: 2,
    borderColor: palette.divider,
    borderRadius: 14,
    padding: 14,
  },
  aiTipText: {
    color: palette.text,
    lineHeight: 20,
    fontSize: 14,
  },
  aiTipDeltaContainer: {
    marginTop: 6,
  },
  aiTipDeltaLabel: {
    color: palette.textDim,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiTipDeltaText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
  },
  aiTipDelta: {
    color: palette.accent,
    fontWeight: '700',
    marginTop: 6,
    fontSize: 15,
  },

  // Loading and Error States
  loadingCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingText: {
    color: palette.textDim,
    marginTop: 12,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.red,
    alignItems: 'center',
  },
  errorText: {
    color: palette.red,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSubtext: {
    color: palette.textDim,
    fontSize: 12,
    marginTop: 4,
  },

  // Market Analysis Styles
  marketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  marketItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.divider,
    justifyContent: 'center',
  },
  marketLabel: {
    color: palette.textDim,
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'center',
  },
  marketValue: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    flexWrap: 'wrap',
    numberOfLines: 2,
  },

  // Labor Rates Styles
  laborGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  laborItem: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.divider,
    minHeight: 55,
  },
  laborLabel: {
    color: palette.textDim,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
    numberOfLines: 1,
    adjustsFontSizeToFit: false,
  },
  laborValue: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 0,
  },

  // AI Recommendations
  recommendationCard: {
    backgroundColor: 'rgba(56,211,159,0.08)',
    borderWidth: 1,
    borderColor: palette.accentDim,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  recommendationText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  detailedRecommendations: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.divider,
  },
  recommendationSectionTitle: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationLabel: {
    color: palette.textDim,
    fontSize: 13,
  },
  recommendationValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: palette.accent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: palette.buttonText,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  secondaryBtnText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledBtn: {
    backgroundColor: palette.chip,
    opacity: 0.6,
  },
  disabledBtnText: {
    color: palette.textDim,
  },
  appliedBtn: {
    backgroundColor: palette.green,
    borderWidth: 2,
    borderColor: palette.green,
  },
  appliedBtnText: {
    color: palette.accentText,
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 80,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 226, 174, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 226, 174, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalContent: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    color: palette.accent,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '700',
    color: palette.accent,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 4,
  },
  detailValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    padding: 16,
    paddingBottom: 40,
  },
  modalPrimaryBtn: {
    backgroundColor: palette.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  modalPrimaryBtnText: {
    color: palette.buttonText,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalAppliedBtn: {
    backgroundColor: palette.green,
  },
  modalAppliedBtnText: {
    color: palette.accentText,
  },

  // Inflation Analysis Styles
  inflationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: palette.red,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  warningText: {
    color: palette.red,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: palette.green,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  successText: {
    color: palette.green,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  // Labor Modal Styles
  laborModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  laborModalContent: {
    backgroundColor: '#000000',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  laborModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  laborModalTitle: {
    color: palette.accent,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  laborModalCloseButton: {
    padding: 4,
  },
  laborModalBody: {
    padding: 20,
  },
  laborModalInfo: {
    marginBottom: 16,
  },
  laborModalLabel: {
    color: palette.textDim,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  laborModalValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
});


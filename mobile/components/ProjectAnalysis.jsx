import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_CARD_GAP,
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_CHIP_GREEN_BG,
  ESTIMATE_FLOW_GREEN,
  ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
  confirmScopeSectionLabelStyle,
  estimateFlowCardStyle,
  estimateFlowDividerColor,
} from '@/utils/estimateFlowCardStyle';

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
  accent: ESTIMATE_FLOW_GREEN,
  accentDim: ESTIMATE_FLOW_CHIP_GREEN_BG,
  button: ESTIMATE_FLOW_GREEN,
  buttonText: '#071018',
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
    text: darkMode ? '#FFFFFF' : themeColors.text,
    textDim: darkMode ? 'rgba(248, 250, 252, 0.88)' : themeColors.sub,
    card: darkMode ? AI_FLOW_CARD_BG_DARK : themeColors.bg,
    cardDark: darkMode ? AI_FLOW_CARD_BG_DARK : themeColors.bg,
    chip: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : (themeColors.surface2 || themeColors.bg),
    divider: darkMode ? estimateFlowDividerColor(true) : themeColors.line,
    accentText: darkMode ? '#FFFFFF' : themeColors.text,
    mutedOpacity: darkMode ? 1 : 0.7,
    subtleOpacity: darkMode ? 1 : 0.6,
    faintOpacity: darkMode ? 1 : 0.5,
    stepperBtnBg: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
  }), [darkMode, themeColors]);
  const estimateWebType = Platform.OS === 'web';
  const ew = (phone, web) => (estimateWebType ? web : phone);
  const styles = useMemo(() => getStyles(palette, ew, darkMode), [palette, ew, darkMode]);

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
  // Default to Typical Friction preset when Step 6 loads (must match presets.typical below)
  const [adj, setAdj] = useState(() => ({
    laborPct: 4,
    materialPct: 2,
    markupPct: 0,
    overheadPct: 1,
    timelinePct: 0, // Typical = inefficiencies without schedule slip
  }));
  
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
    return {
      labor: Number(calc?.labor || 0),
      materials: Number(calc?.materials || 0),
      companyOverhead: Number(calc?.companyOverhead || 0),
      projectCosts: Number(calc?.totalProjectCosts || 0),
      contingency: Number(calc?.contingency || 0),
      markupPct: Number(bid?.markupPct || 25), // Use actual markup from bid (default 25 to match step 6)
      originalTotalBid: Number(calc?.grandTotal || calc?.total || 0), // Original contract price
      subtotal: Number(calc?.subtotal || 0), // Cost before markup from Step 5
      profit: Number(calc?.profit || 0), // Gross profit from calc
    };
  }, [calc, bid]);

  // Simulated/adjusted values
  // Timeline: extended job = more labor hours + more company overhead; early finish = less
  const sim = useMemo(() => {
    const timelineFactor = 1 + (adj.timelinePct || 0) / 100;
    const labor = base.labor * (1 + adj.laborPct / 100) * timelineFactor;
    const materials = base.materials * (1 + adj.materialPct / 100);
    const companyOverhead = base.companyOverhead * (1 + adj.overheadPct / 100) * timelineFactor;
    const directCost = labor + materials;
    const adjustedSubtotal = directCost + base.projectCosts;
    const breakEvenBid = adjustedSubtotal + companyOverhead;
    
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
      const hasCostAdjustments = adj.laborPct !== 0 || adj.materialPct !== 0 || adj.overheadPct !== 0 || (adj.timelinePct || 0) !== 0;
      
      if (hasCostAdjustments) {
        // When costs change: gross profit = bid - active project cost subtotal
        profit = totalBid - adjustedSubtotal;
      } else {
        // When no adjustments: Use markup method to match step 6 exactly
        // This ensures profit matches base.profit when no adjustments are active
        profit = (adjustedSubtotal * base.markupPct) / 100;
      }
      
      marginPct = totalBid > 0 ? (profit / totalBid) * 100 : 0;
    }
    
    // When only bid adjustment is active (no cost adjustments), profit change should equal bid change
    let netProfit;
    if (isMarkupManuallyAdjustedInline && adj.laborPct === 0 && adj.materialPct === 0 && adj.overheadPct === 0 && (adj.timelinePct || 0) === 0) {
      // Pure bid adjustment: net profit change = bid change exactly
      // This ensures profitDelta matches bidDelta when only bid is adjusted
      const originalNetProfit = base.profit - base.companyOverhead;
      const bidDelta = totalBid - base.originalTotalBid;
      netProfit = originalNetProfit + bidDelta;
    } else {
      // Normal calculation: profit - overhead
      netProfit = profit - companyOverhead;
    }
    
    // Keep both metrics explicit:
    // - On-cost return: net profit / total cost
    // - Margin on revenue: net profit / total bid
    const netProfitOnCostPct = adjustedSubtotal > 0 ? (netProfit / adjustedSubtotal) * 100 : 0;
    const netProfitMarginPct = totalBid > 0 ? (netProfit / totalBid) * 100 : 0;
    
    const result = { 
      labor, 
      materials, 
      overhead: companyOverhead,
      totalBid, 
      profit, // Gross profit
      netProfit, // Net profit after overhead (matches step 6)
      marginPct, // Profit margin (profit/totalBid * 100) - keeping for backward compatibility
      netProfitOnCostPct,
      netProfitMarginPct,
      markupPct: base.markupPct + adj.markupPct, 
      directCost,
      subtotal: adjustedSubtotal,
      breakEvenBid,
      originalBid: base.originalTotalBid,
      isExecutionMode: !isMarkupManuallyAdjustedInline,
      totalOverhead: companyOverhead
    };
    
    return result;
  }, [adj, base]);

  // Visual bar chart data
  const chartBars = useMemo(() => {
    return [
      { label: "Labor", value: adj.laborPct, base: base.labor },
      { label: "Materials", value: adj.materialPct, base: base.materials },
      { label: "Overhead", value: adj.overheadPct, base: base.companyOverhead },
      { label: "Timeline", value: adj.timelinePct ?? 0, base: base.labor },
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
    const originalNetProfit = base.profit - base.companyOverhead;
    
    // Calculate net profit delta - total change from original to final
    // This includes BOTH preset cost adjustments AND bid markup adjustments
    const profitDelta = sim.netProfit - originalNetProfit;
    
    // Calculate bid change (for bid adjustment scenarios)
    const bidDelta = sim.totalBid - base.originalTotalBid;
    
    // Use margin on revenue for customer-facing risk labels
    let suggestion, color;
    if (sim.netProfitMarginPct < 5) {
      suggestion = "At risk — one issue could erase profit.";
      color = palette.red;
    } else if (sim.netProfitMarginPct < 8) {
      suggestion = "Thin margin — minor overruns reduce profit.";
      color = palette.yellow;
    } else if (sim.netProfitMarginPct < 15) {
      suggestion = "Healthy margin — absorbs moderate cost overruns.";
      color = palette.green;
    } else {
      suggestion = "Strong margin — well-protected against overruns.";
      color = palette.green;
    }
    
    const originalNetProfitPct = base.originalTotalBid > 0
      ? (originalNetProfit / base.originalTotalBid) * 100
      : 0;

    return {
      text: suggestion,
      profitDelta: profitDelta, // Keep decimal precision
      originalProfit: originalNetProfit, // Keep decimal precision
      originalNetProfitPct,
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
      timelinePct: 0,
    });
  };
  
  // Check if any adjustments are active
  const hasChanges = useMemo(() => {
    return adj.laborPct !== 0 || adj.materialPct !== 0 || adj.markupPct !== 0 || adj.overheadPct !== 0 || (adj.timelinePct || 0) !== 0;
  }, [adj]);
  
  // Preset definitions (include timeline: extended = more labor/overhead, early = less)
  // Scenario stress-test templates — not industry benchmarks. Percentages unchanged by UX copy.
  const presets = {
    typical: { 
      name: 'Typical Friction',
      laborPct: 4, 
      materialPct: 2, 
      markupPct: 0, 
      overheadPct: 1,
      timelinePct: 0, // Minor inefficiencies, job stays on schedule
    },
    bad: { 
      name: 'High Friction Job',
      laborPct: 10, 
      materialPct: 6, 
      markupPct: 0, 
      overheadPct: 3,
      timelinePct: 12, // Job runs ~12% longer (delays, scope creep)
    },
    smooth: { 
      name: 'Best-Case Execution',
      laborPct: -3, 
      materialPct: -2, 
      markupPct: 0, 
      overheadPct: -1,
      timelinePct: -5, // Job finishes ~5% early
    },
  };
  
  // Check which preset is active
  // Note: markupPct is ignored in preset detection - presets can have bid adjustments applied
  const getActivePreset = useMemo(() => {
    if (adj.laborPct === presets.typical.laborPct && 
        adj.materialPct === presets.typical.materialPct && 
        adj.overheadPct === presets.typical.overheadPct &&
        (adj.timelinePct ?? 0) === presets.typical.timelinePct) {
      return 'typical';
    }
    if (adj.laborPct === presets.bad.laborPct && 
        adj.materialPct === presets.bad.materialPct && 
        adj.overheadPct === presets.bad.overheadPct &&
        (adj.timelinePct ?? 0) === presets.bad.timelinePct) {
      return 'bad';
    }
    if (adj.laborPct === presets.smooth.laborPct && 
        adj.materialPct === presets.smooth.materialPct && 
        adj.overheadPct === presets.smooth.overheadPct &&
        (adj.timelinePct ?? 0) === presets.smooth.timelinePct) {
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
    if (preset.timelinePct !== 0) {
      parts.push(`Timeline ${preset.timelinePct > 0 ? '+' : ''}${preset.timelinePct}%`);
    }
    // Markup removed from presets - it doesn't affect preset calculations
    
    // AI explanations for each scenario (include timeline impact)
    const aiExplanations = {
      typical: "Many jobs pick up small inefficiencies — minor rework, material overages, and admin drag. This preset stress-tests that pattern: not a benchmark, just a common execution scenario.",
      bad: "High-friction work often hits hidden conditions, scope creep, and delays. Labor inefficiencies, rework, and longer timelines compound — painful, but framed as a stress template, not a prediction.",
      smooth: "Tight scope, experienced crews, and clean sequencing reduce waste and downtime. Finishing ahead of schedule cuts labor and overhead — a best-case scenario template for comparison."
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
    // Green when profitable, red when not — low margin but still in profit = green
    const targetValue = sim.netProfit >= 0 ? 1 : 0;
    if (prevMarginRef.current !== targetValue) {
      Animated.timing(profitMarginColorAnim, {
        toValue: targetValue,
        duration: 200,
        useNativeDriver: false,
      }).start();
      prevMarginRef.current = targetValue;
    }
  }, [sim.netProfit]);

  const scenarioStepperRows = [
    { label: 'Labor', field: 'laborPct', step: 5 },
    { label: 'Materials', field: 'materialPct', step: 5 },
    { label: 'Overhead', field: 'overheadPct', step: 5 },
    { label: 'Timeline', field: 'timelinePct', step: 5 },
    { label: 'Bid', field: 'markupPct', step: 2 },
  ];

  /** Stepper + summary row: cost/drag up = warm, down = green, 0 = muted; bid = contract price (not cost). */
  const fineTuneValueColor = (field, raw) => {
    const v = raw ?? 0;
    const muted = 'rgba(148, 163, 184, 0.78)';
    const costUp = 'rgba(245, 158, 11, 0.92)';
    const costDown = ESTIMATE_FLOW_CHIP_GREEN;
    if (field === 'markupPct') {
      if (v === 0) return muted;
      return v > 0 ? palette.accent : 'rgba(251, 146, 60, 0.92)';
    }
    if (v === 0) return muted;
    if (v > 0) return costUp;
    return costDown;
  };

  // Tab switching with haptic feedback
  const switchTab = (tabName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tabName);
  };

  /** Same contract price as baseline (e.g. cost-only scenario, bid adj 0%) — avoids showing duplicate bid rows. */
  const scenarioBidMatchesOriginal =
    Math.abs((sim.totalBid ?? 0) - (sim.originalBid ?? 0)) < 0.01;

  const sectionCardStyle = estimateFlowCardStyle(themeColors, darkMode, {
    marginBottom: ESTIMATE_FLOW_CARD_GAP,
  });

  return (
    <View style={styles.container}>
      {/* View (not ScrollView): parent estimate screen already scrolls; nested ScrollView caused +/− taps to jump scroll on web & native */}
      <View style={sectionCardStyle}>
            <View style={styles.cardHeader}>
              <Text style={[confirmScopeSectionLabelStyle(), { color: palette.textDim, flex: 1 }]}>
                Scenario presets
              </Text>
              {hasChanges && (
                <TouchableOpacity onPress={resetScenario} style={styles.resetBtn}>
                  <Text style={styles.resetText}>Clear scenario</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.cardSubtitle, { color: darkMode ? palette.textDim : '#475569' }]}>
              Use these presets to see how common execution scenarios may affect profit and margin. They are stress-test templates, not industry benchmarks — fine-tune below for a custom view.
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
                  getActivePreset === 'typical' && styles.presetChipActiveTypical
                ]}
              >
                <Text style={[
                  styles.presetChipText,
                  getActivePreset === 'typical' && styles.presetChipTextActiveTypical
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
                  getActivePreset === 'bad' && styles.presetChipActiveBad
                ]}
              >
                <Text style={[
                  styles.presetChipText,
                  getActivePreset === 'bad' && styles.presetChipTextActiveBad
                ]}>
                  High Friction Job
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
                  Best-Case Execution
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Preset applied / insight — keep a block mounted when sliders leave a preset so layout height
                does not collapse (avoids first fine-tune tap scroll jump on web from scroll anchoring). */}
            {(getPresetDetails || (hasChanges && !getActivePreset)) && (
              <View>
                {getPresetDetails ? (
                  <>
                    <View style={[
                      styles.presetAppliedIndicator,
                      getPresetDetails.name === 'Typical Friction' && {
                        backgroundColor: 'rgba(234, 179, 8, 0.08)',
                        borderColor: 'rgba(234, 179, 8, 0.18)',
                      },
                      getPresetDetails.name === 'High Friction Job' && {
                        backgroundColor: 'rgba(249, 115, 22, 0.12)',
                        borderColor: 'rgba(249, 115, 22, 0.25)',
                      }
                    ]}>
                      <Text style={styles.presetAppliedText}>
                        <Text style={{ fontWeight: '700' }}>{getPresetDetails.name} applied:</Text> {getPresetDetails.details}
                      </Text>
                    </View>
                    {getPresetDetails.name === 'Typical Friction' && (
                      <Text style={styles.presetDefaultNote}>
                        Typical Friction is the default preset — moderate execution drag for stress-testing (not a universal benchmark).
                      </Text>
                    )}
                    <View style={styles.aiExplanationCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <MaterialIcons name="psychology" size={16} color={palette.accent} style={{ marginRight: 6 }} />
                        <Text style={styles.aiExplanationLabel}>AI Project Manager Insight</Text>
                      </View>
                      <Text style={styles.aiExplanationText}>
                        {getPresetDetails.aiExplanation}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.presetInsightCustomMin}>
                    <View style={[
                      styles.presetAppliedIndicator,
                      {
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        borderColor: 'rgba(148, 163, 184, 0.22)',
                      },
                    ]}>
                      <Text style={styles.presetAppliedText}>
                        <Text style={{ fontWeight: '700' }}>Custom scenario:</Text>{' '}
                        Your sliders no longer match a preset template. Totals below use these exact percentages.
                      </Text>
                    </View>
                    <View style={styles.aiExplanationCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <MaterialIcons name="tune" size={16} color={palette.accent} style={{ marginRight: 6 }} />
                        <Text style={styles.aiExplanationLabel}>Fine-tune active</Text>
                      </View>
                      <Text style={styles.aiExplanationText}>
                        Many jobs diverge from any template once you adjust labor, materials, overhead, timeline, or bid. Tap a scenario preset to jump back to a named stress-test, or keep refining here.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

      </View>

      <View style={sectionCardStyle}>
            <Text style={styles.fineTuneSectionTitle}>Fine-tune scenario</Text>
            <Text style={styles.fineTuneHint}>
              Use the controls below to fine-tune the scenario. Most changes move in 5% steps; bid moves in 2% steps.
            </Text>
            {isMarkupManuallyAdjusted && (
              <View style={styles.bidActiveBanner}>
                <Text style={styles.bidActiveBannerText}>
                  Bid fine-tune active — total price recalculates
                </Text>
              </View>
            )}
            <View style={styles.fineTuneCard}>
              {scenarioStepperRows.map((row, i) => {
                const v = adj[row.field] ?? 0;
                const display = `${v > 0 ? '+' : ''}${v}%`;
                const isLast = i === scenarioStepperRows.length - 1;
                const valueColor = fineTuneValueColor(row.field, v);
                return (
                  <View
                    key={row.field}
                    style={[styles.stepperRow, isLast && styles.stepperRowLast]}
                  >
                    <View style={styles.stepperLabelCol}>
                      <Text style={styles.stepperLabel}>{row.label}</Text>
                      {row.field === 'timelinePct' ? (
                        <Text style={styles.stepperLabelHint}>Longer + · earlier −</Text>
                      ) : null}
                    </View>
                    <View style={styles.stepperControl}>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAdj((p) => ({
                            ...p,
                            [row.field]: (p[row.field] ?? 0) - row.step,
                          }));
                        }}
                        style={styles.stepperBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease ${row.label}`}
                        hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.stepperValue,
                          {
                            color: valueColor,
                            ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums'] } : {}),
                          },
                        ]}
                      >
                        {display}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAdj((p) => ({
                            ...p,
                            [row.field]: (p[row.field] ?? 0) + row.step,
                          }));
                        }}
                        style={styles.stepperBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase ${row.label}`}
                        hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Adjustment summary strip — same deltas, tightened spacing */}
            <View style={styles.deltaRow}>
              {[
                { label: 'Labor', field: 'laborPct', value: adj.laborPct },
                { label: 'Materials', field: 'materialPct', value: adj.materialPct },
                { label: 'Overhead', field: 'overheadPct', value: adj.overheadPct },
                { label: 'Timeline', field: 'timelinePct', value: adj.timelinePct ?? 0 },
                { label: 'Bid', field: 'markupPct', value: adj.markupPct },
              ].map((item) => (
                <View key={item.label} style={styles.deltaItem}>
                  <Text style={styles.deltaLabel}>{item.label}</Text>
                  <Text style={[styles.deltaValue, { color: fineTuneValueColor(item.field, item.value) }]}>
                    {item.value > 0 ? '+' : ''}{item.value}%
                  </Text>
                </View>
              ))}
            </View>
      </View>

      <View style={[sectionCardStyle, { marginBottom: 0 }]}>
            <Text style={styles.heroSectionEyebrow}>Scenario results</Text>

            {/* A) Key outcomes — same values as before, clearer hierarchy */}
            <View style={styles.heroOutcomes}>
              {scenarioBidMatchesOriginal ? (
                <View style={[styles.heroRow, { alignItems: 'flex-start', marginBottom: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.heroLabel}>Your bid (unchanged in this scenario)</Text>
                    <Text style={styles.heroSubLabel}>
                      Same price — costs below reflect the scenario; profit shows the impact.
                    </Text>
                  </View>
                  <Animated.Text
                    style={[
                      styles.heroBidValue,
                      {
                        color: ESTIMATE_FLOW_GREEN,
                        transform: [{
                          scale: totalBidAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.05],
                          }),
                        }],
                      },
                    ]}
                  >
                    ${sim.totalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Animated.Text>
                </View>
              ) : (
                <>
                  <View style={styles.heroRow}>
                    <Text style={styles.heroLabel}>Original bid</Text>
                    <Text style={styles.heroValue}>
                      ${sim.originalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={[styles.heroRow, { alignItems: 'flex-start', marginBottom: 10 }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.heroLabel}>
                        {sim.isExecutionMode ? 'Bid (this scenario)' : 'Bid in this scenario'}
                      </Text>
                      {!sim.isExecutionMode && (
                        <Text style={styles.heroSubLabel}>
                          vs original {sim.totalBid > sim.originalBid ? '+' : ''}
                          ${(sim.totalBid - sim.originalBid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      )}
                    </View>
                    <Animated.Text
                      style={[
                        styles.heroBidValue,
                        {
                          color: ESTIMATE_FLOW_GREEN,
                          transform: [{
                            scale: totalBidAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.05],
                            }),
                          }],
                        },
                      ]}
                    >
                      ${sim.totalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Animated.Text>
                  </View>
                </>
              )}
              <View style={styles.heroDivider} />
              <View style={styles.heroRow}>
                <Text style={styles.heroLabel}>Estimated net profit</Text>
                <Text style={[styles.heroValueAccent, { color: sim.netProfit >= 0 ? ESTIMATE_FLOW_CHIP_GREEN : palette.red }]}>
                  ${sim.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.heroRow}>
                <Text style={styles.heroLabel}>Net profit margin (revenue)</Text>
                <Animated.Text
                  style={[
                    styles.heroValueAccent,
                    {
                      color: profitMarginColorAnim.interpolate({
                        inputRange: [0, 0.5, 0.75, 1],
                        outputRange: [palette.red, palette.yellow, palette.accent, palette.accent],
                      }),
                    },
                  ]}
                >
                  {sim.netProfitMarginPct.toFixed(1)}%
                </Animated.Text>
              </View>
              <View style={styles.heroRow}>
                <Text style={styles.heroLabel}>Profit change</Text>
                <Text style={[styles.heroValueAccent, { color: aiTip.profitDelta >= 0 ? ESTIMATE_FLOW_CHIP_GREEN : palette.red }]}>
                  {aiTip.profitDelta >= 0 ? '+' : '-'}
                  ${Math.abs(aiTip.profitDelta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[styles.heroRow, { marginBottom: 0 }]}>
                <Text style={styles.heroLabel}>Cushion above break-even</Text>
                <Text style={[styles.heroValueAccent, {
                  color: (sim.totalBid - sim.breakEvenBid) >= 0 ? ESTIMATE_FLOW_CHIP_GREEN : palette.red,
                }]}>
                  ${((sim.totalBid || 0) - (sim.breakEvenBid || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* C) Safety / margin signal — same aiTip.text & color logic */}
            <View style={styles.safetyCard}>
              <Text style={[styles.safetyCardTitle, { color: aiTip.color || palette.accent }]}>Margin check</Text>
              <Text style={[styles.safetyCardBody, { color: aiTip.color || palette.text }]}>
                {aiTip.text}
              </Text>
            </View>

            {/* D) Supporting cost & bid detail — lower visual weight, same numbers */}
            <View style={styles.supportingBlock}>
              <Text style={styles.supportingTitle}>Cost & bid detail</Text>
              <View style={styles.supportingRow}>
                <Text style={styles.supportingLabel}>Labor (revised)</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.supportingValue}>${sim.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.laborPct !== 0) && (
                    <Text style={[styles.supportingHint, { color: adj.laborPct > 0 ? (getActivePreset === 'typical' ? '#eab308' : '#f97316') : ESTIMATE_FLOW_CHIP_GREEN }]}>
                      {adj.laborPct > 0 ? '+' : ''}${(base.labor * (adj.laborPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.supportingRow}>
                <Text style={styles.supportingLabel}>Materials (revised)</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.supportingValue}>${sim.materials.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.materialPct !== 0) && (
                    <Text style={[styles.supportingHint, { color: adj.materialPct > 0 ? (getActivePreset === 'typical' ? '#eab308' : '#f97316') : ESTIMATE_FLOW_CHIP_GREEN }]}>
                      {adj.materialPct > 0 ? '+' : ''}${(base.materials * (adj.materialPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.supportingRow}>
                <Text style={styles.supportingLabel}>Overhead (revised)</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.supportingValue}>${sim.overhead.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {(adj.overheadPct !== 0) && (
                    <Text style={[styles.supportingHint, { color: adj.overheadPct > 0 ? (getActivePreset === 'typical' ? '#eab308' : '#f97316') : ESTIMATE_FLOW_CHIP_GREEN }]}>
                      {adj.overheadPct > 0 ? '+' : ''}${(base.companyOverhead * (adj.overheadPct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
              {Math.abs(aiTip.bidDelta) > 0.01 && (
                <View style={styles.supportingRow}>
                  <Text style={styles.supportingLabel}>Total bid change</Text>
                  <Text style={[styles.supportingValue, { color: aiTip.bidDelta >= 0 ? ESTIMATE_FLOW_CHIP_GREEN : palette.red }]}>
                    {aiTip.bidDelta >= 0 ? '+' : ''}${aiTip.bidDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
              <View style={styles.supportingDivider} />
              <View style={styles.supportingRow}>
                <Text style={styles.supportingLabel}>Break-even bid</Text>
                <Text style={styles.supportingValue}>
                  ${(sim.breakEvenBid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.supportingRow}>
                <Text style={styles.supportingLabel}>Current bid</Text>
                <Text style={[styles.supportingValue, { fontWeight: '700' }]}>
                  ${(sim.totalBid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              {sim.netProfitOnCostPct > 0 && (
                <Text style={styles.supportingFootnote}>
                  Break-even if costs rise ~{sim.netProfitOnCostPct.toFixed(0)}%
                </Text>
              )}
            </View>

            <Text style={[styles.step6Disclaimer, { color: palette.textDim }]}>
              Estimates are scenario-based projections and not guarantees of actual costs or profit.
            </Text>
      </View>

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
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#0F172A"} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Detailed Analysis</Text>
              <View style={{ width: 40 }} />
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {aiData && (
              <View>
                {/* Labor Rate Breakdown */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Detailed Labor Rates</Text>
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
                  <Text style={styles.detailSectionTitle}>Materials Inflation Analysis</Text>
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
                  <Text style={styles.detailSectionTitle}>Bid Inflation Protection</Text>
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
                              {isProtected ? 'Protected' : 'At Risk'}
                            </Text>
                          </View>
                          {!isProtected && (
                            <View style={styles.warningCard}>
                              <Text style={styles.warningText}>
                                Your current {currentMarkup}% markup may not cover projected materials inflation. 
                                Consider increasing markup by {Math.ceil((inflationBuffer - markupBuffer) / (currentMaterials / 100))}% 
                                to maintain profitability.
                              </Text>
                            </View>
                          )}
                          {isProtected && (
                            <View style={styles.successCard}>
                              <Text style={styles.successText}>
                                Your {currentMarkup}% markup provides adequate buffer for projected materials inflation.
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
                    <Text style={styles.detailSectionTitle}>AI Recommendation Details</Text>
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
                  <Text style={styles.detailSectionTitle}>Market Insights</Text>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailText}>
                      Based on the current market analysis, your area shows {aiData.marketData.analysis.competitivenessScore} competition levels with a {aiData.marketData.analysis.marketTrend} trend.
                    </Text>
                    <Text style={styles.detailText}>
                      The regional multiplier of {aiData.marketData.analysis.regionalMultiplier}x indicates how your local rates compare to national reference data.
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
                <Text style={[styles.laborModalValue, { color: palette.accent, fontSize: ew(20, 22), fontWeight: '800' }]}>
                  ${selectedLabor ? selectedLabor.rate : 0}/hour
                </Text>
              </View>
              
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Daily Rate (8hrs):</Text>
                <Text style={[styles.laborModalValue, { color: palette.text, fontSize: ew(16, 18), fontWeight: '700' }]}>
                  ${selectedLabor ? (selectedLabor.rate * 8).toLocaleString() : 0}/day
                </Text>
              </View>
              
              <View style={styles.laborModalInfo}>
                <Text style={styles.laborModalLabel}>Weekly Rate (40hrs):</Text>
                <Text style={[styles.laborModalValue, { color: palette.text, fontSize: ew(16, 18), fontWeight: '700' }]}>
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

/** `ew` bumps secondary typography on web — matches estimate-generator step 5 */
const getStyles = (palette, ew = (phone, web) => phone, darkMode = true) => {
  const nestedSurface = darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : palette.chip;
  const nestedBorder = darkMode ? 'rgba(148, 163, 184, 0.12)' : palette.divider;

  return StyleSheet.create({
  container: {
    gap: 0,
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
    fontSize: ew(12, 14),
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
    fontSize: ew(14, 15),
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
    flexShrink: 1,
  },
  cardSubtitle: {
    color: palette.textDim,
    marginTop: 8,
    marginBottom: 12,
    lineHeight: ew(18, 22),
    fontSize: ew(14, 16),
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
    fontSize: ew(13, 15),
  },

  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: nestedSurface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nestedBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  presetChipActive: {
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
  },
  presetChipActiveTypical: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
  },
  presetChipTextActiveTypical: {
    color: 'rgba(234, 179, 8, 0.92)',
    fontWeight: '700',
    textAlign: 'center',
  },
  presetChipActiveBad: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  presetChipTextActiveBad: {
    color: '#f97316',
    fontWeight: '700',
    textAlign: 'center',
  },
  presetChipText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: ew(13, 15),
    textAlign: 'center',
  },
  presetChipTextActive: {
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontWeight: '700',
    textAlign: 'center',
  },
  presetAppliedIndicator: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  presetAppliedText: {
    color: palette.text,
    fontSize: ew(12, 14),
    lineHeight: ew(16, 20),
  },
  presetDefaultNote: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  /** Keeps custom-insight height from dropping below Typical + default note + AI (avoids first fine-tune scroll jump). */
  presetInsightCustomMin: {
    minHeight: ew(288, 308),
  },
  aiExplanationCard: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    backgroundColor: nestedSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nestedBorder,
  },
  aiExplanationLabel: {
    color: palette.accent,
    fontSize: ew(11, 13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiExplanationText: {
    color: palette.textDim,
    fontSize: ew(12, 14),
    lineHeight: ew(18, 22),
    marginTop: 4,
  },
  legalDisclaimer: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    opacity: palette.subtleOpacity,
    fontStyle: 'italic',
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 8,
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
    fontSize: ew(13, 15),
  },

  fineTuneSectionTitle: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 0,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fineTuneHint: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    lineHeight: ew(14, 17),
    marginBottom: 8,
    opacity: palette.subtleOpacity,
  },
  bidActiveBanner: {
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
  },
  bidActiveBannerText: {
    color: palette.accent,
    fontSize: ew(11, 13),
    fontWeight: '600',
  },
  fineTuneCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nestedBorder,
    backgroundColor: nestedSurface,
    overflow: 'hidden',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  stepperRowLast: {
    borderBottomWidth: 0,
  },
  stepperLabelCol: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'center',
  },
  stepperLabel: {
    color: palette.text,
    fontSize: ew(14, 16),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  stepperLabelHint: {
    color: palette.textDim,
    fontSize: ew(10, 12.5),
    lineHeight: ew(13, 16),
    marginTop: 2,
    opacity: palette.faintOpacity,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 30,
    height: 28,
    borderRadius: 7,
    backgroundColor: palette.stepperBtnBg,
    borderWidth: 1,
    borderColor: palette.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: palette.textDim,
    fontSize: ew(16, 18),
    fontWeight: '500',
    opacity: 0.85,
    marginTop: -1,
  },
  stepperValue: {
    fontSize: ew(17, 19),
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'center',
    letterSpacing: -0.3,
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
    fontSize: ew(11, 13),
    marginTop: 6,
    fontWeight: '600',
  },
  barValue: {
    color: palette.accent,
    fontSize: ew(12, 14),
    fontWeight: '800',
    marginTop: 2,
  },

  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 10,
  },
  scenarioResultsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.9,
  },
  deltaItem: {
    alignItems: 'center',
    flex: 1,
  },
  deltaLabel: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    fontWeight: '600',
    marginBottom: 4,
  },
  deltaValue: {
    fontSize: ew(16, 18),
    fontWeight: '800',
  },

  heroSectionEyebrow: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 0,
    marginBottom: 10,
  },
  heroOutcomes: {
    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : palette.chip,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.22)' : palette.divider,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 14,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    color: palette.textDim,
    fontSize: ew(13, 15),
    fontWeight: '600',
    flexShrink: 1,
    paddingRight: 8,
  },
  heroSubLabel: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    marginTop: 4,
    fontWeight: '500',
  },
  heroValue: {
    color: palette.text,
    fontSize: ew(17, 19),
    fontWeight: '700',
  },
  heroBidValue: {
    fontSize: ew(22, 24),
    fontWeight: '800',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginBottom: 14,
    marginTop: 2,
  },
  heroValueAccent: {
    fontSize: ew(18, 20),
    fontWeight: '800',
  },

  safetyCard: {
    backgroundColor: nestedSurface,
    borderWidth: 1,
    borderColor: nestedBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  safetyCardTitle: {
    fontSize: ew(12, 14),
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  safetyCardBody: {
    fontSize: ew(15, 17),
    lineHeight: ew(22, 26),
    fontWeight: '600',
  },

  supportingBlock: {
    backgroundColor: nestedSurface,
    borderWidth: 1,
    borderColor: nestedBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  step6Disclaimer: {
    fontSize: ew(11, 13),
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    opacity: darkMode ? 0.85 : 0.72,
    fontStyle: 'italic',
    lineHeight: ew(17, 20),
  },
  supportingTitle: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  supportingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  supportingLabel: {
    color: palette.textDim,
    fontSize: ew(12, 14),
    flex: 1,
    paddingRight: 8,
  },
  supportingValue: {
    color: palette.text,
    fontSize: ew(13, 15),
    fontWeight: '600',
  },
  supportingHint: {
    fontSize: ew(10, 12.5),
    marginTop: 2,
    fontWeight: '600',
  },
  supportingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginVertical: 8,
  },
  supportingFootnote: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },

  simSummary: {
    backgroundColor: palette.chip,
    borderWidth: 1,
    borderColor: palette.divider,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simLabel: {
    color: palette.text,
    fontSize: ew(13, 15),
  },
  simValue: {
    color: palette.text,
    fontSize: ew(15, 17),
    fontWeight: '600',
  },
  simLabelBold: {
    color: palette.text,
    fontSize: ew(14, 16),
    fontWeight: '700',
  },
  simValueBold: {
    color: palette.accent,
    fontSize: ew(15, 17),
    fontWeight: '600',
  },
  simValueBoldLarge: {
    color: palette.text,
    fontSize: ew(18, 20),
    fontWeight: '800',
  },
  simDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
  },
  breakEvenRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  breakEvenText: {
    color: palette.textDim,
    fontSize: ew(11, 13),
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
    borderColor: nestedBorder,
    borderRadius: 14,
    padding: 14,
    backgroundColor: nestedSurface,
  },
  versionTitle: {
    color: palette.accent,
    fontSize: ew(18, 20),
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
    fontSize: ew(13, 15),
  },
  versionValue: {
    color: palette.text,
    fontSize: ew(14, 16),
    fontWeight: '700',
  },
  versionNotes: {
    color: palette.textDim,
    fontSize: ew(11, 13),
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
    fontSize: ew(15, 17),
  },

  aiTipCard: {
    marginTop: 24,
    backgroundColor: palette.chip,
    borderWidth: 1,
    borderColor: palette.divider,
    borderRadius: 12,
    padding: 16,
  },
  aiTipText: {
    color: palette.text,
    lineHeight: ew(20, 24),
    fontSize: ew(14, 16),
  },
  aiTipDeltaContainer: {
    marginTop: 6,
  },
  aiTipDeltaLabel: {
    color: palette.textDim,
    fontSize: ew(15, 17),
    fontWeight: '600',
    marginBottom: 4,
  },
  aiTipDeltaText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: ew(15, 17),
    lineHeight: ew(22, 26),
  },
  aiTipDelta: {
    color: palette.accent,
    fontWeight: '700',
    marginTop: 6,
    fontSize: ew(15, 17),
  },

  // Loading and Error States
  loadingCard: {
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : palette.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: nestedBorder,
  },
  loadingText: {
    color: palette.textDim,
    marginTop: 12,
    fontSize: ew(14, 16),
  },
  errorCard: {
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : palette.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.red,
    alignItems: 'center',
  },
  errorText: {
    color: palette.red,
    fontSize: ew(16, 18),
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSubtext: {
    color: palette.textDim,
    fontSize: ew(12, 14),
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
    backgroundColor: nestedSurface,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: nestedBorder,
    justifyContent: 'center',
  },
  marketLabel: {
    color: palette.textDim,
    fontSize: ew(11, 13),
    marginBottom: 4,
    textAlign: 'center',
  },
  marketValue: {
    color: palette.text,
    fontSize: ew(12, 14),
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
    backgroundColor: nestedSurface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: nestedBorder,
    minHeight: 55,
  },
  laborLabel: {
    color: palette.textDim,
    fontSize: ew(14, 16),
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
    numberOfLines: 1,
    adjustsFontSizeToFit: false,
  },
  laborValue: {
    color: palette.accent,
    fontSize: ew(14, 16),
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
    fontSize: ew(14, 16),
    lineHeight: ew(20, 24),
    textAlign: 'center',
  },
  detailedRecommendations: {
    marginTop: 16,
    backgroundColor: nestedSurface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: nestedBorder,
  },
  recommendationSectionTitle: {
    color: palette.accent,
    fontSize: ew(16, 18),
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
    fontSize: ew(13, 15),
  },
  recommendationValue: {
    color: palette.text,
    fontSize: ew(14, 16),
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
    fontSize: ew(13, 15),
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
    fontSize: ew(13, 15),
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
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : palette.card,
    borderBottomWidth: 1,
    borderBottomColor: nestedBorder,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: ew(20, 22),
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
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: nestedSurface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: nestedBorder,
  },
  detailText: {
    color: palette.text,
    fontSize: ew(14, 16),
    lineHeight: ew(20, 24),
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
    fontSize: ew(14, 16),
    fontWeight: '700',
  },
  modalActions: {
    padding: 16,
    paddingBottom: 40,
  },
  modalPrimaryBtn: {
    backgroundColor: ESTIMATE_FLOW_GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_GREEN,
  },
  modalPrimaryBtnText: {
    color: '#071018',
    fontSize: ew(16, 18),
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
    fontSize: ew(13, 15),
    lineHeight: ew(18, 22),
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
    fontSize: ew(13, 15),
    lineHeight: ew(18, 22),
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
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : palette.card,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: nestedBorder,
    overflow: 'hidden',
  },
  laborModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : palette.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  laborModalTitle: {
    color: palette.accent,
    fontSize: ew(20, 22),
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
    fontSize: ew(14, 16),
    fontWeight: '600',
    marginBottom: 4,
  },
  laborModalValue: {
    color: palette.text,
    fontSize: ew(16, 18),
    fontWeight: '700',
  },
});
};

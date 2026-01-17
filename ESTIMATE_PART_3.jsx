/*
 * ESTIMATE GENERATOR - PART 3 of 3
 * 
 * This part contains:
 * - Remaining UI components and rendering
 * - StyleSheet definitions
 * - Component closing tags
 * - Export statement
 * 
 * Lines: 8268-12388
 */

                {contractorInfo ? (
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6 }}>
                    Typical markup for {contractorInfo.name}: {contractorInfo.safeMarkupRange.min}–{contractorInfo.safeMarkupRange.max}%
                  </Text>
                ) : (
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6 }}>
                    Typical GC markup: 15–25% residential
                  </Text>
                )}
                <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }}>
                  Current markup: {money(calc.profit)} ({currentMarkup}%)
                </Text>
                
                {/* Contextual Message */}
                {contextualMessage && (
                  <View style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: contextualMessage.type === 'low' ? 'rgba(239, 68, 68, 0.08)' :
                                    contextualMessage.type === 'high' ? 'rgba(251, 191, 36, 0.08)' :
                                    contextualMessage.type === 'above' ? 'rgba(56, 211, 159, 0.08)' :
                                    contextualMessage.type === 'inRange' ? 'rgba(56, 211, 159, 0.08)' :
                                    'rgba(56, 211, 159, 0.08)',
                    borderWidth: 1,
                    borderColor: contextualMessage.type === 'low' ? 'rgba(239, 68, 68, 0.2)' :
                                 contextualMessage.type === 'high' ? 'rgba(251, 191, 36, 0.2)' :
                                 contextualMessage.type === 'above' ? 'rgba(56, 211, 159, 0.3)' :
                                 contextualMessage.type === 'inRange' ? 'rgba(56, 211, 159, 0.3)' :
                                 'rgba(56, 211, 159, 0.3)',
                  }}>
                    <Text style={{ 
                      color: contextualMessage.type === 'low' ? '#ef4444' :
                             contextualMessage.type === 'high' ? '#fbbf24' :
                             contextualMessage.type === 'inRange' ? '#38d39f' :
                             '#38d39f', 
                      fontSize: 12, 
                      fontWeight: '600' 
                    }}>
                      {contextualMessage.type === 'low' && '🔴 '}
                      {contextualMessage.type === 'high' && '🟡 '}
                      {contextualMessage.type === 'above' && '🟢 '}
                      {contextualMessage.type === 'inRange' && '🟢 '}
                      {contextualMessage.text}
                    </Text>
                  </View>
                )}
                
                {/* Net Profit Calculation */}
                {currentMarkup > 0 && subtotal > 0 && (
                  <View style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }}>
                    <Text style={{ 
                      color: Colors.text, 
                      fontSize: 12, 
                      fontWeight: '600',
                      marginBottom: 2,
                    }}>
                      Estimated Net Profit: <Text style={{ color: '#22d3ee' }}>{netProfitPct.toFixed(1)}%</Text>
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>
                      At {currentMarkup}% markup: {money(profit - totalOverhead)} after overhead
                      {netProfitPct < 5 && ' (risky)'}
                      {netProfitPct >= 5 && netProfitPct < 8 && ' (thin margins)'}
                      {netProfitPct >= 8 && netProfitPct < 15 && ' (healthy)'}
                      {netProfitPct >= 15 && ' (strong)'}
                    </Text>
                  </View>
                )}
                
                {/* Health Badge - Always Visible, Based on Net Profit */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: markupStatusColor === '#38d39f' ? 'rgba(56, 211, 159, 0.1)' :
                                  markupStatusColor === '#fbbf24' ? 'rgba(251, 191, 36, 0.1)' :
                                  markupStatusColor === '#ef4444' ? 'rgba(239, 68, 68, 0.1)' :
                                  'rgba(56, 211, 159, 0.1)',
                  borderWidth: 1,
                  borderColor: markupStatusColor === '#38d39f' ? 'rgba(56, 211, 159, 0.3)' :
                               markupStatusColor === '#fbbf24' ? 'rgba(251, 191, 36, 0.3)' :
                               markupStatusColor === '#ef4444' ? 'rgba(239, 68, 68, 0.3)' :
                               'rgba(56, 211, 159, 0.3)',
                }}>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: markupStatusColor,
                    marginRight: 8,
                  }} />
                  <Text style={{ color: markupStatusColor, fontSize: 12, fontWeight: '600' }}>
                    {markupStatusText}
                  </Text>
                </View>
              </View>
              </GlassBorderCard>
              
              {/* Legal Disclaimer */}
              <Text style={{
                color: Colors.sub,
                fontSize: 11,
                textAlign: 'center',
                marginTop: 20,
                marginBottom: 8,
                paddingHorizontal: 16,
                opacity: 0.6,
                fontStyle: 'italic',
              }}>
                Estimates are scenario-based projections and not guarantees of actual costs or profit.
              </Text>
            </View>
          </TouchableWithoutFeedback>
        );
      }

      case 6: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="analytics-outline" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Project Analysis</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Project outcome scenarios</Text>
                </View>
              </View>
              <ProjectAnalysis
                bid={bid}
                calc={calc}
                materialsCart={materialsCart}
                laborLineItems={bid.laborLineItems || []}
              />
            </GlassBorderCard>
            
            {/* Legal Disclaimer - Outside the card */}
            <Text style={{
              color: Colors.sub,
              fontSize: 11,
              textAlign: 'center',
              marginTop: 16,
              marginBottom: 8,
              paddingHorizontal: 20,
              opacity: 0.6,
              fontStyle: 'italic',
            }}>
              Estimates are scenario-based projections and not guarantees of actual costs or profit.
            </Text>
          </View>
        );
      }
      
      case 7: {
        // Note: roundPayment and normalizePaymentsToExactTotal are defined at component level
        
        // Smart validation helper to prevent totals over 100%
        const validateAndAdjustPercentages = (newDepositPct, newFinalPct, currentWeeks) => {
          const totalPct = newDepositPct + newFinalPct;
          
          // If total would exceed 100%, adjust final payment down
          if (totalPct > 100) {
            const adjustedFinalPct = Math.max(0, 100 - newDepositPct);
            return {
              depositPct: newDepositPct,
              finalPct: adjustedFinalPct,
              remainingPct: 0,
              warning: `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`
            };
          }
          
          // Calculate remaining percentage for weekly payments
          const remainingPct = 100 - newDepositPct - newFinalPct;
          
          // If remaining is negative, adjust final payment
          if (remainingPct < 0) {
            const adjustedFinalPct = Math.max(0, 100 - newDepositPct);
            return {
              depositPct: newDepositPct,
              finalPct: adjustedFinalPct,
              remainingPct: 0,
              warning: `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`
            };
          }
          
          return {
            depositPct: newDepositPct,
            finalPct: newFinalPct,
            remainingPct: remainingPct,
            warning: null
          };
        };
        
        // Smart defaults: Default to milestone-based
        const defaultSchedule = 'milestone-based';
        
        // Use bid.paymentSchedule if explicitly set, otherwise use default
        // Important: Only use default if paymentSchedule is truly undefined/null/empty
        // If schedule is 'hybrid', convert to 'milestone-based' (hybrid option removed)
        const rawSchedule = (bid.paymentSchedule !== undefined && bid.paymentSchedule !== null && bid.paymentSchedule !== '') 
          ? bid.paymentSchedule 
          : defaultSchedule;
        const scheduleType = rawSchedule === 'hybrid' ? 'milestone-based' : rawSchedule;
        const milestones = bid.paymentMilestones || [];
        const weeklyPayments = bid.weeklyPayments || [];
        const grandTotal = calc?.grandTotal || calc?.total || 0;
        
        // Calculate totals
        // For hybrid mode, only count deposit and final milestones, not all milestones
        const hybridMilestones = scheduleType === 'hybrid' 
          ? milestones.filter(m => {
              const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
              const isFinal = m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')));
              return isDeposit || isFinal;
            })
          : milestones;
        
        const milestoneTotal = hybridMilestones.reduce((sum, m) => sum + (m.paymentAmount || m.amount || 0), 0);
        const weeklyTotal = weeklyPayments.reduce((sum, w) => sum + (w.amount || 0), 0);
        
        // Always calculate percentages from amounts (normalized) for accuracy
        // This ensures the displayed total is exactly 100% when amounts sum correctly
        const milestoneTotalPct = grandTotal > 0 ? (milestoneTotal / grandTotal) * 100 : 0;
        const weeklyTotalPct = grandTotal > 0 ? (weeklyTotal / grandTotal) * 100 : 0;
        const combinedTotalPct = scheduleType === 'hybrid' ? (milestoneTotalPct + weeklyTotalPct) : milestoneTotalPct;
        const remainingPctMilestone = scheduleType === 'milestone-based' || scheduleType === 'hybrid' ? Math.max(0, 100 - milestoneTotalPct) : 0;
        const remainingPctWeekly = scheduleType === 'weekly' ? Math.max(0, 100 - weeklyTotalPct) : 0;
        
        // Calculate payment risk and cash-flow insight
        const calculatePaymentRisk = () => {
          if (scheduleType === 'weekly' && weeklyPayments.length > 0) {
            // Check if equal payments
            const firstPct = weeklyPayments[0]?.percentage || (weeklyPayments[0]?.amount && grandTotal > 0 ? Math.round((weeklyPayments[0].amount / grandTotal) * 100) : 0);
            const allEqual = weeklyPayments.every(w => {
              const pct = w.percentage || (w.amount && grandTotal > 0 ? Math.round((w.amount / grandTotal) * 100) : 0);
              return Math.abs(pct - firstPct) < 1;
            });
            if (allEqual) return 'low';
          }
          
          // Check for deposit
          const firstMilestone = milestones[0];
          const firstMilestonePct = firstMilestone?.percentage || (firstMilestone?.paymentAmount && grandTotal > 0 ? Math.round((firstMilestone.paymentAmount / grandTotal) * 100) : 0);
          const firstWeekly = weeklyPayments[0];
          const firstWeeklyPct = firstWeekly?.percentage || (firstWeekly?.amount && grandTotal > 0 ? Math.round((firstWeekly.amount / grandTotal) * 100) : 0);
          const depositPct = scheduleType === 'milestone-based' ? firstMilestonePct : scheduleType === 'weekly' ? firstWeeklyPct : Math.max(firstMilestonePct, firstWeeklyPct);
          
          if (depositPct >= 20) return 'low';
          
          // Check final payment size
          const lastMilestone = milestones[milestones.length - 1];
          const lastMilestonePct = lastMilestone?.percentage || (lastMilestone?.paymentAmount && grandTotal > 0 ? Math.round((lastMilestone.paymentAmount / grandTotal) * 100) : 0);
          const lastWeekly = weeklyPayments[weeklyPayments.length - 1];
          const lastWeeklyPct = lastWeekly?.percentage || (lastWeekly?.amount && grandTotal > 0 ? Math.round((lastWeekly.amount / grandTotal) * 100) : 0);
          const finalPct = scheduleType === 'milestone-based' ? lastMilestonePct : scheduleType === 'weekly' ? lastWeeklyPct : Math.max(lastMilestonePct, lastWeeklyPct);
          
          if (depositPct < 15 && finalPct > 25) return 'moderate';
          if (depositPct < 10 && finalPct > 30) return 'tight';
          if (depositPct < 15) return 'moderate';
          
          return 'low';
        };
        
        const paymentRisk = calculatePaymentRisk();
        const riskLabels = {
          low: { label: 'Low Payment Risk', color: '#22c55e', emoji: '🟢' },
          moderate: { label: 'Moderate Payment Risk', color: '#f59e0b', emoji: '🟡' },
          tight: { label: 'High Payment Risk', color: '#ef4444', emoji: '🔴' }
        };
        
        // Calculate cash-flow insight (cash flow only, never profit)
        const getCashFlowInsight = () => {
          // Hybrid-specific insights
          if (scheduleType === 'hybrid') {
            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
            const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
            
            const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 0);
            const finalPct = finalMilestone?.percentage || (finalMilestone?.paymentAmount && grandTotal > 0 ? Math.round((finalMilestone.paymentAmount / grandTotal) * 100) : 0);
            
            if (depositPct >= 15 && finalPct <= 20) {
              return "💡 This hybrid schedule keeps cash flow positive by Week 1 while limiting end-of-job risk.";
            }
            if (finalPct > 25) {
              return "⚠️ Large final payment may increase collection risk.";
            }
            return "💡 This hybrid schedule balances cash flow protection with client comfort.";
          }
          
          if (scheduleType === 'weekly' && weeklyPayments.length > 0) {
            const firstPct = weeklyPayments[0]?.percentage || (weeklyPayments[0]?.amount && grandTotal > 0 ? Math.round((weeklyPayments[0].amount / grandTotal) * 100) : 0);
            if (firstPct >= 20) {
              return "This schedule keeps cash flow positive by Week 2.";
            }
            if (firstPct < 15 && weeklyPayments.length >= 3) {
              return "Cash flow tight until Week 3 — consider a larger deposit.";
            }
            return "Equal weekly payments provide steady cash flow throughout the project.";
          }
          
          if (milestones.length > 0) {
            const firstPct = milestones[0]?.percentage || (milestones[0]?.paymentAmount && grandTotal > 0 ? Math.round((milestones[0].paymentAmount / grandTotal) * 100) : 0);
            const midPoint = Math.floor(milestones.length / 2);
            const paidBeforeMid = milestones.slice(0, midPoint + 1).reduce((sum, m) => {
              const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
              return sum + pct;
            }, 0);
            
            if (firstPct >= 20 && paidBeforeMid >= 50) {
              return "Early payments cover initial cash flow needs.";
            }
            if (paidBeforeMid < 40) {
              return "Most payments are back-loaded — plan cash flow accordingly.";
            }
          }
          
          return "Payment schedule provides steady cash flow.";
        };
        
        // Build timeline data
        const buildTimeline = () => {
          const timeline = [];
          if (scheduleType === 'milestone-based' || scheduleType === 'hybrid') {
            milestones.forEach((m, index) => {
              const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
              const amount = roundPayment(m.paymentAmount || (grandTotal * pct / 100));
              const isFirst = index === 0;
              const isLast = index === milestones.length - 1;
              timeline.push({
                label: m.name || `Milestone ${index + 1}`,
                pct,
                amount,
                type: isFirst ? 'deposit' : isLast ? 'final' : 'progress',
                isMilestone: true,
                order: index
              });
            });
          }
          if (scheduleType === 'weekly' || scheduleType === 'hybrid') {
            weeklyPayments.forEach((w, index) => {
              const pct = w.percentage || (w.amount && grandTotal > 0 ? Math.round((w.amount / grandTotal) * 100) : 0);
              const amount = roundPayment(w.amount || (grandTotal * pct / 100));
              const isFirst = index === 0 && scheduleType === 'weekly';
              const isLast = index === weeklyPayments.length - 1 && scheduleType === 'weekly';
              timeline.push({
                label: `Week ${w.weekNumber || index + 1}`,
                pct,
                amount,
                type: isFirst ? 'deposit' : isLast ? 'final' : 'progress',
                isMilestone: false,
                order: scheduleType === 'hybrid' ? (milestones.length + index) : index
              });
            });
          }
          // Sort chronologically by order (for hybrid) or by type (for single mode)
          return timeline.sort((a, b) => {
            if (scheduleType === 'hybrid') {
              return a.order - b.order;
            }
            // For single mode, show deposit first, then progress, then final
            const order = { deposit: 0, progress: 1, final: 2 };
            return order[a.type] - order[b.type];
          });
        };
        
        const timeline = buildTimeline();
        
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            {/* Payment Strategy Header */}
            <GlassBorderCard radius={24} innerRadius={22} pad={20} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="cash-outline" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Payment Strategy</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>How and when you get paid on this job</Text>
                </View>
              </View>
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                Payment schedules vary by contract. Use this as a starting template.
              </Text>
            </GlassBorderCard>
            
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={s.inputGroup}>
                <Text style={s.label}>Schedule Type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: scheduleType === 'milestone-based' ? '#38d39f' : 'rgba(255, 255, 255, 0.15)',
                        backgroundColor: scheduleType === 'milestone-based' ? 'rgba(56, 211, 159, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: '47%',
                      }
                    ]}
                    onPress={() => {
                      // When switching to milestone-based, clear payments from other schedule types
                      if (scheduleType === 'hybrid') {
                        // Clear both milestones and weekly payments from hybrid
                        setBid(prev => {
                          const updated = { ...prev, paymentSchedule: 'milestone-based', paymentMilestones: [], weeklyPayments: [] };
                          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                          return updated;
                        });
                      } else if (scheduleType === 'weekly') {
                        // Clear weekly payments when switching from weekly
                        updateBid('weeklyPayments', []);
                        updateBid('paymentSchedule', 'milestone-based');
                      } else {
                        // Just switch if already milestone-based
                        updateBid('paymentSchedule', 'milestone-based');
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      {
                        color: scheduleType === 'milestone-based' ? '#38d39f' : Colors.text,
                        fontSize: 13,
                        fontWeight: scheduleType === 'milestone-based' ? '700' : '600',
                        textAlign: 'center',
                      }
                    ]}>
                      Milestone-Based
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: scheduleType === 'weekly' ? '#38d39f' : 'rgba(255, 255, 255, 0.15)',
                        backgroundColor: scheduleType === 'weekly' ? 'rgba(56, 211, 159, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: '47%',
                      }
                    ]}
                    onPress={() => {
                      // When switching to weekly, clear payments from other schedule types
                      if (scheduleType === 'hybrid') {
                        // Clear both milestones and weekly payments from hybrid
                        setBid(prev => {
                          const updated = { ...prev, paymentSchedule: 'weekly', paymentMilestones: [], weeklyPayments: [] };
                          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                          return updated;
                        });
                      } else if (scheduleType === 'milestone-based') {
                        // Clear milestones when switching from milestone-based
                        updateBid('paymentMilestones', []);
                        updateBid('paymentSchedule', 'weekly');
                      } else {
                        // Just switch if already weekly
                        updateBid('paymentSchedule', 'weekly');
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      {
                        color: scheduleType === 'weekly' ? '#38d39f' : Colors.text,
                        fontSize: 13,
                        fontWeight: scheduleType === 'weekly' ? '700' : '600',
                        textAlign: 'center',
                      }
                    ]}>
                      Time-Based (Weekly)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Payment Timeline Preview */}
              {timeline.length > 0 && (
                <View style={{ marginTop: 20, marginBottom: 20 }}>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[s.label, { marginBottom: 4, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }]}>Payment Timeline</Text>
                    <Text style={{ color: Colors.sub, fontSize: 10, opacity: 0.8, fontStyle: 'italic' }}>
                      Shows when payments are received — not cost timing.
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {timeline.map((item, index) => {
                        const isFinal = item.type === 'final';
                        const isDeposit = item.type === 'deposit';
                        // Final payment: outlined style (not filled)
                        const finalStyle = isFinal ? {
                          backgroundColor: 'transparent',
                          borderWidth: 2,
                          borderColor: 'rgba(45, 255, 196, 0.5)',
                          borderStyle: 'dashed',
                        } : {};
                        // Deposit: green glow
                        const depositStyle = isDeposit ? {
                          backgroundColor: 'rgba(34, 197, 94, 0.15)',
                          borderWidth: 1,
                          borderColor: 'rgba(34, 197, 94, 0.3)',
                        } : {};
                        // Progress: subtle
                        const progressStyle = !isFinal && !isDeposit ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        } : {};
                        
                        return (
                          <View
                            key={index}
                            style={[
                              {
                                minWidth: 100,
                                padding: 10,
                                borderRadius: 12,
                              },
                              finalStyle,
                              depositStyle,
                              progressStyle,
                            ]}
                          >
                            <Text style={{ color: Colors.sub, fontSize: 10, marginBottom: 4, fontWeight: '600' }} numberOfLines={1}>
                              {item.label}
                            </Text>
                            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                              {item.pct.toFixed(1)}%
                            </Text>
                            <Text style={{ color: Colors.sub, fontSize: 11 }}>
                              {money(item.amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  
                  {/* AI Cash-Flow Insight */}
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(34, 211, 238, 0.08)', borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.15)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="bulb-outline" size={16} color="#22d3ee" style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={{ color: Colors.text, fontSize: 12, flex: 1, lineHeight: 18 }}>
                        {getCashFlowInsight()}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Payment Risk Indicator */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: riskLabels[paymentRisk].color + '20',
                      borderWidth: 1,
                      borderColor: riskLabels[paymentRisk].color + '40',
                    }}>
                      <Text style={{ fontSize: 12, marginRight: 6 }}>{riskLabels[paymentRisk].emoji}</Text>
                      <Text style={{ color: riskLabels[paymentRisk].color, fontSize: 12, fontWeight: '600' }}>
                        {riskLabels[paymentRisk].label}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Hybrid Setup Flow - 3 Clear Sections */}
              {scheduleType === 'hybrid' ? (
                <View style={{ marginTop: 24 }}>
                  {/* Hybrid Header with Clear Button */}
                  {milestones.length > 0 || weeklyPayments.length > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View>
                        <Text style={[s.label, { marginBottom: 4 }]}>Hybrid Payment Schedule</Text>
                        {(milestones.length > 0 || weeklyPayments.length > 0) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: Math.abs(combinedTotalPct - 100) < 0.01 ? '#22c55e' : combinedTotalPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                              Total: {Math.abs(combinedTotalPct - 100) < 0.01 ? '100' : combinedTotalPct.toFixed(1)}% {Math.abs(combinedTotalPct - 100) < 0.01 ? '✅' : combinedTotalPct > 100 ? '⚠️' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(milestones.length > 0 || weeklyPayments.length > 0) && (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 20,
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                            }}
                            onPress={() => {
                              Alert.alert(
                                'Clear Hybrid Schedule',
                                'This will remove all deposit, weekly, and final payments. Continue?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Clear',
                                    style: 'destructive',
                                    onPress: async () => {
                                      console.log('🗑️ Clearing Hybrid schedule...');
                                      // Update both at once to ensure they're cleared together
                                      const updatedBid = { 
                                        ...bid, 
                                        paymentMilestones: [], 
                                        weeklyPayments: [] 
                                      };
                                      setBid(updatedBid);
                                      
                                      // Auto-save
                                      try {
                                        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
                                        console.log('💾 Cleared Hybrid schedule saved');
                                      } catch (error) {
                                        console.error('Error saving cleared schedule:', error);
                                      }
                                      
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }
                                  }
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                            <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                              Clear
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Empty State for Hybrid - Template Selection */}
                  {milestones.length === 0 && weeklyPayments.length === 0 ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => {
                            // Hybrid Template: 20% Deposit + 5 Weekly + 15% Final (exactly 100%)
                            const depositPct = 20;
                            const finalPct = 15;
                            const weeks = 5;
                            const remainingPct = 100 - depositPct - finalPct; // 65% for weekly
                            const weeklyPct = remainingPct / weeks; // 13% per week
                            
                            // Calculate deposit amount
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            
                            // Calculate amounts for first (weeks - 1) weekly payments
                            const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                            const weeklyPayments = Array.from({ length: weeks - 1 }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                            
                            // Calculate final milestone amount
                            const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                            
                            // Calculate sum of deposit + first (weeks - 1) weekly + final
                            const sumOfAllExceptLastWeek = depositAmount + (weeklyAmount * (weeks - 1)) + finalAmount;
                            
                            // Make last weekly payment equal to grandTotal - sum of all others (ensures exact 100%)
                            const lastWeekAmount = roundPayment(grandTotal - sumOfAllExceptLastWeek);
                            const lastWeekPct = grandTotal > 0 ? (lastWeekAmount / grandTotal) * 100 : 0;
                            
                            const deposit = {
                              id: `milestone-hybrid-deposit-${Date.now()}`,
                              name: 'Deposit',
                              paymentAmount: depositAmount,
                              amount: depositAmount,
                              percentage: depositPct,
                              type: 'deposit'
                            };
                            
                            const weekly = [
                              ...weeklyPayments,
                              {
                                id: `weekly-hybrid-${Date.now()}-${weeks - 1}`,
                                weekNumber: weeks,
                                description: `Week ${weeks} Payment`,
                                amount: lastWeekAmount,
                                percentage: lastWeekPct,
                              }
                            ];
                            
                            const final = {
                              id: `milestone-hybrid-final-${Date.now()}`,
                              name: 'Final Completion',
                              paymentAmount: finalAmount,
                              amount: finalAmount,
                              percentage: finalPct,
                              type: 'final'
                            };
                            
                            // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                            const normalized = normalizeHybridPaymentsToExactTotal([deposit, final], weekly, grandTotal);
                            
                            // Update both milestones and weekly payments in a single state update
                            // to ensure the calculation includes both when the component re-renders
                            setBid(prev => {
                              const updated = {
                                ...prev,
                                paymentMilestones: normalized.milestones,
                                weeklyPayments: normalized.weeklyPayments
                              };
                              // Auto-save immediately
                              AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                              return updated;
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Recommended</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(45, 255, 196, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(45, 255, 196, 0.4)',
                              }}>
                                <Text style={{ color: '#2DFFC4', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>BEST</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>20% deposit + over 5 weeks + 15% final</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {/* Section 1: Upfront Deposit */}
                  <View style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="wallet-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                      const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 20);
                      const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                      
                      return (
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {[15, 20, 25, 'Custom'].map((preset) => {
                              const isSelected = preset === 'Custom' 
                                ? isCustomDeposit 
                                : depositPct === preset;
                              const displayText = preset === 'Custom' 
                                ? (isCustomDeposit ? `${depositPct}%` : 'Custom')
                                : `${preset}%`;
                              
                              return (
                                <TouchableOpacity
                                  key={preset}
                                  onPress={() => {
                                    if (preset !== 'Custom') {
                                      const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                      
                                      // Get current final milestone
                                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                      const currentFinalPct = finalMilestone?.percentage || 0;
                                      
                                      // Validate and adjust percentages to prevent exceeding 100%
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      const validation = validateAndAdjustPercentages(newDepositPct, currentFinalPct, currentWeeksForValidation);
                                      
                                      // Show warning if adjustment was needed
                                      if (validation.warning) {
                                        Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                      }
                                      
                                      const finalPct = validation.finalPct;
                                      const remainingPct = validation.remainingPct;
                                      
                                      // Calculate amounts from grandTotal
                                      const depositAmount = roundPayment((grandTotal * validation.depositPct) / 100);
                                      const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                      
                                      // Update deposit milestone
                                      let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                      updatedMilestones.unshift({
                                        id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                        name: 'Deposit',
                                        paymentAmount: depositAmount,
                                        percentage: validation.depositPct,
                                        type: 'deposit'
                                      });
                                      
                                      // Update final milestone if it was adjusted
                                      if (finalMilestone) {
                                        updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                        updatedMilestones.push({
                                          id: finalMilestone.id,
                                          name: 'Final Completion',
                                          paymentAmount: finalAmount,
                                          percentage: finalPct,
                                          type: 'final'
                                        });
                                      }
                                      
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    } else {
                                      // Handle custom deposit input
                                      if (Platform.OS === 'ios') {
                                        Alert.prompt(
                                          'Custom Deposit',
                                          'Enter deposit percentage (0-50):',
                                          [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                              text: 'Set',
                                              onPress: (text) => {
                                                const numPct = parseInt(text);
                                                if (text && numPct >= 0 && numPct <= 50) {
                                                  // Get current final milestone
                                                  const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                                  const currentFinalPct = finalMilestone?.percentage || 0;
                                                  
                                                  // Validate and adjust percentages to prevent exceeding 100%
                                                  // Use current bid state to get the actual number of weeks
                                                  const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                  const validation = validateAndAdjustPercentages(numPct, currentFinalPct, currentWeeksForValidation);
                                                  
                                                  // Show warning if adjustment was needed
                                                  if (validation.warning) {
                                                    Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                                  }
                                                  
                                                  const finalPct = validation.finalPct;
                                                  const remainingPct = validation.remainingPct;
                                                  
                                                  // Calculate amounts from grandTotal
                                                  const depositAmount = roundPayment((grandTotal * validation.depositPct) / 100);
                                                  const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                                  
                                                  // Update deposit milestone
                                                  let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                  updatedMilestones.unshift({
                                                    id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                                    name: 'Deposit',
                                                    paymentAmount: depositAmount,
                                                    percentage: validation.depositPct,
                                                    type: 'deposit'
                                                  });
                                                  
                                                  // Update final milestone if it was adjusted
                                                  if (finalMilestone) {
                                                    updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                                    updatedMilestones.push({
                                                      id: finalMilestone.id,
                                                      name: 'Final Completion',
                                                      paymentAmount: finalAmount,
                                                      percentage: finalPct,
                                                      type: 'final'
                                                    });
                                                  }
                                                  
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                } else {
                                                  Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                }
                                              }
                                            }
                                          ],
                                          'plain-text',
                                          isCustomDeposit ? depositPct.toString() : ''
                                        );
                                      } else {
                                        // Android - use modal
                                        setCustomDepositModal({ 
                                          visible: true, 
                                          value: isCustomDeposit ? depositPct.toString() : '' 
                                        });
                                      }
                                    }
                                  }}
                                  style={{
                                    minWidth: 70,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: isSelected ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderWidth: 1,
                                    borderColor: isSelected ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ 
                                    color: isSelected ? '#2DFFC4' : Colors.text, 
                                    fontSize: 13, 
                                    fontWeight: isSelected ? '700' : '600',
                                    textAlign: 'center',
                                  }}>
                                    {displayText}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {depositMilestone && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>{money(depositMilestone.paymentAmount || 0)}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  
                  {/* Section 2: Weekly Progress Payments */}
                  <View style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="calendar-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Weekly Progress Payments</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Keeps cash flow steady during work</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                      const depositPct = depositMilestone?.percentage || 0;
                      const finalPct = finalMilestone?.percentage || 0;
                      const remainingPct = 100 - depositPct - finalPct;
                      const weeks = weeklyPayments.length || 5;
                      const weeklyPctPerWeek = weeks > 0 ? remainingPct / weeks : 0;
                      const isCustomWeeks = weeks > 12;
                      const customWeeksDisplay = isCustomWeeks ? weeks.toString() : '';
                      
                      return (
                        <View>
                          <View style={{ marginBottom: 12 }}>
                            <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Weeks</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              {[5, 6, 7, 8, 9, 10, 11, 12].map((weekCount) => (
                                <TouchableOpacity
                                  key={weekCount}
                                  onPress={() => {
                                    // Recalculate weekly payments based on remaining percentage
                                    const newWeeklyPct = remainingPct / weekCount;
                                    const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                    const newWeekly = Array.from({ length: weekCount }, (_, i) => ({
                                      id: `weekly-hybrid-${Date.now()}-${i}`,
                                      weekNumber: i + 1,
                                      description: `Week ${i + 1} Payment`,
                                      amount: newWeeklyAmount,
                                      percentage: newWeeklyPct,
                                    }));
                                    
                                    // Get current milestones (deposit and final)
                                    const currentMilestones = milestones.filter(m => {
                                      const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                                      const isFinal = m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'));
                                      return isDeposit || isFinal;
                                    });
                                    
                                    // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                    const normalized = normalizeHybridPaymentsToExactTotal(currentMilestones, newWeekly, grandTotal);
                                    
                                    // Update both milestones and weekly payments
                                    setBid(prev => {
                                      const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                      AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                      return updated;
                                    });
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                  style={{
                                    minWidth: 50,
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 12,
                                    backgroundColor: !isCustomWeeks && weeks === weekCount ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderWidth: 1,
                                    borderColor: !isCustomWeeks && weeks === weekCount ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: !isCustomWeeks && weeks === weekCount ? '#2DFFC4' : Colors.text, fontSize: 12, fontWeight: !isCustomWeeks && weeks === weekCount ? '700' : '600' }}>
                                    {weekCount}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            
                            {/* Custom Weeks Input */}
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (13+ weeks)</Text>
                              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                  <TextInput
                                    key={`custom-weeks-input-${weeks}`}
                                    defaultValue={customWeeksDisplay}
                                    onChangeText={(text) => {
                                      const numWeeks = parseInt(text);
                                      if (text === '' || (numWeeks >= 13 && numWeeks <= 52)) {
                                        if (numWeeks >= 13 && numWeeks <= 52) {
                                          // Recalculate weekly payments based on remaining percentage
                                          const newWeeklyPct = remainingPct / numWeeks;
                                          const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                          const newWeekly = Array.from({ length: numWeeks }, (_, i) => ({
                                            id: `weekly-hybrid-${Date.now()}-${i}`,
                                            weekNumber: i + 1,
                                            description: `Week ${i + 1} Payment`,
                                            amount: newWeeklyAmount,
                                            percentage: newWeeklyPct,
                                          }));
                                          
                                          // Get current milestones (deposit and final)
                                          const currentMilestones = milestones.filter(m => {
                                            const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                                            const isFinal = m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'));
                                            return isDeposit || isFinal;
                                          });
                                          
                                          // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                          const normalized = normalizeHybridPaymentsToExactTotal(currentMilestones, newWeekly, grandTotal);
                                          
                                          // Update both milestones and weekly payments
                                          setBid(prev => {
                                            const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                            return updated;
                                          });
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else if (text === '') {
                                          // Clear if empty
                                          updateBid('weeklyPayments', []);
                                        }
                                      }
                                    }}
                                    placeholder="Enter weeks (13-52)"
                                    placeholderTextColor={Colors.sub}
                                    keyboardType="number-pad"
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                      borderWidth: 1,
                                      borderColor: isCustomWeeks ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                      borderRadius: 12,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      color: Colors.text,
                                      fontSize: 14,
                                    }}
                                  />
                                </View>
                                {isCustomWeeks && (
                                  <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 80 }}>
                                    {weeklyPctPerWeek.toFixed(1)}% per week
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                          {weeklyPayments.length > 0 && (
                            <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Week</Text>
                                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{weeklyPctPerWeek.toFixed(1)}% ({money(weeklyPayments[0]?.amount || 0)})</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Weekly</Text>
                                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(weeklyTotal)})</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  
                  {/* Section 3: Final Completion Payment */}
                  <View style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Final Completion Payment</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Paid at final walkthrough or punch list</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                      
                      // Get percentage from milestone - prefer percentage field, fallback to calculation
                      // Handle negative percentages (some systems store as negative)
                      let finalPct = 15; // default
                      if (finalMilestone) {
                        if (finalMilestone.percentage !== undefined && finalMilestone.percentage !== null) {
                          finalPct = Math.abs(Math.round(Number(finalMilestone.percentage)));
                        } else if (finalMilestone.paymentAmount && grandTotal > 0) {
                          finalPct = Math.abs(Math.round((finalMilestone.paymentAmount / grandTotal) * 100));
                        }
                      }
                      
                      const isCustomFinal = finalPct > 0 && finalPct !== 10 && finalPct !== 15 && finalPct !== 20;
                      
                      return (
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {[10, 15, 20, 'Custom'].map((preset) => {
                              const isSelected = preset === 'Custom' 
                                ? isCustomFinal 
                                : finalPct === preset;
                              const displayText = preset === 'Custom' 
                                ? (isCustomFinal ? `${finalPct}%` : 'Custom')
                                : `${preset}%`;
                              
                              return (
                              <TouchableOpacity
                                key={preset}
                                activeOpacity={0.7}
                                  onPress={() => {
                                    if (preset !== 'Custom') {
                                      const newFinalPct = typeof preset === 'number' ? preset : parseInt(preset);
                                      
                                      // Get current deposit milestone
                                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                      const currentDepositPct = depositMilestone?.percentage || 0;
                                      
                                      // Validate and adjust percentages to prevent exceeding 100%
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      const validation = validateAndAdjustPercentages(currentDepositPct, newFinalPct, currentWeeksForValidation);
                                      
                                      // Show warning if adjustment was needed
                                      if (validation.warning) {
                                        Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                      }
                                      
                                      const depositPct = validation.depositPct;
                                      const finalPct = validation.finalPct;
                                      const remainingPct = validation.remainingPct;
                                      
                                      // Calculate amounts from grandTotal
                                      const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                                      const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                      
                                      // Update deposit milestone if it was adjusted
                                      let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                      if (depositMilestone) {
                                        updatedMilestones.unshift({
                                          id: depositMilestone.id,
                                          name: 'Deposit',
                                          paymentAmount: depositAmount,
                                          percentage: depositPct,
                                          type: 'deposit'
                                        });
                                      }
                                      
                                      // Update final milestone
                                      // Ensure percentage is positive (handle negative values)
                                      const finalPctPositive = Math.abs(finalPct);
                                      updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                      updatedMilestones.push({
                                        id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                                        name: 'Final Completion',
                                        paymentAmount: Math.abs(finalAmount), // Ensure amount is positive
                                        percentage: finalPctPositive, // Ensure percentage is positive
                                        type: 'final'
                                      });
                                      
                                      console.log('🔧 Creating final milestone:', {
                                        finalPct: finalPctPositive,
                                        finalAmount: Math.abs(finalAmount),
                                        name: 'Final Completion'
                                      });
                                      
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // CRITICAL: Preserve the exact percentage we set, even after normalization
                                      // The normalization might adjust amounts slightly, but we want to keep the user's selected percentage
                                      const finalMilestoneInNormalized = normalized.milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                      if (finalMilestoneInNormalized) {
                                        // Restore the exact percentage the user selected
                                        finalMilestoneInNormalized.percentage = finalPctPositive;
                                        // Recalculate amount from the preserved percentage (to ensure consistency)
                                        finalMilestoneInNormalized.paymentAmount = Math.abs(roundPayment((grandTotal * finalPctPositive) / 100));
                                        finalMilestoneInNormalized.amount = finalMilestoneInNormalized.paymentAmount;
                                        console.log('🔧 Preserved exact percentage after normalization:', {
                                          requested: finalPctPositive,
                                          stored: finalMilestoneInNormalized.percentage,
                                          amount: finalMilestoneInNormalized.paymentAmount
                                        });
                                      }
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      console.log('🎯 Updating final payment button click:', {
                                        clickedPreset: preset,
                                        newFinalPct,
                                        finalPct: validation.finalPct,
                                        finalPctPositive,
                                        finalAmount,
                                        milestones: normalized.milestones.length
                                      });
                                      
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        
                                        // Log the update
                                        const updatedFinal = updated.paymentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                        console.log('✅ State updated with final milestone:', {
                                          percentage: updatedFinal?.percentage,
                                          paymentAmount: updatedFinal?.paymentAmount,
                                          name: updatedFinal?.name
                                        });
                                        
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  } else {
                                    // Handle custom final payment input
                                    if (Platform.OS === 'ios') {
                                      Alert.prompt(
                                        'Custom Final Payment',
                                        'Enter final payment percentage (0-50):',
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Set',
                                            onPress: (text) => {
                                              const numPct = parseInt(text);
                                              if (text && numPct >= 0 && numPct <= 50) {
                                                // Get current deposit milestone
                                                const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                                const currentDepositPct = depositMilestone?.percentage || 0;
                                                
                                                // Validate and adjust percentages to prevent exceeding 100%
                                                // Use current bid state to get the actual number of weeks
                                                const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                const validation = validateAndAdjustPercentages(currentDepositPct, numPct, currentWeeksForValidation);
                                                
                                                // Show warning if adjustment was needed
                                                if (validation.warning) {
                                                  Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                                }
                                                
                                                const depositPct = validation.depositPct;
                                                const finalPct = validation.finalPct;
                                                const remainingPct = validation.remainingPct;
                                                
                                                // Calculate amounts from grandTotal
                                                const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                                                const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                                
                                                // Update deposit milestone if it was adjusted
                                                let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                if (depositMilestone) {
                                                  updatedMilestones.unshift({
                                                    id: depositMilestone.id,
                                                    name: 'Deposit',
                                                    paymentAmount: depositAmount,
                                                    percentage: depositPct,
                                                    type: 'deposit'
                                                  });
                                                }
                                                
                                                // Update final milestone
                                                updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                                updatedMilestones.push({
                                                  id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                                                  name: 'Final Completion',
                                                  paymentAmount: finalAmount,
                                                  percentage: finalPct,
                                                  type: 'final'
                                                });
                                                
                                                // ALWAYS recalculate weekly payments based on new remaining percentage
                                                // Use current bid state to get the actual number of weeks
                                                const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                let newWeekly = [];
                                                if (remainingPct > 0 && currentWeeks > 0) {
                                                  const weeklyPct = remainingPct / currentWeeks;
                                                  const weeklyAmount = (grandTotal * weeklyPct) / 100;
                                                  newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                                    id: `weekly-hybrid-${Date.now()}-${i}`,
                                                    weekNumber: i + 1,
                                                    description: `Week ${i + 1} Payment`,
                                                    amount: weeklyAmount,
                                                    percentage: weeklyPct,
                                                  }));
                                                }
                                                
                                                // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                                const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                                
                                                // Update both milestones and weekly payments in a single state update
                                                setBid(prev => {
                                                  const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                                  // Auto-save payment schedule changes immediately
                                                  AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                                  return updated;
                                                });
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                              } else {
                                                Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                              }
                                            }
                                          }
                                        ],
                                        'plain-text',
                                        isCustomFinal ? finalPct.toString() : ''
                                      );
                                    } else {
                                      // Android - use modal
                                      setCustomFinalModal({ 
                                        visible: true, 
                                        value: isCustomFinal ? finalPct.toString() : '' 
                                      });
                                    }
                                  }
                                }}
                                  style={{
                                    minWidth: 70,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: isSelected ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderWidth: 1,
                                    borderColor: isSelected ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ 
                                    color: isSelected ? '#2DFFC4' : Colors.text, 
                                    fontSize: 13, 
                                    fontWeight: isSelected ? '700' : '600',
                                    textAlign: 'center',
                                  }}>
                                    {displayText}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {finalMilestone && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>{money(finalMilestone.paymentAmount || 0)}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                    </>
                  )}
                </View>
              ) : scheduleType === 'milestone-based' ? (
                <View style={{ marginTop: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={[s.label, { marginBottom: 4 }]}>Payment Milestones</Text>
                      {milestones.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ color: Math.abs(milestoneTotalPct - 100) < 0.01 ? '#2DFFC4' : milestoneTotalPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                            Total: {Math.abs(milestoneTotalPct - 100) < 0.01 ? '100' : milestoneTotalPct.toFixed(1)}% {Math.abs(milestoneTotalPct - 100) < 0.01 ? '✅' : milestoneTotalPct > 100 ? '⚠️' : ''}
                          </Text>
                          {remainingPctMilestone > 0 && scheduleType !== 'hybrid' && (
                            <TouchableOpacity
                              onPress={() => {
                                // Auto-balance: distribute remaining percentage evenly across all milestones
                                if (milestones.length > 0) {
                                  const perMilestone = remainingPctMilestone / milestones.length;
                                  const updatedMilestones = milestones.map(m => {
                                    const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
                                    return {
                                      ...m,
                                      percentage: currentPct + perMilestone,
                                      paymentAmount: grandTotal > 0 ? ((currentPct + perMilestone) / 100) * grandTotal : m.paymentAmount
                                    };
                                  });
                                  updateBid('paymentMilestones', updatedMilestones);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text style={{ color: '#2DFFC4', fontSize: 11, fontWeight: '600' }}>
                                Remaining: {remainingPctMilestone.toFixed(1)}% • Auto-Fix
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {milestones.length > 0 && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Clear Milestones',
                              'This will remove all milestone payments. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Clear',
                                  style: 'destructive',
                                  onPress: () => {
                                    updateBid('paymentMilestones', []);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                          <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  {milestones.length === 0 && scheduleType !== 'hybrid' ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        <TouchableOpacity
                          onPress={() => {
                            // Deposit + 3 Milestones: 20% deposit, then 26.67%, 26.67%, 26.66% (exactly 100%)
                            const depositPct = 20;
                            const milestonePct = (100 - depositPct) / 3; // 26.666...% per milestone
                            
                            // Calculate amounts for first 3 payments
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            const milestone1Amount = roundPayment((grandTotal * milestonePct) / 100);
                            const milestone2Amount = roundPayment((grandTotal * milestonePct) / 100);
                            
                            // Calculate sum of first 3 payments
                            const sumOfFirstThree = depositAmount + milestone1Amount + milestone2Amount;
                            
                            // Make final payment equal to grandTotal - sum of first 3 (ensures exact 100%)
                            const finalAmount = roundPayment(grandTotal - sumOfFirstThree);
                            const finalPct = grandTotal > 0 ? (finalAmount / grandTotal) * 100 : 0;
                            
                            const deposit = { 
                              id: `milestone-${Date.now()}-deposit`, 
                              name: 'Deposit', 
                              paymentAmount: depositAmount, 
                              amount: depositAmount,
                              percentage: depositPct,
                              type: 'deposit'
                            };
                            const milestone1 = { 
                              id: `milestone-${Date.now()}-1`, 
                              name: 'Milestone 1', 
                              paymentAmount: milestone1Amount, 
                              amount: milestone1Amount,
                              percentage: milestonePct
                            };
                            const milestone2 = { 
                              id: `milestone-${Date.now()}-2`, 
                              name: 'Milestone 2', 
                              paymentAmount: milestone2Amount, 
                              amount: milestone2Amount,
                              percentage: milestonePct
                            };
                            const milestone3 = { 
                              id: `milestone-${Date.now()}-3`, 
                              name: 'Final Payment', 
                              paymentAmount: finalAmount, 
                              amount: finalAmount,
                              percentage: finalPct,
                              type: 'final'
                            };
                            updateBid('paymentMilestones', [deposit, milestone1, milestone2, milestone3]);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Deposit + Milestones</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                              }}>
                                <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>RECOMMENDED</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>Protects cash flow and covers upfront costs</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Upfront Deposit Card for Milestone-Based */}
                  {scheduleType === 'milestone-based' && milestones.length > 0 ? (
                    <>
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Ionicons name="wallet-outline" size={18} color="#22c55e" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                            <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                          </View>
                        </View>
                        
                        {(() => {
                          const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 20);
                          const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                          
                          return (
                            <View>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {[15, 20, 25, 'Custom'].map((preset) => {
                                  const isSelected = preset === 'Custom' 
                                    ? isCustomDeposit 
                                    : depositPct === preset;
                                  const displayText = preset === 'Custom' 
                                    ? (isCustomDeposit ? `${depositPct}%` : 'Custom')
                                    : `${preset}%`;
                                  
                                  return (
                                    <TouchableOpacity
                                      key={preset}
                                      onPress={() => {
                                        if (preset !== 'Custom') {
                                          const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                          const depositAmount = roundPayment((grandTotal * newDepositPct) / 100);
                                          
                                          // Get all other milestones (excluding deposit)
                                          let otherMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                          
                                          // Calculate total percentage of other milestones
                                          const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
                                            const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                            return sum + pct;
                                          }, 0);
                                          
                                          // Calculate remaining percentage
                                          const remainingPct = 100 - newDepositPct;
                                          
                                          // ALWAYS recalculate other milestones proportionally to keep total at 100%
                                          if (otherMilestones.length > 0 && remainingPct > 0) {
                                            const scaleFactor = remainingPct / (otherMilestonesPct || 1);
                                            otherMilestones = otherMilestones.map(m => {
                                              const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                              const newPct = currentPct * scaleFactor;
                                              return {
                                                ...m,
                                                percentage: newPct,
                                                paymentAmount: roundPayment((grandTotal * newPct) / 100),
                                                amount: roundPayment((grandTotal * newPct) / 100)
                                              };
                                            });
                                          } else if (otherMilestones.length > 0 && remainingPct <= 0) {
                                            // If remaining is 0 or negative, set all other milestones to 0
                                            otherMilestones = otherMilestones.map(m => ({
                                              ...m,
                                              percentage: 0,
                                              paymentAmount: 0,
                                              amount: 0
                                            }));
                                          }
                                          
                                          // Update deposit milestone
                                          let updatedMilestones = otherMilestones;
                                          updatedMilestones.unshift({
                                            id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                            name: 'Deposit',
                                            paymentAmount: depositAmount,
                                            percentage: newDepositPct,
                                            type: 'deposit',
                                            amount: depositAmount
                                          });
                                          
                                          updateBid('paymentMilestones', updatedMilestones);
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else {
                                          // Handle custom deposit input
                                          if (Platform.OS === 'ios') {
                                            Alert.prompt(
                                              'Custom Deposit',
                                              'Enter deposit percentage (0-50):',
                                              [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                  text: 'Set',
                                                  onPress: (text) => {
                                                    const numPct = parseInt(text);
                                                    if (text && numPct >= 0 && numPct <= 50) {
                                                      const depositAmount = roundPayment((grandTotal * numPct) / 100);
                                                      
                                                      // Get all other milestones (excluding deposit)
                                                      let otherMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                      
                                                      // Calculate total percentage of other milestones
                                                      const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
                                                        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                                        return sum + pct;
                                                      }, 0);
                                                      
                                                      // Calculate remaining percentage
                                                      const remainingPct = 100 - numPct;
                                                      
                                                      // ALWAYS recalculate other milestones proportionally to keep total at 100%
                                                      if (otherMilestones.length > 0 && remainingPct > 0) {
                                                        const scaleFactor = remainingPct / (otherMilestonesPct || 1);
                                                        otherMilestones = otherMilestones.map(m => {
                                                          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                                          const newPct = currentPct * scaleFactor;
                                                          return {
                                                            ...m,
                                                            percentage: newPct,
                                                            paymentAmount: roundPayment((grandTotal * newPct) / 100),
                                                            amount: roundPayment((grandTotal * newPct) / 100)
                                                          };
                                                        });
                                                      } else if (otherMilestones.length > 0 && remainingPct <= 0) {
                                                        // If remaining is 0 or negative, set all other milestones to 0
                                                        otherMilestones = otherMilestones.map(m => ({
                                                          ...m,
                                                          percentage: 0,
                                                          paymentAmount: 0,
                                                          amount: 0
                                                        }));
                                                      }
                                                      
                                                      // Update deposit milestone
                                                      let updatedMilestones = otherMilestones;
                                                      updatedMilestones.unshift({
                                                        id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                                        name: 'Deposit',
                                                        paymentAmount: depositAmount,
                                                        percentage: numPct,
                                                        type: 'deposit',
                                                        amount: depositAmount
                                                      });
                                                      
                                                      updateBid('paymentMilestones', updatedMilestones);
                                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    } else {
                                                      Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                    }
                                                  }
                                                }
                                              ],
                                              'plain-text',
                                              isCustomDeposit ? depositPct.toString() : ''
                                            );
                                          } else {
                                            Alert.alert('Custom Deposit', 'Enter deposit percentage (0-50):', [
                                              { text: 'Cancel', style: 'cancel' },
                                              {
                                                text: 'Set',
                                                onPress: () => {
                                                  // Android: would need a custom input modal
                                                  Alert.alert('Not supported', 'Custom input requires iOS. Please edit the milestone manually.');
                                                }
                                              }
                                            ]);
                                          }
                                        }
                                      }}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isSelected ? '#38d39f' : 'rgba(255, 255, 255, 0.15)',
                                        backgroundColor: isSelected ? 'rgba(56, 211, 159, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                      }}
                                    >
                                      <Text style={{ 
                                        color: isSelected ? '#38d39f' : Colors.text, 
                                        fontSize: 13, 
                                        fontWeight: isSelected ? '700' : '600',
                                        textAlign: 'center',
                                      }}>
                                        {displayText}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })()}
                    </View>
                    
                    {/* Section 2: Milestone Progress Payments */}
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Ionicons name="checkmark-done-outline" size={18} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Milestone Progress Payments</Text>
                          <Text style={{ color: Colors.sub, fontSize: 11 }}>Payments at key project stages</Text>
                        </View>
                      </View>
                      
                      {(() => {
                        const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                        const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 0);
                        const remainingPct = 100 - depositPct;
                        
                        // Count progress milestones (excluding deposit, but including final as last milestone)
                        const progressMilestones = milestones.filter(m => {
                          const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                          return !isDeposit;
                        });
                        const milestonesCount = progressMilestones.length || 3;
                        const milestonePctPerMilestone = milestonesCount > 0 ? remainingPct / milestonesCount : 0;
                        const isCustomMilestones = milestonesCount > 8;
                        const customMilestonesDisplay = isCustomMilestones ? milestonesCount.toString() : '';
                        
                        return (
                          <View>
                            <View style={{ marginBottom: 12 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Milestones</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {[2, 3, 4, 5, 6, 7, 8].map((milestoneCount) => (
                                  <TouchableOpacity
                                    key={milestoneCount}
                                    onPress={() => {
                                      // Get deposit milestone (no separate final milestone for milestone-based)
                                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                      
                                      // Calculate remaining percentage for milestones (including final)
                                      const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? (depositMilestone.paymentAmount / grandTotal) * 100 : 0);
                                      const remainingPct = 100 - depositPct;
                                      
                                      // Calculate per-milestone percentage (last one will be final)
                                      const newMilestonePct = remainingPct > 0 && milestoneCount > 0 ? remainingPct / milestoneCount : 0;
                                      const newMilestoneAmount = roundPayment((grandTotal * newMilestonePct) / 100);
                                      
                                      // Create milestones - last one is the final payment
                                      const newMilestones = Array.from({ length: milestoneCount }, (_, i) => {
                                        const isLast = i === milestoneCount - 1;
                                        return {
                                          id: `milestone-progress-${Date.now()}-${i}`,
                                          name: isLast ? 'Final Payment' : `Milestone ${i + 1}`,
                                          paymentAmount: newMilestoneAmount,
                                          percentage: newMilestonePct,
                                          amount: newMilestoneAmount,
                                          type: isLast ? 'final' : undefined,
                                        };
                                      });
                                      
                                      // Combine with deposit
                                      let updatedMilestones = [];
                                      if (depositMilestone) {
                                        updatedMilestones.push(depositMilestone);
                                      }
                                      updatedMilestones = updatedMilestones.concat(newMilestones);
                                      
                                      updateBid('paymentMilestones', updatedMilestones);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                      minWidth: 50,
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      borderRadius: 12,
                                      backgroundColor: !isCustomMilestones && milestonesCount === milestoneCount ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                      borderWidth: 1,
                                      borderColor: !isCustomMilestones && milestonesCount === milestoneCount ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: !isCustomMilestones && milestonesCount === milestoneCount ? '#3b82f6' : Colors.text, fontSize: 12, fontWeight: !isCustomMilestones && milestonesCount === milestoneCount ? '700' : '600' }}>
                                      {milestoneCount}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              
                              {/* Custom Milestones Input */}
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (9+ milestones)</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <TextInput
                                      key={`custom-milestones-input-${milestonesCount}`}
                                      defaultValue={customMilestonesDisplay}
                                      onChangeText={(text) => {
                                        const numMilestones = parseInt(text);
                                        if (text === '' || (numMilestones >= 9 && numMilestones <= 20)) {
                                          if (numMilestones >= 9 && numMilestones <= 20) {
                                            // Get deposit milestone (no separate final for milestone-based)
                                            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                            
                                            // Calculate remaining percentage for milestones (including final)
                                            const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? (depositMilestone.paymentAmount / grandTotal) * 100 : 0);
                                            const remainingPct = 100 - depositPct;
                                            
                                            // Calculate per-milestone percentage (last one will be final)
                                            const newMilestonePct = remainingPct > 0 && numMilestones > 0 ? remainingPct / numMilestones : 0;
                                            const newMilestoneAmount = roundPayment((grandTotal * newMilestonePct) / 100);
                                            
                                            // Create milestones - last one is the final payment
                                            const newMilestones = Array.from({ length: numMilestones }, (_, i) => {
                                              const isLast = i === numMilestones - 1;
                                              return {
                                                id: `milestone-progress-${Date.now()}-${i}`,
                                                name: isLast ? 'Final Payment' : `Milestone ${i + 1}`,
                                                paymentAmount: newMilestoneAmount,
                                                percentage: newMilestonePct,
                                                amount: newMilestoneAmount,
                                                type: isLast ? 'final' : undefined,
                                              };
                                            });
                                            
                                            // Combine with deposit
                                            let updatedMilestones = [];
                                            if (depositMilestone) {
                                              updatedMilestones.push(depositMilestone);
                                            }
                                            updatedMilestones = updatedMilestones.concat(newMilestones);
                                            
                                            updateBid('paymentMilestones', updatedMilestones);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          } else if (text === '') {
                                            // Clear progress milestones if empty
                                            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                            const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                            let updatedMilestones = [];
                                            if (depositMilestone) {
                                              updatedMilestones.push(depositMilestone);
                                            }
                                            if (finalMilestone) {
                                              updatedMilestones.push(finalMilestone);
                                            }
                                            updateBid('paymentMilestones', updatedMilestones);
                                          }
                                        }
                                      }}
                                      placeholder="Enter milestones (9-20)"
                                      placeholderTextColor={Colors.sub}
                                      keyboardType="number-pad"
                                      style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderWidth: 1,
                                        borderColor: isCustomMilestones ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: Colors.text,
                                        fontSize: 14,
                                      }}
                                    />
                                  </View>
                                  {isCustomMilestones && (
                                    <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 100 }}>
                                      {milestonePctPerMilestone.toFixed(1)}% per milestone
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                            {progressMilestones.length > 0 && (
                              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Milestone</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{milestonePctPerMilestone.toFixed(1)}% ({money(progressMilestones[0]?.paymentAmount || 0)})</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Progress</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(progressMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0))})</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                    </>
                  ) : null}
                  
                  {/* Individual Milestone Cards */}
                  {milestones.length === 0 && scheduleType === 'hybrid' ? null : (
                    milestones.map((milestone, index) => {
                      // Calculate percentage if not set but amount is
                      let displayPercentage = milestone.percentage || 0;
                      if (!displayPercentage && milestone.paymentAmount && grandTotal > 0) {
                        displayPercentage = Math.round((milestone.paymentAmount / grandTotal) * 100);
                      }
                      
                      return (
                        <View key={milestone.id || index} style={[s.stepCard, { marginBottom: 12, position: 'relative' }]}>
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              flexDirection: 'row',
                              gap: 4,
                              zIndex: 10,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                handleEditMilestone(milestone);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={{ 
                                padding: 12,
                                minWidth: 44,
                                minHeight: 44,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              activeOpacity={0.6}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="create-outline" size={20} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteMilestone(milestone.id)}
                              style={{ 
                                padding: 12,
                                minWidth: 44,
                                minHeight: 44,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              activeOpacity={0.6}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="trash-outline" size={20} color="rgba(239, 68, 68, 0.6)" />
                            </TouchableOpacity>
                          </View>
                          
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8, paddingRight: 60 }}>
                        {milestone.name || `Milestone ${index + 1}`}
                      </Text>
                          {milestone.description && (
                            <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8 }}>
                              {milestone.description}
                            </Text>
                          )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {money(milestone.paymentAmount || 0)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {displayPercentage}%
                              </Text>
                            </View>
                      </View>
                      {milestone.scheduledDate && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                              <Ionicons name="calendar-outline" size={14} color={Colors.sub} />
                              <Text style={{ color: Colors.sub, fontSize: 12, marginLeft: 6 }}>
                                Due: {milestone.scheduledDate}
                        </Text>
                            </View>
                      )}
                    </View>
                      );
                    })
                  )}
                  
                  {milestones.length > 0 && scheduleType !== 'hybrid' && (
                    <View style={{
                      backgroundColor: 'rgba(45, 255, 196, 0.1)',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(45, 255, 196, 0.3)',
                      marginBottom: 12,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                          {money(milestoneTotal)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {(() => {
                            const isExactly100 = Math.abs(milestoneTotalPct - 100) < 0.01;
                            return (
                              <>
                                <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                                  {isExactly100 ? '100' : milestoneTotalPct.toFixed(1)}%
                                </Text>
                                {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                              </>
                            );
                          })()}
                        </View>
                      </View>
                      {grandTotal > 0 && Math.abs(milestoneTotal - grandTotal) > 1 && (
                        <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                          ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : null}
              
              {scheduleType === 'weekly' || (scheduleType === 'hybrid' && weeklyPayments.length > 0) ? (
                <View style={{ marginTop: scheduleType === 'hybrid' ? 24 : 0 }}>
                  {/* Upfront Deposit Card for Time-Based */}
                  {scheduleType === 'weekly' && weeklyPayments.length > 0 ? (
                    (() => {
                      const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                      if (depositPayment) {
                        const depositPct = depositPayment.percentage || (depositPayment.amount && grandTotal > 0 ? (depositPayment.amount / grandTotal) * 100 : 0);
                        const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                        
                        return (
                          <View style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 20, 
                            padding: 16, 
                            marginBottom: 16 
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                <Ionicons name="wallet-outline" size={18} color="#22c55e" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                                <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                              </View>
                            </View>
                            
                            <View>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {[15, 20, 25, 'Custom'].map((preset) => {
                                  const isSelected = preset === 'Custom' 
                                    ? isCustomDeposit 
                                    : depositPct === preset;
                                  const displayText = preset === 'Custom' 
                                    ? (isCustomDeposit ? `${Math.round(depositPct)}%` : 'Custom')
                                    : `${preset}%`;
                                  
                                  return (
                                    <TouchableOpacity
                                      key={preset}
                                      onPress={() => {
                                        if (preset !== 'Custom') {
                                          const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                          const depositAmount = roundPayment((grandTotal * newDepositPct) / 100);
                                          
                                          // Get all other weekly payments (excluding deposit)
                                          let otherPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                                          
                                          // Calculate total percentage of other payments
                                          const otherPaymentsPct = otherPayments.reduce((sum, p) => {
                                            const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                            return sum + pct;
                                          }, 0);
                                          
                                          // Calculate remaining percentage
                                          const remainingPct = 100 - newDepositPct;
                                          
                                          // ALWAYS recalculate other payments proportionally to keep total at 100%
                                          if (otherPayments.length > 0 && remainingPct > 0) {
                                            const scaleFactor = remainingPct / (otherPaymentsPct || 1);
                                            otherPayments = otherPayments.map(p => {
                                              const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                              const newPct = currentPct * scaleFactor;
                                              return {
                                                ...p,
                                                percentage: newPct,
                                                amount: roundPayment((grandTotal * newPct) / 100)
                                              };
                                            });
                                          } else if (otherPayments.length > 0 && remainingPct <= 0) {
                                            // If remaining is 0 or negative, set all other payments to 0
                                            otherPayments = otherPayments.map(p => ({
                                              ...p,
                                              percentage: 0,
                                              amount: 0
                                            }));
                                          }
                                          
                                          // Update deposit payment
                                          const updatedDeposit = {
                                            ...depositPayment,
                                            amount: depositAmount,
                                            percentage: newDepositPct
                                          };
                                          
                                          // Combine with other payments
                                          const updatedPayments = [updatedDeposit, ...otherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
                                          
                                          updateBid('weeklyPayments', updatedPayments);
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else {
                                          // Handle custom deposit input
                                          if (Platform.OS === 'ios') {
                                            Alert.prompt(
                                              'Custom Deposit',
                                              'Enter deposit percentage (0-50):',
                                              [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                  text: 'Set',
                                                  onPress: (text) => {
                                                    const numPct = parseInt(text);
                                                    if (text && numPct >= 0 && numPct <= 50) {
                                                      const depositAmount = roundPayment((grandTotal * numPct) / 100);
                                                      
                                                      // Get all other weekly payments (excluding deposit)
                                                      let otherPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                                                      
                                                      // Calculate total percentage of other payments
                                                      const otherPaymentsPct = otherPayments.reduce((sum, p) => {
                                                        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                                        return sum + pct;
                                                      }, 0);
                                                      
                                                      // Calculate remaining percentage
                                                      const remainingPct = 100 - numPct;
                                                      
                                                      // ALWAYS recalculate other payments proportionally to keep total at 100%
                                                      if (otherPayments.length > 0 && remainingPct > 0) {
                                                        const scaleFactor = remainingPct / (otherPaymentsPct || 1);
                                                        otherPayments = otherPayments.map(p => {
                                                          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                                          const newPct = currentPct * scaleFactor;
                                                          return {
                                                            ...p,
                                                            percentage: newPct,
                                                            amount: roundPayment((grandTotal * newPct) / 100)
                                                          };
                                                        });
                                                      } else if (otherPayments.length > 0 && remainingPct <= 0) {
                                                        // If remaining is 0 or negative, set all other payments to 0
                                                        otherPayments = otherPayments.map(p => ({
                                                          ...p,
                                                          percentage: 0,
                                                          amount: 0
                                                        }));
                                                      }
                                                      
                                                      // Update deposit payment
                                                      const updatedDeposit = {
                                                        ...depositPayment,
                                                        amount: depositAmount,
                                                        percentage: numPct
                                                      };
                                                      
                                                      // Combine with other payments
                                                      const updatedPayments = [updatedDeposit, ...otherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
                                                      
                                                      updateBid('weeklyPayments', updatedPayments);
                                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    } else {
                                                      Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                    }
                                                  }
                                                }
                                              ],
                                              'plain-text',
                                              isCustomDeposit ? Math.round(depositPct).toString() : ''
                                            );
                                          } else {
                                            Alert.alert('Custom Deposit', 'Enter deposit percentage (0-50):', [
                                              { text: 'Cancel', style: 'cancel' },
                                              {
                                                text: 'Set',
                                                onPress: () => {
                                                  Alert.alert('Not supported', 'Custom input requires iOS. Please edit the payment manually.');
                                                }
                                              }
                                            ]);
                                          }
                                        }
                                      }}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isSelected ? '#38d39f' : 'rgba(255, 255, 255, 0.15)',
                                        backgroundColor: isSelected ? 'rgba(56, 211, 159, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                      }}
                                    >
                                      <Text style={{ 
                                        color: isSelected ? '#38d39f' : Colors.text, 
                                        fontSize: 13, 
                                        fontWeight: isSelected ? '700' : '600',
                                        textAlign: 'center',
                                      }}>
                                        {displayText}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })()
                  ) : null}
                  
                  {/* Weekly Progress Payments Card for Time-Based */}
                  {scheduleType === 'weekly' && weeklyPayments.length > 0 ? (
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Weekly Progress Payments</Text>
                          <Text style={{ color: Colors.sub, fontSize: 11 }}>Keeps cash flow steady during work</Text>
                        </View>
                      </View>
                      
                      {(() => {
                        // For time-based, check if there's a deposit (weekNumber 0 or description includes 'deposit')
                        const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                        const depositPct = depositPayment?.percentage || (depositPayment?.amount && grandTotal > 0 ? Math.round((depositPayment.amount / grandTotal) * 100) : 0);
                        // Remaining percentage for weekly payments (excluding deposit if present)
                        const remainingPct = 100 - depositPct;
                        // Count only progress weekly payments (excluding deposit)
                        const progressPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                        const weeks = progressPayments.length || weeklyPayments.length || 4;
                        const weeklyPctPerWeek = weeks > 0 ? remainingPct / weeks : 0;
                        const isCustomWeeks = weeks > 12;
                        const customWeeksDisplay = isCustomWeeks ? weeks.toString() : '';
                        
                        return (
                          <View>
                            <View style={{ marginBottom: 12 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Weeks</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((weekCount) => (
                                  <TouchableOpacity
                                    key={weekCount}
                                    onPress={() => {
                                      // Preserve deposit if it exists
                                      const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                      const depositPct = depositPayment?.percentage || 0;
                                      const remainingPct = 100 - depositPct;
                                      
                                      const newWeeklyPct = remainingPct / weekCount;
                                      const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                      
                                      // Create new weekly payments array
                                      let newWeekly = [];
                                      if (depositPayment) {
                                        newWeekly.push(depositPayment);
                                      }
                                      newWeekly = newWeekly.concat(Array.from({ length: weekCount }, (_, i) => ({
                                        id: `weekly-${Date.now()}-${i}`,
                                        weekNumber: i + 1,
                                        description: `Week ${i + 1} Payment`,
                                        amount: newWeeklyAmount,
                                        percentage: newWeeklyPct,
                                      })));
                                      updateBid('weeklyPayments', newWeekly);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                      minWidth: 50,
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      borderRadius: 12,
                                      backgroundColor: !isCustomWeeks && weeks === weekCount ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                      borderWidth: 1,
                                      borderColor: !isCustomWeeks && weeks === weekCount ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: !isCustomWeeks && weeks === weekCount ? '#3b82f6' : Colors.text, fontSize: 12, fontWeight: !isCustomWeeks && weeks === weekCount ? '700' : '600' }}>
                                      {weekCount}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              
                              {/* Custom Weeks Input */}
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (13+ weeks)</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <TextInput
                                      key={`custom-weeks-input-${weeks}`}
                                      defaultValue={customWeeksDisplay}
                                      onChangeText={(text) => {
                                        const numWeeks = parseInt(text);
                                        if (text === '' || (numWeeks >= 13 && numWeeks <= 52)) {
                                          if (numWeeks >= 13 && numWeeks <= 52) {
                                            // Preserve deposit if it exists
                                            const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                            const depositPct = depositPayment?.percentage || 0;
                                            const remainingPct = 100 - depositPct;
                                            
                                            const newWeeklyPct = remainingPct / numWeeks;
                                            const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                            
                                            // Create new weekly payments array
                                            let newWeekly = [];
                                            if (depositPayment) {
                                              newWeekly.push(depositPayment);
                                            }
                                            newWeekly = newWeekly.concat(Array.from({ length: numWeeks }, (_, i) => ({
                                              id: `weekly-${Date.now()}-${i}`,
                                              weekNumber: i + 1,
                                              description: `Week ${i + 1} Payment`,
                                              amount: newWeeklyAmount,
                                              percentage: newWeeklyPct,
                                            })));
                                            updateBid('weeklyPayments', newWeekly);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          } else if (text === '') {
                                            // Clear if empty (but preserve deposit if exists)
                                            const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                            if (depositPayment) {
                                              updateBid('weeklyPayments', [depositPayment]);
                                            } else {
                                              updateBid('weeklyPayments', []);
                                            }
                                          }
                                        }
                                      }}
                                      placeholder="Enter weeks (13-52)"
                                      placeholderTextColor={Colors.sub}
                                      keyboardType="number-pad"
                                      style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderWidth: 1,
                                        borderColor: isCustomWeeks ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: Colors.text,
                                        fontSize: 14,
                                      }}
                                    />
                                  </View>
                                  {isCustomWeeks && (
                                    <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 80 }}>
                                      {weeklyPctPerWeek.toFixed(1)}% per week
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                            {progressPayments.length > 0 && (
                              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Week</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{weeklyPctPerWeek.toFixed(1)}% ({money(progressPayments[0]?.amount || weeklyPayments.find(w => w.weekNumber !== 0)?.amount || 0)})</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Weekly</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(progressPayments.reduce((sum, w) => sum + (w.amount || 0), 0) || weeklyTotal)})</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  ) : null}
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={[s.label, { marginBottom: 4 }]}>Weekly Payments</Text>
                      {weeklyPayments.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          {(() => {
                            const displayPct = scheduleType === 'hybrid' ? combinedTotalPct : weeklyTotalPct;
                            const isExactly100 = Math.abs(displayPct - 100) < 0.01;
                            return (
                              <Text style={{ color: isExactly100 ? '#22c55e' : displayPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                                Total: {isExactly100 ? '100' : displayPct.toFixed(1)}% {isExactly100 ? '✅' : displayPct > 100 ? '⚠️' : ''}
                              </Text>
                            );
                          })()}
                          {remainingPctWeekly > 0 && scheduleType === 'weekly' && (
                            <TouchableOpacity
                              onPress={() => {
                                // Auto-balance: distribute remaining percentage evenly across all weekly payments
                                if (weeklyPayments.length > 0) {
                                  const perPayment = remainingPctWeekly / weeklyPayments.length;
                                  const updatedPayments = weeklyPayments.map(p => {
                                    const currentPct = p.percentage || (p.amount && grandTotal > 0 ? Math.round((p.amount / grandTotal) * 100) : 0);
                                    return {
                                      ...p,
                                      percentage: currentPct + perPayment,
                                      amount: grandTotal > 0 ? ((currentPct + perPayment) / 100) * grandTotal : p.amount
                                    };
                                  });
                                  updateBid('weeklyPayments', updatedPayments);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text style={{ color: '#22d3ee', fontSize: 11, fontWeight: '600' }}>
                                Remaining: {remainingPctWeekly.toFixed(1)}% • Auto-Fix
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {weeklyPayments.length > 0 && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Clear Weekly Payments',
                              'This will remove all weekly payments. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Clear',
                                  style: 'destructive',
                                  onPress: () => {
                                    updateBid('weeklyPayments', []);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                          <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  {weeklyPayments.length === 0 && scheduleType !== 'hybrid' ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        <TouchableOpacity
                          onPress={() => {
                            const depositPct = 20;
                            const weeks = 4;
                            const remainingPct = 100 - depositPct;
                            const pctPerWeek = remainingPct / weeks; // 20% per week
                            
                            // Calculate deposit amount
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            
                            // Calculate amounts for first (weeks - 1) weekly payments
                            const amountPerWeek = roundPayment((grandTotal * pctPerWeek) / 100);
                            const weeklyPayments = Array.from({ length: weeks - 1 }, (_, i) => ({
                              id: `weekly-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: amountPerWeek,
                              percentage: pctPerWeek,
                            }));
                            
                            // Calculate sum of deposit + first (weeks - 1) payments
                            const sumOfFirstPayments = depositAmount + (amountPerWeek * (weeks - 1));
                            
                            // Make last weekly payment equal to grandTotal - sum of all others (ensures exact 100%)
                            const lastWeekAmount = roundPayment(grandTotal - sumOfFirstPayments);
                            const lastWeekPct = grandTotal > 0 ? (lastWeekAmount / grandTotal) * 100 : 0;
                            
                            const newPayments = [
                              {
                                id: `weekly-deposit-${Date.now()}`,
                                weekNumber: 0,
                                description: 'Deposit',
                                amount: depositAmount,
                                percentage: depositPct,
                              },
                              ...weeklyPayments,
                              {
                                id: `weekly-${Date.now()}-${weeks - 1}`,
                                weekNumber: weeks,
                                description: `Week ${weeks} Payment`,
                                amount: lastWeekAmount,
                                percentage: lastWeekPct,
                              }
                            ];
                            updateBid('weeklyPayments', newPayments);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Deposit + Weekly</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                              }}>
                                <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>RECOMMENDED</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>Protects cash flow and covers upfront costs</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : weeklyPayments.length === 0 && scheduleType === 'hybrid' ? null : (
                    weeklyPayments.map((payment, index) => {
                      // Calculate percentage if not set but amount is
                      let displayPercentage = payment.percentage || 0;
                      if (!displayPercentage && payment.amount && grandTotal > 0) {
                        displayPercentage = Math.round((payment.amount / grandTotal) * 100);
                      }
                      
                      return (
                        <View key={payment.id || index} style={[s.stepCard, { marginBottom: 12, position: 'relative' }]}>
                          <View
                            style={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              flexDirection: 'row',
                              gap: 8,
                              zIndex: 10,
                            }}
                            pointerEvents="box-none"
                          >
                            <TouchableOpacity
                              onPress={() => {
                                handleEditWeeklyPayment(payment);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="create-outline" size={18} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteWeeklyPayment(payment.id)}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="trash-outline" size={18} color="rgba(239, 68, 68, 0.6)" />
                            </TouchableOpacity>
                          </View>
                          
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8, paddingRight: 60 }}>
                            {payment.description || `Week ${payment.weekNumber || index + 1} Payment`}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {money(payment.amount || 0)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Percentage</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {displayPercentage}%
                              </Text>
                            </View>
                      </View>
                      {payment.scheduledDate && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                              <Ionicons name="calendar-outline" size={14} color={Colors.sub} />
                              <Text style={{ color: Colors.sub, fontSize: 12, marginLeft: 6 }}>
                                Due: {payment.scheduledDate}
                        </Text>
                            </View>
                      )}
                    </View>
                      );
                    })
                  )}
                  
                  {weeklyPayments.length > 0 && scheduleType !== 'hybrid' && (
                    <View style={{
                      backgroundColor: 'rgba(45, 255, 196, 0.1)',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(45, 255, 196, 0.3)',
                      marginBottom: 12,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                          {money(weeklyTotal)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {(() => {
                            const isExactly100 = Math.abs(weeklyTotalPct - 100) < 0.01;
                            return (
                              <>
                                <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                                  {isExactly100 ? '100' : weeklyTotalPct.toFixed(1)}%
                                </Text>
                                {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                              </>
                            );
                          })()}
                        </View>
                      </View>
                      {grandTotal > 0 && Math.abs(weeklyTotal - grandTotal) > 1 && (
                        <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                          ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : null}
              
              {/* Hybrid mode combined total */}
              {scheduleType === 'hybrid' && (milestones.length > 0 || weeklyPayments.length > 0) && (
                <View style={[s.stepCard, { backgroundColor: Math.abs(combinedTotalPct - 100) < 0.01 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderColor: Math.abs(combinedTotalPct - 100) < 0.01 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)', marginTop: 16 }]}>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12 }}>Combined Total</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                      {money(milestoneTotal + weeklyTotal)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {(() => {
                        const isExactly100 = Math.abs(combinedTotalPct - 100) < 0.01;
                        return (
                          <>
                            <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                              {isExactly100 ? '100' : combinedTotalPct.toFixed(1)}%
                            </Text>
                            {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                          </>
                        );
                      })()}
                    </View>
                  </View>
                  {grandTotal > 0 && Math.abs((milestoneTotal + weeklyTotal) - grandTotal) > 1 && (
                    <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                      ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                    </Text>
                  )}
                </View>
              )}
              
              {/* Legal Protection Disclaimer */}
              {(milestones.length > 0 || weeklyPayments.length > 0) && (
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="information-circle-outline" size={14} color={Colors.sub} style={{ marginRight: 6, marginTop: 2, opacity: 0.6 }} />
                      <Text style={{ color: Colors.sub, fontSize: 10, lineHeight: 16, flex: 1, opacity: 0.8 }}>
                        ℹ️ Payment schedules vary by contract and jurisdiction. Review before sending.
                      </Text>
                    </View>
                </View>
              )}
            </GlassBorderCard>
          </View>
        );
      }
      
      case 8: {
        const aiLevel = healthScore >= 75 ? 'good' : healthScore >= 55 ? 'warn' : 'risk';
        
        // Calculate diagnostic reasons for health score
        const diagnosticReasons = [];
        const totalOverhead = (bid.insuranceOverhead || 0) + (bid.equipment || 0) + (bid.facilities || 0) + (bid.otherOverhead || 0);
        const netProfit = (calc?.profit || 0) - totalOverhead;
        const netProfitPct = calc?.subtotal > 0 ? (netProfit / calc.subtotal) * 100 : 0;
        const laborRatio = calc?.total > 0 ? (calc?.labor || 0) / calc.total : 0;
        
        // Check payment schedule completion
        let paymentComplete = false;
        let paymentScheduleType = 'None';
        if (bid.paymentSchedule === 'milestone-based') {
          const totalPct = bid.paymentMilestones?.reduce((sum, m) => sum + (m.percentage || 0), 0) || 0;
          paymentComplete = Math.abs(totalPct - 100) < 0.1;
          paymentScheduleType = 'Milestone-based';
        } else if (bid.paymentSchedule === 'weekly') {
          const totalScheduled = bid.weeklyPayments?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
          paymentComplete = calc?.total > 0 && Math.abs(calc.total - totalScheduled) < 1;
          paymentScheduleType = 'Weekly';
        }
        
        // Generate diagnostic reasons based on score factors
        if (netProfitPct < 8) {
          diagnosticReasons.push({ icon: '⚠️', text: 'Low margin buffer' });
        }
        if (laborRatio > 0.6) {
          diagnosticReasons.push({ icon: '⏱️', text: 'High labor exposure' });
        }
        if (!paymentComplete) {
          diagnosticReasons.push({ icon: '💸', text: 'Payment schedule incomplete' });
        } else if (bid.paymentSchedule === 'milestone-based' && bid.paymentMilestones?.length > 0) {
          const lastMilestone = bid.paymentMilestones[bid.paymentMilestones.length - 1];
          const lastPct = lastMilestone?.percentage || 0;
          if (lastPct > 30) {
            diagnosticReasons.push({ icon: '💸', text: 'Back-loaded payments' });
          }
        }
        if ((calc?.materials || 0) === 0 && (calc?.labor || 0) === 0) {
          diagnosticReasons.push({ icon: '📋', text: 'Missing cost details' });
        }
        
        // Check for missing customer information
        const missingCustomerFields = [];
        if (!bid.customerEmail) missingCustomerFields.push('email');
        if (!bid.customerPhone) missingCustomerFields.push('phone');
        if (!bid.customerAddress) missingCustomerFields.push('address');
        if (!bid.customerCity) missingCustomerFields.push('city');
        if (!bid.customerState) missingCustomerFields.push('state');
        if (!bid.customerZip) missingCustomerFields.push('zip');
        if (!bid.customerCompany) missingCustomerFields.push('company');
        if (!bid.customerNotes) missingCustomerFields.push('notes');
        if (!bid.customerName) missingCustomerFields.push('name');
        
        if (missingCustomerFields.length > 0) {
          const fieldCount = missingCustomerFields.length;
          if (fieldCount >= 5) {
            diagnosticReasons.push({ icon: '📝', text: `Missing ${fieldCount} customer fields` });
          } else if (fieldCount >= 3) {
            diagnosticReasons.push({ icon: '📝', text: 'Incomplete customer info' });
          }
        }
        
        // Check for missing project dates
        if (!startDate && !endDate) {
          diagnosticReasons.push({ icon: '📅', text: 'Project dates not set' });
        } else if (!startDate || !endDate) {
          diagnosticReasons.push({ icon: '📅', text: 'Incomplete date range' });
        }
        
        // Calculate project duration (check startDate/endDate from step 2, or fallback to projectStartDate/projectEndDate)
        let durationText = 'Not set';
        const startDate = bid.startDate || bid.projectStartDate;
        const endDate = bid.endDate || bid.projectEndDate;
        if (startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T00:00:00');
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          const weeks = Math.ceil(days / 7);
          durationText = weeks > 0 ? `${weeks} week${weeks !== 1 ? 's' : ''}` : `${days} day${days !== 1 ? 's' : ''}`;
        } else if (bid.projectDuration) {
          durationText = `${bid.projectDuration} week${bid.projectDuration !== 1 ? 's' : ''}`;
        } else if (startDate || endDate) {
          // If only one date is set, show partial info
          durationText = startDate ? 'Start date set' : 'End date set';
        }
        
        // Pre-flight checklist items
        const checklistItems = [];
        if (paymentComplete) {
          checklistItems.push({ checked: true, text: 'Payment schedule totals 100%', isWarning: false });
        } else {
          checklistItems.push({ checked: false, text: 'Payment schedule totals 100%', isWarning: true });
        }
        if (calc?.profit && calc.profit > 0) {
          checklistItems.push({ checked: true, text: 'Margin calculated successfully', isWarning: false });
        } else {
          checklistItems.push({ checked: false, text: 'Margin calculated successfully', isWarning: true });
        }
        if (healthScore < 60) {
          checklistItems.push({ checked: false, text: 'Health score below recommended threshold', isWarning: true });
        }
        
        // Check if all items are complete
        const allChecklistItemsComplete = checklistItems.every(item => item.checked);
        
        // AI Insight text (refined to sound more advisor-like)
        let aiInsightText = '';
        if (aiLevel === 'good') {
          aiInsightText = 'This bid is well-structured with solid margins and complete payment terms. Ready for client review.';
        } else if (aiLevel === 'warn') {
          aiInsightText = 'This bid carries moderate risk due to margin and payment structure. Adjusting markup or shifting payments earlier can improve protection.';
        } else {
          aiInsightText = 'This bid is vulnerable to cost overruns and delayed payments. Adjusting markup or shifting payments earlier would improve protection.';
        }
        
        // Calculate cost overrun cushion (net profit percentage as buffer)
        const costOverrunCushion = netProfitPct;
        
        // Health Score Breakdown calculations
        const marginStrength = netProfitPct >= 15 ? 'Strong' : netProfitPct >= 10 ? 'Moderate' : netProfitPct >= 5 ? 'Weak' : 'Very Weak';
        const paymentTiming = paymentScheduleType === 'Milestone-based' 
          ? (bid.paymentMilestones?.some(m => m.type === 'deposit') 
            ? 'Milestone-based, low exposure' 
            : 'Milestone-based, moderate exposure')
          : paymentScheduleType === 'Weekly'
          ? 'Weekly, low exposure'
          : 'Not set, high exposure';
        const costVolatility = (calc?.materials || 0) > (calc?.labor || 0) ? 'Material-heavy, remodel-level risk' : 
                              (calc?.labor || 0) > (calc?.materials || 0) ? 'Labor-heavy, moderate risk' :
                              'Balanced, low risk';
        const readiness = durationText !== 'Not set' ? 'Duration defined' : 'Duration not defined';
        
        // Predictive micro-simulation: if costs rise 10%, projected profit
        const currentSubtotal = calc?.subtotal || 0;
        const currentBidTotal = calc?.total || 0;
        const costIncrease10Pct = currentSubtotal * 1.1;
        const projectedProfit10Pct = currentBidTotal - costIncrease10Pct;
        const projectedProfitPct10Pct = currentBidTotal > 0 ? (projectedProfit10Pct / currentBidTotal) * 100 : 0;
        
        // AI Recommendations with score improvements
        const aiRecommendations = [];
        
        // Check if deposit exists (more robust check)
        const hasDepositMilestone = bid.paymentMilestones?.some(m => {
          const isDepositType = m.type === 'deposit';
          const hasDepositName = m.name && (m.name.toLowerCase().includes('deposit') || m.name.toLowerCase().includes('down payment'));
          const isFirstMilestoneWithLowPct = bid.paymentMilestones.indexOf(m) === 0 && (m.percentage || 0) <= 30 && (m.percentage || 0) >= 10;
          return isDepositType || hasDepositName || isFirstMilestoneWithLowPct;
        });
        
        const hasDepositWeekly = bid.weeklyPayments?.some(w => {
          const isDepositWeek = w.weekNumber === 0;
          const hasDepositDesc = w.description && (w.description.toLowerCase().includes('deposit') || w.description.toLowerCase().includes('down payment'));
          return isDepositWeek || hasDepositDesc;
        });
        
        const hasGoodPaymentStructure = (bid.paymentSchedule === 'milestone-based' && hasDepositMilestone && paymentComplete) ||
                                        (bid.paymentSchedule === 'weekly' && hasDepositWeekly && paymentComplete);
        
        // Only suggest payment improvements if payment structure is missing something
        if (!hasGoodPaymentStructure) {
          if (bid.paymentSchedule === 'milestone-based' && !hasDepositMilestone && bid.paymentMilestones && bid.paymentMilestones.length > 0) {
            aiRecommendations.push({ 
              icon: '🔧', 
              text: 'Add a 20% deposit', 
              scoreGain: '+8',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          } else if (bid.paymentSchedule === 'weekly' && !hasDepositWeekly) {
            aiRecommendations.push({ 
              icon: '📅', 
              text: 'Add deposit to weekly schedule', 
              scoreGain: '+8',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          }
          
          // Only suggest switching if current structure is incomplete
          if (!paymentComplete && bid.paymentSchedule === 'milestone-based') {
            aiRecommendations.push({ 
              icon: '📅', 
              text: 'Switch to Deposit + Weekly', 
              scoreGain: '+10',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          }
        }
        
        // Check markup
        const currentMarkup = bid.markupPct || 0;
        if (currentMarkup < 19) {
          aiRecommendations.push({ 
            icon: '📈', 
            text: `Increase markup to 19%`, 
            scoreGain: '+6',
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          });
        }
        
        // Check duration - only recommend if both start and end dates are missing
        // Note: startDate and endDate are already declared above in the duration calculation section
        if (!startDate || !endDate) {
          const missingDateCount = (!startDate ? 1 : 0) + (!endDate ? 1 : 0);
          const scoreGain = missingDateCount === 2 ? '+10' : '+5';
          aiRecommendations.push({ 
            icon: '⏱', 
            text: missingDateCount === 2 ? 'Set project dates' : 'Complete date range', 
            scoreGain: scoreGain,
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to step 2 (Project Information)
              setStep(2);
            }
          });
        }
        
        // Check for missing customer information
        const missingCustomerInfo = [];
        if (!bid.customerName) missingCustomerInfo.push({ field: 'name', points: 3 });
        if (!bid.customerEmail) missingCustomerInfo.push({ field: 'email', points: 2 });
        if (!bid.customerPhone) missingCustomerInfo.push({ field: 'phone', points: 2 });
        if (!bid.customerAddress) missingCustomerInfo.push({ field: 'address', points: 2 });
        if (!bid.customerCity) missingCustomerInfo.push({ field: 'city', points: 1.5 });
        if (!bid.customerState) missingCustomerInfo.push({ field: 'state', points: 1.5 });
        if (!bid.customerZip) missingCustomerInfo.push({ field: 'zip', points: 1.5 });
        if (!bid.customerCompany) missingCustomerInfo.push({ field: 'company', points: 1.5 });
        if (!bid.customerNotes) missingCustomerInfo.push({ field: 'notes', points: 1 });
        
        if (missingCustomerInfo.length > 0) {
          const totalPoints = missingCustomerInfo.reduce((sum, item) => sum + item.points, 0);
          const scoreGain = `+${Math.round(totalPoints)}`;
          const fieldNames = missingCustomerInfo.map(item => item.field).join(', ');
          aiRecommendations.push({ 
            icon: '📝', 
            text: `Complete customer info (${missingCustomerInfo.length} fields)`, 
            scoreGain: scoreGain,
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to step 1 (Customer Information)
              setStep(1);
            }
          });
        }
        
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <MaterialIcons name="description" size={22} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Final Bid & Contract</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Health score, contract generation & export</Text>
                </View>
              </View>
              
              {/* 1. Upgraded Health Score Diagnostic Card */}
              <View style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderWidth: 2,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 20,
                padding: 20,
                marginBottom: 20,
                alignItems: 'center',
              }}>
                <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8, fontWeight: '600', letterSpacing: 1 }}>
                  HEALTH SCORE
                </Text>
                <View style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 4,
                  borderColor: healthScore < 50 ? '#ef4444' : healthScore < 70 ? '#fbbf24' : '#38d39f',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <Text style={{ color: healthColor, fontSize: 48, fontWeight: '700' }}>
                    {healthScore}
                  </Text>
                </View>
                <Text style={{ color: Colors.sub, fontSize: 14, marginBottom: 4 }}>
                  {aiLevel === 'good' ? 'Ready to send' : aiLevel === 'warn' ? 'Moderate risk — optimizable' : 'Needs attention'}
                </Text>
                {projectedProfit10Pct > 0 && (
                  <Text style={{ color: Colors.sub, fontSize: 11, opacity: 0.7, marginBottom: 8, textAlign: 'center' }}>
                    If costs rise 10%, projected profit: {money(projectedProfit10Pct)} ({projectedProfitPct10Pct.toFixed(1)}%)
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setHealthScoreBreakdownExpanded(!healthScoreBreakdownExpanded);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{ width: '100%', marginTop: 8 }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Text style={{ color: Colors.sub, fontSize: 11, opacity: 0.7, fontWeight: '600' }}>
                      Why this score
                    </Text>
                    <MaterialIcons
                      name={healthScoreBreakdownExpanded ? 'expand-less' : 'expand-more'}
                      size={16}
                      color={Colors.sub}
                      style={{ opacity: 0.7 }}
                    />
                  </View>
                </TouchableOpacity>
                
                {healthScoreBreakdownExpanded && (
                  <View style={{ width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 12, textAlign: 'left', width: '100%' }}>
                      Health Score Breakdown
                    </Text>
                    <View style={{ width: '100%', gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Margin strength:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                          {marginStrength} ({netProfitPct.toFixed(1)}%)
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Payment timing:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                          {paymentTiming}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Cost volatility:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                          {costVolatility}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Readiness:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                          {readiness}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                
                {/* Diagnostic Reason Chips */}
                {diagnosticReasons.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                    {diagnosticReasons.map((reason, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12 }}>{reason.icon}</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600' }}>{reason.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              
              {/* 2. AI Insight Line */}
              <View style={{
                backgroundColor: 'rgba(56, 211, 159, 0.1)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(56, 211, 159, 0.2)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <MaterialIcons name="lightbulb" size={18} color="#38d39f" style={{ marginTop: 2 }} />
                  <Text style={{ color: Colors.text, fontSize: 13, lineHeight: 20, flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#38d39f' }}>AI Insight: </Text>
                    {aiInsightText}
                  </Text>
                </View>
              </View>
              
              {/* AI Recommendations (Fix-It Actions) */}
              {aiRecommendations.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 }}>
                    AI Recommendations
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {aiRecommendations.map((rec, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={rec.action}
                        style={{
                          flex: 1,
                          minWidth: '47%',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: 'rgba(56, 211, 159, 0.1)',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(56, 211, 159, 0.3)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16 }}>{rec.icon}</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', flex: 1 }}>
                          {rec.text}
                        </Text>
                        <Text style={{ color: '#38d39f', fontSize: 11, fontWeight: '700' }}>
                          {rec.scoreGain}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              {/* 3. Bid Snapshot Card */}
              <View style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderWidth: 2,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <MaterialIcons name="receipt" size={18} color={Colors.sub} style={{ marginRight: 8 }} />
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Bid Snapshot</Text>
                </View>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Bid:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{money(calc?.total || 0)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Estimated Net Profit:</Text>
                    <Text style={{ color: netProfit >= 0 ? '#38d39f' : '#ff7a7a', fontSize: 12, fontWeight: '700' }}>
                      {money(netProfit)} ({netProfitPct.toFixed(1)}%)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Payment Structure:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{paymentScheduleType}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Duration:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{durationText}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Cost Overrun Cushion:</Text>
                    <Text style={{ color: costOverrunCushion >= 10 ? '#38d39f' : costOverrunCushion >= 5 ? '#ffcc66' : '#ff7a7a', fontSize: 12, fontWeight: '700' }}>
                      ~{costOverrunCushion.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Optional: What affects this score? (Collapsible) */}
              <TouchableOpacity
                onPress={() => {
                  setScoreExplanationExpanded(!scoreExplanationExpanded);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  marginBottom: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>
                    What affects this score?
                  </Text>
                  <MaterialIcons
                    name={scoreExplanationExpanded ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={Colors.sub}
                  />
                </View>
                {scoreExplanationExpanded && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: Colors.sub, fontSize: 11 }}>•</Text>
                      <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Margin strength</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: Colors.sub, fontSize: 11 }}>•</Text>
                      <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Payment timing</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: Colors.sub, fontSize: 11 }}>•</Text>
                      <Text style={{ color: Colors.sub, fontSize: 11, flex: 1 }}>Cost volatility</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* 5. Pre-Flight Checklist */}
              {checklistItems.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 }}>
                    Pre-Flight Checklist {allChecklistItemsComplete && '(Ready to Send)'}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {checklistItems.map((item, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <MaterialIcons
                          name={item.checked ? 'check-circle' : item.isWarning ? 'warning' : 'radio-button-unchecked'}
                          size={18}
                          color={item.checked ? '#38d39f' : item.isWarning ? '#ffcc66' : Colors.sub}
                        />
                        <Text style={{
                          color: item.checked ? Colors.text : item.isWarning ? '#ffcc66' : Colors.sub,
                          fontSize: 12,
                          flex: 1,
                          fontWeight: item.isWarning ? '600' : '500',
                        }}>
                          {item.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {allChecklistItemsComplete && (
                    <Text style={{
                      color: '#38d39f',
                      fontSize: 11,
                      marginTop: 12,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      All required items are complete. This bid is ready to generate a client-facing contract.
                    </Text>
                  )}
                </View>
              )}
              
              {/* 4. Generate Contract CTA with Framing */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  color: Colors.sub,
                  fontSize: 12,
                  marginBottom: 8,
                  textAlign: 'center',
                  fontWeight: '600',
                }}>
                  Ready to generate client-facing contract
                </Text>
                <TouchableOpacity
                  onPress={generateContract}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons name="description" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      Generate Contract PDF
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={{
                  color: Colors.sub,
                  fontSize: 10,
                  marginTop: 6,
                  textAlign: 'center',
                  opacity: 0.7,
                }}>
                  Includes scope, pricing, payment schedule, and terms
                </Text>
              </View>
              
              {/* 8. Legal Safety Text */}
              <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <MaterialIcons name="info-outline" size={14} color={Colors.sub} style={{ marginTop: 2, opacity: 0.6 }} />
                  <Text style={{ color: Colors.sub, fontSize: 10, lineHeight: 16, flex: 1, opacity: 0.7 }}>
                    Health score and insights are estimates based on provided inputs. Review contract terms before client use.
                  </Text>
                </View>
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: Colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.3 }}>
              Bid Builder
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 14, marginTop: 6 }}>
              Build, review, and submit your bid
            </Text>
          </View>

          {/* + New (outline, iOS-grade) */}
          <LinearGradient
            colors={GRAD}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={{ borderRadius: 24, padding: 2 }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                backgroundColor: '#000000',
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
              onPress={async () => {
                // Haptic feedback for button press
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                
                // Save current bid automatically
                await backupCurrentEstimateSilently();
                
                // Clear bid fields and reset refs
                const nextBid = blankState();
                
                // Reset refs to prevent glitching
                lastSavedBidRef.current = null;
                if (pendingSaveRef.current) {
                  clearTimeout(pendingSaveRef.current);
                  pendingSaveRef.current = null;
                }
                
                // Clear state
                setMaterialsCart([]);
                setRentalCart([]);
                setBid(nextBid);
                setStep(0); // Start at Bid Summary (step 0)
                setActiveNavButton('summary');
                
                // Save blank state to AsyncStorage to prevent conflicts
                try {
                  await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(nextBid));
                  await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
                  await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
                } catch (error) {
                  console.warn('Failed to save new blank bid to storage:', error);
                }
              }}
            >
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>+ New</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Navigation Pill (matches dashboard segmented control) */}
        <View style={s.navPillBorder}>
          <BlurView intensity={35} tint="dark" style={{ borderRadius: 999 }}>
              <View style={s.navPillInner}>
                {/* Back button */}
                {activeNavButton === 'back' ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navBtn, s.navNextActive]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (step > 1) {
                          setStep(step - 1);
                          setActiveNavButton('back');
                        } else if (step === 1) {
                          // From step 1, can go back to step 0 (Bid Summary) if desired
                          setStep(0);
                          setActiveNavButton('summary');
                        }
                      }}
                      activeOpacity={0.85}
                      style={s.navBtnInner}
                      disabled={step === 0}
                    >
                      <Ionicons name="chevron-back" size={18} color="#050B13" />
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Back</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (step > 1) {
                        setStep(step - 1);
                        setActiveNavButton('back');
                      } else if (step === 1) {
                        // From step 1, can go back to step 0 (Bid Summary) if desired
                        setStep(0);
                        setActiveNavButton('summary');
                      }
                    }}
                    style={s.navBtn}
                    activeOpacity={0.85}
                    disabled={step === 0}
                  >
                    <View style={s.navBtnInner}>
                      <Ionicons name="chevron-back" size={18} color="#E5F7FF" />
                      <Text style={{ color: '#E5F7FF', fontSize: 15, fontWeight: '600' }}>Back</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Summary button */}
                {activeNavButton === 'summary' ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navCenterBtn, s.navNextActive]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setStep(0);
                        setActiveNavButton('summary');
                      }}
                      activeOpacity={0.85}
                      style={s.navCenterBtnInner}
                    >
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Summary</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setStep(0); // Go to Bid Summary (not a numbered step)
                      setActiveNavButton('summary');
                    }}
                    style={s.navCenterBtn}
                    activeOpacity={0.85}
                  >
                    <View style={s.navCenterBtnInner}>
                      <Text style={{ color: '#E5F7FF', fontSize: 15, fontWeight: '600' }}>Summary</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Next button */}
                {activeNavButton === 'next' && step < 8 && step !== 0 ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navNextWrap, s.navNextActive]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={s.navNextInner}
                      onPress={() => {
                        setStep(step + 1);
                        setActiveNavButton('next');
                      }}
                    >
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Next</Text>
                      <Ionicons name="arrow-forward" size={18} color="#050B13" />
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={s.navNextWrap}
                    onPress={() => {
                      if (step === 0) {
                        // From Bid Summary (step 0), go to Customer Information (step 1)
                        setStep(1);
                        setActiveNavButton('next');
                      } else if (step < 8) {
                        setStep(step + 1);
                        setActiveNavButton('next');
                      }
                    }}
                    disabled={step >= 8 && step !== 0}
                  >
                    <View style={s.navNextInner}>
                      <Text style={{ color: '#E5F7FF', fontSize: 15, fontWeight: '600' }}>Next</Text>
                      <Ionicons name="arrow-forward" size={18} color="#E5F7FF" />
                    </View>
                  </TouchableOpacity>
                )}
            </View>
          </BlurView>
        </View>
      </View>
      
      {/* Step Section Card with Icons - no border */}
      <View style={[s.wideContainer, { marginTop: 12 }]}>
        <View style={s.stepperPanelInner}>
          {/* Current Step Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(25, 225, 128, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
              <MaterialIcons name={getStepIcon(step)} size={20} color="#19E180" />
            </View>
            <View>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                {step === 0 ? 'Bid Summary' : STEPS[step - 1]?.title}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 12 }}>
                {step === 0 ? 'Financial breakdown and totals' : STEPS[step - 1]?.subtitle}
              </Text>
            </View>
          </View>
          
          {/* Step Icons Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {/* Bid Summary - Special icon without number, appears before step 1 */}
            <TouchableOpacity
              onPress={() => {
                setStep(0);
                setActiveNavButton('summary');
              }}
              style={{
                alignItems: 'center',
                marginHorizontal: 6,
                opacity: step === 0 ? 1 : 1,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: step === 0 ? 'rgba(25, 225, 128, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                borderWidth: step === 0 ? 2 : 1,
                borderColor: step === 0 ? '#19E180' : 'rgba(255, 255, 255, 0.25)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <MaterialIcons
                  name={getStepIcon(0)}
                  size={18}
                  color={step === 0 ? '#19E180' : 'rgba(229, 231, 235, 0.8)'}
                />
              </View>
              <Text style={{
                color: step === 0 ? '#19E180' : 'rgba(229, 231, 235, 0.8)',
                fontSize: 10,
                fontWeight: step === 0 ? '700' : '500',
              }}>
                S
              </Text>
            </TouchableOpacity>
            
            {/* Numbered Steps 1-8 */}
            {STEPS.map((stepItem) => (
              <TouchableOpacity
                key={stepItem.id}
                onPress={() => setStep(stepItem.id)}
                style={{
                  alignItems: 'center',
                  marginHorizontal: 6,
                  opacity: step === stepItem.id ? 1 : 1,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: step === stepItem.id ? 'rgba(25, 225, 128, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                  borderWidth: step === stepItem.id ? 2 : 1,
                  borderColor: step === stepItem.id ? '#19E180' : 'rgba(255, 255, 255, 0.25)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 4,
                }}>
                  <MaterialIcons
                    name={getStepIcon(stepItem.id)}
                    size={18}
                    color={step === stepItem.id ? '#19E180' : 'rgba(229, 231, 235, 0.8)'}
                  />
                </View>
                <Text style={{
                  color: step === stepItem.id ? '#19E180' : 'rgba(229, 231, 235, 0.8)',
                  fontSize: 10,
                  fontWeight: step === stepItem.id ? '700' : '500',
                }}>
                  {stepItem.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
      
        {/* Step Content */}
        {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Modals */}
      <LineItemModal
        visible={materialModal.visible}
        onClose={() => setMaterialModal({ visible: false, item: null })}
        item={materialModal.item}
        onSave={(item) => {
          if (materialModal.item) {
            setMaterialsCart(prev => prev.map(m => m.id === materialModal.item.id ? item : m));
          } else {
            setMaterialsCart(prev => [...prev, { ...item, id: Date.now().toString() }]);
          }
          setMaterialModal({ visible: false, item: null });
        }}
        title="Material"
        laborMode={false}
      />
      
      <LineItemModal
        visible={laborModal.visible}
        onClose={() => setLaborModal({ visible: false, item: null })}
        item={laborModal.item}
        onSave={(item) => {
          const updated = bid.laborLineItems || [];
          if (laborModal.item) {
            const index = updated.findIndex(l => l.id === laborModal.item.id);
            if (index >= 0) {
              updated[index] = item;
            }
          } else {
            updated.push({ ...item, id: Date.now().toString() });
          }
          updateBid('laborLineItems', updated);
          setLaborModal({ visible: false, item: null });
        }}
        title="Labor"
        laborMode={true}
      />
      
      {/* Payment Milestone Modal */}
      <PaymentMilestoneModal
        visible={milestoneModal.visible}
        onClose={() => setMilestoneModal({ visible: false, item: null })}
        item={milestoneModal.item}
        onSave={handleSaveMilestone}
        grandTotal={calc?.grandTotal || calc?.total || 0}
      />
      
      {/* Weekly Payment Modal */}
      <WeeklyPaymentModal
        visible={weeklyPaymentModal.visible}
        onClose={() => setWeeklyPaymentModal({ visible: false, item: null })}
        item={weeklyPaymentModal.item}
        onSave={handleSaveWeeklyPayment}
        grandTotal={calc?.grandTotal || calc?.total || 0}
      />
      
      {/* Recovery Modal - Full Page */}
      <Modal
        visible={showRecoveryModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowRecoveryModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          <StatusBar barStyle="light-content" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 200 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Header */}
            <View style={{ marginTop: 32, marginBottom: 18, marginHorizontal: -20, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 2,
                    marginRight: 12,
                    shadowColor: "#22c55e",
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowRecoveryModal(false);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 18,
                      backgroundColor: '#000000',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={20} color="#f9fafb" />
                  </TouchableOpacity>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f9fafb', fontSize: 34, fontWeight: '900', letterSpacing: -0.3 }}>
                    Restore
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 6 }}>
                    {savedEstimates.length} {savedEstimates.length === 1 ? 'saved bid' : 'saved bids'}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* List of Saved Estimates */}
            {savedEstimates.length === 0 ? (
              <View style={{
                padding: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                }}>
                  <Ionicons name="document-outline" size={40} color="#22c55e" />
                </View>
                <Text style={{ color: '#f9fafb', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                  No saved bids found
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
                  Save a bid to restore it later
                </Text>
              </View>
            ) : (
              <View style={{ marginHorizontal: -20, paddingHorizontal: 8 }}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 2 }}>
                    Saved Bids
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: '#8DA0B8' }}>
                    Tap to restore a saved bid
                  </Text>
                </View>
                
                {savedEstimates.map((item, index) => (
                  <LinearGradient
                    key={item.id}
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={{
                      borderRadius: 20,
                      padding: 1,
                      marginBottom: index < savedEstimates.length - 1 ? 12 : 0,
                      shadowColor: "#22c55e",
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        borderRadius: 19,
                        padding: 16,
                        backgroundColor: '#000000',
                      }}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        loadEstimate(item);
                        setShowRecoveryModal(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                            {item.title || 'Untitled Bid'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="person-outline" size={14} color="#8DA0B8" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#8DA0B8', fontSize: 13 }}>
                              {item.customer || item.customerName || 'Unknown Customer'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calendar-outline" size={14} color="#8DA0B8" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#8DA0B8', fontSize: 13 }}>
                              {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown date')}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
                            {money(item.total || item.grandTotal || 0)}
                          </Text>
                          <TouchableOpacity
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              borderWidth: 1,
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                            onPress={(e) => {
                              e.stopPropagation();
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              Alert.alert(
                                'Delete Bid?',
                                `Are you sure you want to delete "${item.title || 'Untitled Bid'}"?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => {
                                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                      deleteEstimate(item.id);
                                    },
                                  },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </LinearGradient>
                ))}
              </View>
            )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
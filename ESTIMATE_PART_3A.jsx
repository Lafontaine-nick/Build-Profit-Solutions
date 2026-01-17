/*
 * ESTIMATE GENERATOR - PART 3A of 5
 * 
 * This part contains (first half of original Part 3):
 * - Remaining UI components and rendering (beginning)
 * - Additional form components
 * - Modal rendering logic
 * 
 * Lines: 8268-10328 (approximately)
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

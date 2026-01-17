/*
 * ESTIMATE GENERATOR - PART 2 of 3
 * 
 * This part contains:
 * - Auto-adjustment logic for payment amounts
 * - Additional useEffect hooks
 * - UI rendering logic for various steps
 * - Form inputs and handlers
 * - Modal components
 * - Step navigation logic
 * 
 * Lines: 4134-8267
 */

  // Auto-adjust payment amounts when total bid price changes
  useEffect(() => {
    if (!isLoaded || !calc) return;
    
    // Skip auto-adjustment during initial load to prevent glitching
    if (isInitialLoadRef.current) {
      if (!bid.previousTotal && calc.total) {
        const silentBid = { ...bid, previousTotal: calc.total };
        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(silentBid)).catch(() => {});
      }
      return;
    }

    // Get current total from calc (most up-to-date)
    const currentTotal = calc.total || calc.grandTotal || 0;
    if (currentTotal <= 0) return;
    
    // Initialize previousTotal only if it doesn't exist
    if (!bid.previousTotal) {
      console.log(`🔧 Initializing previousTotal to ${currentTotal}`);
      updateBid('previousTotal', currentTotal);
      return; // Skip adjustment on first load
    }
    
    const previousTotal = bid.previousTotal || currentTotal;
    
    // Only adjust if total changed significantly (more than $1)
    if (Math.abs(currentTotal - previousTotal) > 1) {
      console.log(`💰 Total bid changed from $${previousTotal} to $${currentTotal}, adjusting payment amounts...`);
      
      // Get current payment schedule and payments (use latest from bid state)
      const scheduleType = bid.paymentSchedule;
      const currentMilestones = bid.paymentMilestones || [];
      const currentWeeklyPayments = bid.weeklyPayments || [];
      
      // Handle milestone-based payments - recalculate from percentages
      if (scheduleType === 'milestone-based' && currentMilestones.length > 0) {
        const updatedMilestones = currentMilestones.map(milestone => {
          // Get percentage (prioritize stored percentage, fallback to calculating from old amount)
          let percentage = milestone.percentage;
          if (!percentage && milestone.paymentAmount && previousTotal > 0) {
            percentage = (milestone.paymentAmount / previousTotal) * 100;
          }
          
          // Recalculate amount from percentage
          const newAmount = roundPayment((percentage / 100) * currentTotal);
          
          return {
            ...milestone,
            paymentAmount: newAmount,
            amount: newAmount,
            percentage: percentage || 0
          };
        });
        
        // Normalize to ensure exact total match
        const normalizedMilestones = normalizePaymentsToExactTotal(updatedMilestones, currentTotal, true);
        updateBid('paymentMilestones', normalizedMilestones);
        console.log(`✅ Payment amounts adjusted for ${normalizedMilestones.length} milestones`);
      }
      
      // Handle weekly payments - recalculate from percentages
      if (scheduleType === 'weekly' && currentWeeklyPayments.length > 0) {
        const updatedWeeklyPayments = currentWeeklyPayments.map(payment => {
          // Get percentage (prioritize stored percentage, fallback to calculating from old amount)
          let percentage = payment.percentage;
          if (!percentage && payment.amount && previousTotal > 0) {
            percentage = (payment.amount / previousTotal) * 100;
          }
          
          // Recalculate amount from percentage
          const newAmount = roundPayment((percentage / 100) * currentTotal);
          
          return {
            ...payment,
            amount: newAmount,
            percentage: percentage || 0
          };
        });
        
        // Normalize to ensure exact total match
        const normalizedWeekly = normalizePaymentsToExactTotal(updatedWeeklyPayments, currentTotal, false);
        updateBid('weeklyPayments', normalizedWeekly);
        console.log(`✅ Weekly payment amounts adjusted for ${normalizedWeekly.length} payments`);
      }
      
      // Handle hybrid payments - recalculate both milestones and weekly from percentages
      if (scheduleType === 'hybrid' && (currentMilestones.length > 0 || currentWeeklyPayments.length > 0)) {
        // Recalculate milestone amounts from percentages
        let updatedMilestones = [];
        if (currentMilestones.length > 0) {
          updatedMilestones = currentMilestones.map(milestone => {
            let percentage = milestone.percentage;
            if (!percentage && milestone.paymentAmount && previousTotal > 0) {
              percentage = (milestone.paymentAmount / previousTotal) * 100;
            }
            const newAmount = roundPayment((percentage / 100) * currentTotal);
            return {
              ...milestone,
              paymentAmount: newAmount,
              amount: newAmount,
              percentage: percentage || 0
            };
          });
        }
        
        // Recalculate weekly amounts from percentages
        let updatedWeekly = [];
        if (currentWeeklyPayments.length > 0) {
          updatedWeekly = currentWeeklyPayments.map(payment => {
            let percentage = payment.percentage;
            if (!percentage && payment.amount && previousTotal > 0) {
              percentage = (payment.amount / previousTotal) * 100;
            }
            const newAmount = roundPayment((percentage / 100) * currentTotal);
            return {
              ...payment,
              amount: newAmount,
              percentage: percentage || 0
            };
          });
        }
        
        // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
        const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, updatedWeekly, currentTotal);
        
        // Update both in single state update
        setBid(prev => {
          const updated = {
            ...prev,
            paymentMilestones: normalized.milestones,
            weeklyPayments: normalized.weeklyPayments,
            previousTotal: currentTotal
          };
          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        console.log(`✅ Hybrid payment amounts adjusted: ${normalized.milestones.length} milestones, ${normalized.weeklyPayments.length} weekly`);
      }
      
      // Store current total for next comparison (if not already updated in hybrid)
      if (scheduleType !== 'hybrid') {
        updateBid('previousTotal', currentTotal);
      }
      
      console.log(`🎯 Auto-adjusted payment amounts based on new total: $${currentTotal}`);
    }
  }, [calc?.total, calc?.grandTotal, isLoaded, bid.paymentSchedule]);


  // Shared health score calculation
  const healthScore = useMemo(() => {
    let points = 0;
    
    // Project Information (15 points)
    if (bid.title) points += 5;
    if (bid.projectDescription) points += 5;
    if (bid.customerCity || bid.location) points += 5;
    
    // Customer Information (16 points)
    if (bid.customerEmail) points += 2;
    if (bid.customerPhone) points += 2;
    if (bid.customerAddress) points += 2;
    if (bid.customerCity) points += 1.5;
    if (bid.customerState) points += 1.5;
    if (bid.customerZip) points += 1.5;
    if (bid.customerCompany) points += 1.5;
    if (bid.customerNotes) points += 1;
    if (bid.customerName) points += 3;
    
    // Project Dates (10 points)
    const startDate = bid.startDate || bid.projectStartDate;
    const endDate = bid.endDate || bid.projectEndDate;
    if (startDate) points += 5;
    if (endDate) points += 5;
    
    // Materials & Labor (20 points)
    if ((materialsCart?.length || 0) > 0) points += 10;
    if ((bid.laborLineItems?.length || 0) > 0) points += 10;
    
    // Overhead & Markup (15 points)
    if (bid.overheadPct && bid.overheadPct > 0) points += 8;
    if (bid.markupPct && bid.markupPct > 0) points += 7;
    
    // Payment Schedule (25 points)
    if (bid.paymentSchedule === 'milestone-based') {
      const totalPct = bid.paymentMilestones?.reduce((sum, m) => sum + (m.percentage || 0), 0) || 0;
      if (Math.abs(totalPct - 100) < 0.1) {
        points += 25;
      } else if (totalPct > 0) {
        points += 15;
      }
    } else if (bid.paymentSchedule === 'weekly') {
      const totalScheduled = bid.weeklyPayments?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      if (calc.total > 0 && Math.abs(calc.total - totalScheduled) < 1) {
        points += 25;
      } else if (totalScheduled > 0) {
        points += 15;
      }
    }
    
    // Legal & Compliance (10 points)
    if (bid.licenseNumber) points += 5;
    if (bid.insuranceCoverage) points += 5;
    
    // Work Schedule (5 points)
    if (bid.workSchedule) points += 5;
    
    return Math.min(100, Math.round(points));
  }, [bid, materialsCart, calc]);

  const healthColor = healthScore >= 80 ? '#38d39f' : healthScore >= 60 ? '#ffcc66' : '#ff7a7a';

  // Helper function to round payment amounts to 2 decimal places
  const roundPayment = (amount) => {
    return Math.round((amount || 0) * 100) / 100;
  };
  
  // Helper function to normalize payment amounts so they sum to exactly grandTotal
  // Also recalculates all percentages from amounts to ensure they sum to exactly 100%
  const normalizePaymentsToExactTotal = (payments, grandTotal, isMilestone = false) => {
    if (!payments || payments.length === 0 || grandTotal <= 0) return payments;
    
    // Calculate sum of all payments except the last one
    let sum = 0;
    const normalized = payments.map((p) => {
      const amount = isMilestone ? (p.paymentAmount || p.amount || 0) : (p.amount || 0);
      sum += amount;
      return { ...p };
    });
    
    // Make the last payment equal to grandTotal - sum of all others
    if (normalized.length > 0) {
      const lastIndex = normalized.length - 1;
      const lastCurrentAmount = isMilestone ? (normalized[lastIndex].paymentAmount || normalized[lastIndex].amount || 0) : (normalized[lastIndex].amount || 0);
      const lastAmount = roundPayment(grandTotal - (sum - lastCurrentAmount));
      
      if (isMilestone) {
        normalized[lastIndex].paymentAmount = lastAmount;
        normalized[lastIndex].amount = lastAmount;
      } else {
        normalized[lastIndex].amount = lastAmount;
      }
    }
    
    // Recalculate ALL percentages from amounts to ensure they sum to exactly 100%
    // This eliminates rounding errors from stored percentages
    if (grandTotal > 0) {
      let percentageSum = 0;
      normalized.forEach((p, index) => {
        const amount = isMilestone ? (p.paymentAmount || p.amount || 0) : (p.amount || 0);
        // Calculate percentage with high precision
        const pct = (amount / grandTotal) * 100;
        
        // For all but the last payment, round to 2 decimal places
        // The last payment will absorb any rounding differences
        if (index < normalized.length - 1) {
          const roundedPct = Math.round(pct * 100) / 100;
          p.percentage = roundedPct;
          percentageSum += roundedPct;
        } else {
          // Last payment: ensure total is exactly 100%
          p.percentage = Math.round((100 - percentageSum) * 100) / 100;
        }
      });
    }
    
    return normalized;
  };

  // Helper function to normalize hybrid payments (milestones + weekly) to ensure combined total equals exactly grandTotal
  const normalizeHybridPaymentsToExactTotal = (milestones, weeklyPayments, grandTotal) => {
    if (grandTotal <= 0) return { milestones, weeklyPayments };
    
    // First normalize each separately
    const normalizedMilestones = milestones.length > 0 ? normalizePaymentsToExactTotal(milestones, grandTotal, true) : [];
    const normalizedWeekly = weeklyPayments.length > 0 ? normalizePaymentsToExactTotal(weeklyPayments, grandTotal, false) : [];
    
    // Calculate combined total
    const milestoneTotal = normalizedMilestones.reduce((sum, m) => sum + (m.paymentAmount || m.amount || 0), 0);
    const weeklyTotal = normalizedWeekly.reduce((sum, w) => sum + (w.amount || 0), 0);
    const combinedTotal = milestoneTotal + weeklyTotal;
    const difference = grandTotal - combinedTotal;
    
    // If there's a difference, adjust the final payment to maintain 100% total
    // In hybrid mode, prefer adjusting final milestone, then last weekly payment
    if (Math.abs(difference) > 0.01) {
      // Find final milestone first (for hybrid mode)
      const finalMilestoneIndex = normalizedMilestones.findIndex(m => 
        m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')))
      );
      
      if (finalMilestoneIndex >= 0) {
        // Adjust final milestone
        const currentAmount = normalizedMilestones[finalMilestoneIndex].paymentAmount || normalizedMilestones[finalMilestoneIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedMilestones[finalMilestoneIndex].paymentAmount = adjustedAmount;
        normalizedMilestones[finalMilestoneIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedMilestones[finalMilestoneIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      } else if (normalizedWeekly.length > 0) {
        // If no final milestone, adjust last weekly payment
        const lastIndex = normalizedWeekly.length - 1;
        const currentAmount = normalizedWeekly[lastIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedWeekly[lastIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedWeekly[lastIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      } else if (normalizedMilestones.length > 0) {
        // Fallback: adjust last milestone
        const lastIndex = normalizedMilestones.length - 1;
        const currentAmount = normalizedMilestones[lastIndex].paymentAmount || normalizedMilestones[lastIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedMilestones[lastIndex].paymentAmount = adjustedAmount;
        normalizedMilestones[lastIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedMilestones[lastIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      }
    }
    
    // Recalculate all percentages from final amounts to ensure accuracy
    if (grandTotal > 0) {
      // Recalculate milestone percentages
      normalizedMilestones.forEach(m => {
        const amount = m.paymentAmount || m.amount || 0;
        m.percentage = (amount / grandTotal) * 100;
      });
      
      // Recalculate weekly percentages
      normalizedWeekly.forEach(w => {
        const amount = w.amount || 0;
        w.percentage = (amount / grandTotal) * 100;
      });
      
      // Ensure combined percentages sum to exactly 100% by adjusting the final payment
      // In hybrid mode, prefer adjusting final milestone, then last weekly payment
      const milestonePctSum = normalizedMilestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      const weeklyPctSum = normalizedWeekly.reduce((sum, w) => sum + (w.percentage || 0), 0);
      const combinedPctSum = milestonePctSum + weeklyPctSum;
      const pctDifference = 100 - combinedPctSum;
      
      if (Math.abs(pctDifference) > 0.01) {
        // Find final milestone first (for hybrid mode)
        const finalMilestoneIndex = normalizedMilestones.findIndex(m => 
          m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')))
        );
        
        if (finalMilestoneIndex >= 0) {
          // Adjust final milestone percentage
          normalizedMilestones[finalMilestoneIndex].percentage = Math.round((normalizedMilestones[finalMilestoneIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newFinalAmount = roundPayment((grandTotal * normalizedMilestones[finalMilestoneIndex].percentage) / 100);
          normalizedMilestones[finalMilestoneIndex].paymentAmount = newFinalAmount;
          normalizedMilestones[finalMilestoneIndex].amount = newFinalAmount;
        } else if (normalizedWeekly.length > 0) {
          // If no final milestone, adjust last weekly payment
          const lastIndex = normalizedWeekly.length - 1;
          normalizedWeekly[lastIndex].percentage = Math.round((normalizedWeekly[lastIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newWeeklyAmount = roundPayment((grandTotal * normalizedWeekly[lastIndex].percentage) / 100);
          normalizedWeekly[lastIndex].amount = newWeeklyAmount;
        } else if (normalizedMilestones.length > 0) {
          // Fallback: adjust last milestone
          const lastIndex = normalizedMilestones.length - 1;
          normalizedMilestones[lastIndex].percentage = Math.round((normalizedMilestones[lastIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newMilestoneAmount = roundPayment((grandTotal * normalizedMilestones[lastIndex].percentage) / 100);
          normalizedMilestones[lastIndex].paymentAmount = newMilestoneAmount;
          normalizedMilestones[lastIndex].amount = newMilestoneAmount;
        }
      }
    }
    
    return { milestones: normalizedMilestones, weeklyPayments: normalizedWeekly };
  };

  const updateBid = async (key, value) => {
    let normalizedValue = value;
    
    // For payment updates, calculate current total and recalculate amounts from percentages
    if (key === 'paymentMilestones' || key === 'weeklyPayments') {
      // Calculate current total from materials, labor, overhead, markup
      const materials = materialsCart.reduce((sum, r) => sum + (r.total || 0), 0);
      const labor = (bid.laborLineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const overhead = (bid.insuranceOverhead || 0) + (bid.equipment || 0) + (bid.facilities || 0) + (bid.otherOverhead || 0);
      const permitCosts = bid.permitCost || 0;
      const subtotal = materials + labor + overhead + permitCosts;
      const profit = (subtotal * (bid.markupPct || 0)) / 100;
      const grandTotal = Math.round(subtotal + profit) || calc?.total || calc?.grandTotal || bid.grandTotal || bid.total || 0;
      
      if (grandTotal > 0 && Array.isArray(value) && value.length > 0) {
        if (key === 'paymentMilestones') {
          // First, recalculate all amounts from percentages
          normalizedValue = value.map(m => {
            const percentage = m.percentage || 0;
            const newAmount = roundPayment((percentage / 100) * grandTotal);
            return {
              ...m,
              paymentAmount: newAmount,
              amount: newAmount
            };
          });
          // Then normalize to ensure exact total match
          normalizedValue = normalizePaymentsToExactTotal(normalizedValue, grandTotal, true);
        } else if (key === 'weeklyPayments') {
          // First, recalculate all amounts from percentages
          normalizedValue = value.map(p => {
            const percentage = p.percentage || 0;
            const newAmount = roundPayment((percentage / 100) * grandTotal);
            return {
              ...p,
              amount: newAmount
            };
          });
          // Then normalize to ensure exact total match
          normalizedValue = normalizePaymentsToExactTotal(normalizedValue, grandTotal, false);
        }
      }
    }
    
    const updatedBid = { ...bid, [key]: normalizedValue };
    setBid(updatedBid);
    
    // Auto-save payment schedule changes immediately
    if (key === 'paymentSchedule' || key === 'paymentMilestones' || key === 'weeklyPayments') {
      try {
        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
        console.log(`💾 Auto-saved payment schedule change: ${key}`);
      } catch (error) {
        console.error('Error auto-saving payment schedule:', error);
      }
    }
  };

  // Payment Milestone Management
  const handleAddMilestone = () => {
    setMilestoneModal({ visible: true, item: null });
  };

  const handleEditMilestone = (milestone) => {
    setMilestoneModal({ visible: true, item: milestone });
  };

  const handleSaveMilestone = (milestoneData) => {
    const currentMilestones = bid.paymentMilestones || [];
    const grandTotal = bid.grandTotal || bid.total || 0;
    let updatedMilestones;
    
    if (milestoneData.id) {
      // Edit existing milestone - apply smart recalculation
      const editedMilestone = currentMilestones.find(m => m.id === milestoneData.id);
      const isDeposit = editedMilestone?.type === 'deposit' || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('deposit'));
      const isFinal = editedMilestone?.type === 'final' || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('final')) || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('completion'));
      
      // Get the new percentage from the edited milestone
      const newPct = milestoneData.percentage || (milestoneData.paymentAmount && grandTotal > 0 ? (milestoneData.paymentAmount / grandTotal) * 100 : 0);
      
      // Get all other milestones (excluding the one being edited)
      const otherMilestones = currentMilestones.filter(m => m.id !== milestoneData.id);
      
      // Calculate total percentage of other milestones
      const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      // Calculate remaining percentage after the edited milestone
      const remainingPct = 100 - newPct;
      
      // If remaining is negative or zero, adjust the edited milestone down
      if (remainingPct <= 0) {
        const adjustedPct = Math.max(0, 100 - otherMilestonesPct);
        const adjustedAmount = roundPayment((grandTotal * adjustedPct) / 100);
        milestoneData.percentage = adjustedPct;
        milestoneData.paymentAmount = adjustedAmount;
        milestoneData.amount = adjustedAmount;
        updatedMilestones = currentMilestones.map(m => 
          m.id === milestoneData.id ? milestoneData : m
        );
      } else if (otherMilestonesPct > remainingPct && otherMilestones.length > 0) {
        // Recalculate other milestones proportionally
        const scaleFactor = remainingPct / otherMilestonesPct;
        const adjustedOtherMilestones = otherMilestones.map(m => {
          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
          const newPct = currentPct * scaleFactor;
          return {
            ...m,
            percentage: newPct,
            paymentAmount: roundPayment((grandTotal * newPct) / 100),
            amount: roundPayment((grandTotal * newPct) / 100)
          };
        });
        
        // Update the edited milestone with correct amount
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        milestoneData.paymentAmount = newAmount;
        milestoneData.amount = newAmount;
        
        updatedMilestones = [milestoneData, ...adjustedOtherMilestones].sort((a, b) => {
          // Keep deposit first, final last, others in between
          const aIsDeposit = a.type === 'deposit' || (a.name && a.name.toLowerCase().includes('deposit'));
          const bIsDeposit = b.type === 'deposit' || (b.name && b.name.toLowerCase().includes('deposit'));
          const aIsFinal = a.type === 'final' || (a.name && a.name.toLowerCase().includes('final')) || (a.name && a.name.toLowerCase().includes('completion'));
          const bIsFinal = b.type === 'final' || (b.name && b.name.toLowerCase().includes('final')) || (b.name && b.name.toLowerCase().includes('completion'));
          
          if (aIsDeposit) return -1;
          if (bIsDeposit) return 1;
          if (aIsFinal) return 1;
          if (bIsFinal) return -1;
          return 0;
        });
      } else {
        // No adjustment needed, just update the edited milestone
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        milestoneData.paymentAmount = newAmount;
        milestoneData.amount = newAmount;
        updatedMilestones = currentMilestones.map(m => 
          m.id === milestoneData.id ? milestoneData : m
        );
      }
    } else {
      // Add new milestone - check if total would exceed 100%
      const newPct = milestoneData.percentage || (milestoneData.paymentAmount && grandTotal > 0 ? (milestoneData.paymentAmount / grandTotal) * 100 : 0);
      const currentTotalPct = currentMilestones.reduce((sum, m) => {
        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      if (currentTotalPct + newPct > 100) {
        // Adjust all milestones proportionally
        const totalPct = currentTotalPct + newPct;
        const scaleFactor = 100 / totalPct;
        
        const adjustedMilestones = currentMilestones.map(m => {
          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
          const adjustedPct = currentPct * scaleFactor;
          return {
            ...m,
            percentage: adjustedPct,
            paymentAmount: roundPayment((grandTotal * adjustedPct) / 100),
            amount: roundPayment((grandTotal * adjustedPct) / 100)
          };
        });
        
        const adjustedNewPct = newPct * scaleFactor;
        const newMilestone = {
          ...milestoneData,
          id: milestoneData.id || `milestone-${Date.now()}`,
          percentage: adjustedNewPct,
          paymentAmount: roundPayment((grandTotal * adjustedNewPct) / 100),
          amount: roundPayment((grandTotal * adjustedNewPct) / 100)
        };
        
        updatedMilestones = [...adjustedMilestones, newMilestone];
      } else {
        // No adjustment needed
        const newMilestone = {
          ...milestoneData,
          id: milestoneData.id || `milestone-${Date.now()}`,
        };
        updatedMilestones = [...currentMilestones, newMilestone];
      }
    }
    
    // Normalize to ensure exact total match (grandTotal already declared at function start)
    if (grandTotal > 0 && updatedMilestones.length > 0) {
      updatedMilestones = normalizePaymentsToExactTotal(updatedMilestones, grandTotal, true);
    }
    
    updateBid('paymentMilestones', updatedMilestones);
    setMilestoneModal({ visible: false, item: null });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteMilestone = (milestoneId) => {
    Alert.alert(
      'Delete Milestone',
      'Are you sure you want to delete this payment milestone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedMilestones = (bid.paymentMilestones || []).filter(m => m.id !== milestoneId);
            updateBid('paymentMilestones', updatedMilestones);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  // Weekly Payment Management
  const handleAddWeeklyPayment = () => {
    setWeeklyPaymentModal({ visible: true, item: null });
  };

  const handleEditWeeklyPayment = (payment) => {
    setWeeklyPaymentModal({ visible: true, item: payment });
  };

  const handleSaveWeeklyPayment = (paymentData) => {
    const currentPayments = bid.weeklyPayments || [];
    const grandTotal = bid.grandTotal || bid.total || 0;
    let updatedPayments;
    
    if (paymentData.id) {
      // Edit existing payment - apply smart recalculation for time-based
      const editedPayment = currentPayments.find(p => p.id === paymentData.id);
      const isDeposit = editedPayment?.weekNumber === 0 || (editedPayment?.description && editedPayment.description.toLowerCase().includes('deposit'));
      
      // Get the new percentage from the edited payment
      const newPct = paymentData.percentage || (paymentData.amount && grandTotal > 0 ? (paymentData.amount / grandTotal) * 100 : 0);
      
      // Get all other payments (excluding the one being edited)
      const otherPayments = currentPayments.filter(p => p.id !== paymentData.id);
      
      // Calculate total percentage of other payments
      const otherPaymentsPct = otherPayments.reduce((sum, p) => {
        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      // Calculate remaining percentage after the edited payment
      const remainingPct = 100 - newPct;
      
      // If remaining is negative or zero, adjust the edited payment down
      if (remainingPct <= 0) {
        const adjustedPct = Math.max(0, 100 - otherPaymentsPct);
        const adjustedAmount = roundPayment((grandTotal * adjustedPct) / 100);
        paymentData.percentage = adjustedPct;
        paymentData.amount = adjustedAmount;
        updatedPayments = currentPayments.map(p => 
          p.id === paymentData.id ? paymentData : p
        );
      } else if (otherPaymentsPct > remainingPct && otherPayments.length > 0) {
        // Recalculate other payments proportionally
        const scaleFactor = remainingPct / otherPaymentsPct;
        const adjustedOtherPayments = otherPayments.map(p => {
          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
          const newPct = currentPct * scaleFactor;
          return {
            ...p,
            percentage: newPct,
            amount: roundPayment((grandTotal * newPct) / 100)
          };
        });
        
        // Update the edited payment with correct amount
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        paymentData.amount = newAmount;
        
        updatedPayments = [paymentData, ...adjustedOtherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      } else {
        // No adjustment needed, just update the edited payment
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        paymentData.amount = newAmount;
        updatedPayments = currentPayments.map(p => 
          p.id === paymentData.id ? paymentData : p
        );
      }
    } else {
      // Add new payment - check if total would exceed 100%
      const newPct = paymentData.percentage || (paymentData.amount && grandTotal > 0 ? (paymentData.amount / grandTotal) * 100 : 0);
      const currentTotalPct = currentPayments.reduce((sum, p) => {
        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      if (currentTotalPct + newPct > 100) {
        // Adjust all payments proportionally
        const totalPct = currentTotalPct + newPct;
        const scaleFactor = 100 / totalPct;
        
        const adjustedPayments = currentPayments.map(p => {
          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
          const adjustedPct = currentPct * scaleFactor;
          return {
            ...p,
            percentage: adjustedPct,
            amount: roundPayment((grandTotal * adjustedPct) / 100)
          };
        });
        
        const maxWeekNumber = currentPayments.length > 0 
          ? Math.max(...currentPayments.map(p => p.weekNumber || 0))
          : 0;
        const adjustedNewPct = newPct * scaleFactor;
        const newPayment = {
          ...paymentData,
          id: paymentData.id || `week-${Date.now()}`,
          weekNumber: paymentData.weekNumber || maxWeekNumber + 1,
          percentage: adjustedNewPct,
          amount: roundPayment((grandTotal * adjustedNewPct) / 100)
        };
        
        updatedPayments = [...adjustedPayments, newPayment];
      } else {
        // No adjustment needed
        const maxWeekNumber = currentPayments.length > 0 
          ? Math.max(...currentPayments.map(p => p.weekNumber || 0))
          : 0;
        const newPayment = {
          ...paymentData,
          id: paymentData.id || `week-${Date.now()}`,
          weekNumber: paymentData.weekNumber || maxWeekNumber + 1,
        };
        updatedPayments = [...currentPayments, newPayment];
      }
    }
    
    // Sort by week number
    updatedPayments.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    
    // Normalize to ensure exact total match (grandTotal already declared at function start)
    if (grandTotal > 0 && updatedPayments.length > 0) {
      updatedPayments = normalizePaymentsToExactTotal(updatedPayments, grandTotal, false);
    }
    
    updateBid('weeklyPayments', updatedPayments);
    setWeeklyPaymentModal({ visible: false, item: null });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteWeeklyPayment = (paymentId) => {
    Alert.alert(
      'Delete Weekly Payment',
      'Are you sure you want to delete this weekly payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedPayments = (bid.weeklyPayments || []).filter(p => p.id !== paymentId);
            updateBid('weeklyPayments', updatedPayments);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  useEffect(() => {
    const sourceType =
      bid?.projectType ||
      bid?.projectCategory ||
      bid?.category ||
      bid?.template;
    if (!sourceType) return;
    const normalized = normalizeScope(sourceType);
    if (normalized !== activeScope) {
      setActiveScope(normalized);
    }
  }, [bid?.projectType, bid?.projectCategory, bid?.category, bid?.template, activeScope, normalizeScope]);

  // Build Contract Document from Bid Data
  const buildDocFromBid = (bidData, calcData) => {
    const scopeBullets = bidData.scopeDescription 
      ? bidData.scopeDescription.split('\n').filter(line => line.trim())
      : ['Complete renovation as specified'];

    // Build detailed line items from materials cart
    const materialLineItems = materialsCart && materialsCart.length > 0
      ? materialsCart.map(item => ({
          description: item.name || item.description || 'Material',
          unit: item.unit || 'ea',
          quantity: item.qty || item.quantity || 1,
          materials: item.total || 0,
          labor: 0,
          category: 'Materials',
          section: item.section || 'General Materials'
        }))
      : ((calcData?.materials || 0) > 0 ? [{
          description: 'Materials & Supplies',
          unit: 'total',
          quantity: 1,
          materials: calcData.materials,
          labor: 0,
          category: 'Materials'
        }] : []);

    // Calculate total overhead
    const totalOverhead = Number(bidData.insuranceOverhead || 0) + 
                         Number(bidData.equipment || 0) + 
                         Number(bidData.facilities || 0) + 
                         Number(bidData.otherOverhead || 0);

    return {
      summary: {
        contractId: bidData.id || `BPS-${Date.now()}`,
        projectName: bidData.title || 'Untitled Project',
        siteAddress: `${bidData.customerAddress || ''} ${bidData.customerCity || ''}, ${bidData.customerState || ''} ${bidData.customerZip || ''}`.trim() || 'N/A',
        unitPrice: bidData.sqft ? (() => {
          const materials = calcData?.materials || 0;
          const labor = calcData?.labor || 0;
          const overhead = totalOverhead;
          const permitCosts = bidData.permitCost || 0;
          const subtotal = materials + labor + overhead + permitCosts;
          const markup = subtotal * ((bidData.markupPct || 0) / 100);
          return Math.round(subtotal + markup) / bidData.sqft;
        })() : undefined,
        totalBid: (() => {
          const materials = calcData?.materials || 0;
          const labor = calcData?.labor || 0;
          const overhead = totalOverhead;
          const permitCosts = bidData.permitCost || 0;
          const subtotal = materials + labor + overhead + permitCosts;
          const markup = subtotal * ((bidData.markupPct || 0) / 100);
          return Math.round(subtotal + markup);
        })(),
        durationDays: bidData.projectDuration || 30,
        estimatedStartDate: bidData.projectStartDate || undefined,
        estimatedEndDate: bidData.projectEndDate || (bidData.projectStartDate ? 
          new Date(new Date(bidData.projectStartDate).getTime() + (bidData.projectDuration || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
          : undefined),
        startDate: bidData.projectStartDate ? new Date(bidData.projectStartDate + 'T00:00:00').toLocaleDateString() : 'TBD',
        expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        retainagePct: 10,
        version: bidData.revision ? `Rev ${bidData.revision}` : 'Final',
      },
      contractor: {
        contactName: contractorProfile.name || undefined,
        legalName: contractorProfile.company || 'AMERICAN HOME RESTORATION',
        licenseNo: bidData.licenseNumber || undefined,
        phone: undefined,
        email: undefined,
        insurer: bidData.insuranceCoverage || undefined,
        glLimit: undefined,
        wcActive: bidData.insurance || false,
        logoUrl: contractorProfile.avatar || undefined,
      },
      owner: {
        legalName: bidData.customerName || 'N/A',
        phone: bidData.customerPhone || undefined,
        email: bidData.customerEmail || undefined,
        address: `${bidData.customerAddress || ''} ${bidData.customerCity || ''}, ${bidData.customerState || ''} ${bidData.customerZip || ''}`.trim() || undefined,
      },
      scope: {
        bullets: scopeBullets,
        inclusions: [],
        exclusions: [],
        ownerResponsibilities: [],
        materialLineItems: materialLineItems,
        laborLineItems: (bidData.laborLineItems || []).map(item => ({
          description: item.description || 'Labor',
          labor: item.total || 0,
          materials: 0,
          category: 'Labor'
        })),
      },
      allowances: [],
      milestones: bidData.paymentSchedule === 'milestone-based' && bidData.paymentMilestones
        ? bidData.paymentMilestones.map(m => ({
            id: m.id,
            name: m.name || 'Payment Milestone',
            percentage: m.percentage || 0,
            percent: m.percentage || 0,
            paymentAmount: m.paymentAmount || 0,
            amount: m.paymentAmount || 0,
            description: m.description || undefined,
            scheduledDate: m.scheduledDate || undefined,
            dueDate: m.scheduledDate || undefined,
            status: 'Pending',
          }))
        : bidData.paymentSchedule === 'weekly' && bidData.weeklyPayments
        ? bidData.weeklyPayments.map((w, i) => ({
            id: w.id,
            name: `Week ${i + 1} Payment`,
            percentage: calcData?.materials && calcData?.labor ? Math.round((w.amount / ((calcData.materials || 0) + (calcData.labor || 0) + (bidData.insuranceOverhead || 0) + (bidData.equipment || 0) + (bidData.facilities || 0) + (bidData.otherOverhead || 0))) * 100) : 0,
            percent: calcData?.materials && calcData?.labor ? Math.round((w.amount / ((calcData.materials || 0) + (calcData.labor || 0) + (bidData.insuranceOverhead || 0) + (bidData.equipment || 0) + (bidData.facilities || 0) + (bidData.otherOverhead || 0))) * 100) : 0,
            paymentAmount: w.amount || 0,
            amount: w.amount || 0,
            description: w.description || undefined,
            scheduledDate: w.scheduledDate || undefined,
            dueDate: w.scheduledDate || undefined,
            status: 'Pending',
          }))
        : [],
      terms: {
        lateInterestPct: 1.5,
        suspendDays: 7,
        cureDays: 7,
        convDays: 7,
        convFeePct: 5,
        escalationThresholdPct: 8,
        warrantyYears: bidData.warrantyYears || 1,
        stateLaw: bidData.customerState || 'Nevada',
        workHours: bidData.workSchedule === 'weekdays' ? 'Mon–Fri, 8:00a–5:00p' : 'Flexible',
        permitsBy: 'Contractor',
        permitFeesPaidBy: 'Owner',
      },
      labor: calcData?.labor || 0,
      materials: calcData?.materials || 0,
      overhead: totalOverhead,
      profitMarginPct: bidData.markupPct || 0,
    };
  };

  // Generate and Share Contract - Goes straight to PDF sharing
  const generateContract = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      console.log('🔨 Building and sharing contract from bid:', bid.title || 'Untitled');
      console.log('👤 Using contractor profile:', contractorProfile);
      
      // Convert logo to base64 if it exists
      let logoBase64 = null;
      if (contractorProfile.avatar && contractorProfile.avatar.startsWith('file://')) {
        try {
          console.log('🖼️ Converting logo to base64...');
          const base64 = await FileSystem.readAsStringAsync(contractorProfile.avatar, {
            encoding: 'base64',
          });
          // Determine image type from file extension
          const extension = contractorProfile.avatar.split('.').pop().toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          logoBase64 = `data:${mimeType};base64,${base64}`;
          console.log('✅ Logo converted to base64 data URI');
        } catch (error) {
          console.error('Failed to convert logo:', error);
        }
      }
      
      // Build contract document from bid data with real-time calculations
      const doc = buildDocFromBid(bid, calc);
      // Override logo with base64 version
      if (logoBase64) {
        doc.contractor.logoUrl = logoBase64;
      }
      console.log('📄 Built contract doc:', {
        contractorName: doc.contractor.legalName,
        contractorLogo: doc.contractor.logoUrl ? 'base64 data URI' : 'none'
      });
      
      // Generate HTML and immediately export as PDF
      const html = buildProposalHtml(doc);
      console.log('🌐 Generated proposal HTML (' + html.length + ' chars)');
      
      // Export and share the PDF directly
      await exportProposalPdf(html, `${bid.title || 'contract'}-${bid.id}`);
      
      console.log('✅ Contract PDF generated and shared successfully');
    } catch (error) {
      console.error('❌ Error generating contract:', error);
      console.error('Error stack:', error.stack);
      Alert.alert(
        '❌ Error',
        `Failed to generate contract: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Manual recovery function for Haim bid
  const handleRecoverHaimBid = async () => {
    try {
      console.log('🔍 COMPREHENSIVE Haim bid search starting...');
      
      // Get ALL AsyncStorage keys first
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('📋 ALL storage keys found:', allKeys);
      
      // Check every single storage key for any data containing "haim"
      let foundData = null;
      let foundInKey = null;
      
      for (const key of allKeys) {
        try {
          console.log(`🔍 Checking key: ${key}`);
          const data = await AsyncStorage.getItem(key);
          if (data) {
            // Try to parse as JSON
            try {
              const parsed = JSON.parse(data);
              console.log(`📄 Key ${key} contains:`, typeof parsed, Array.isArray(parsed) ? `Array(${parsed.length})` : 'Object');
              
              // Check if it's an array of projects
              if (Array.isArray(parsed)) {
                for (let i = 0; i < parsed.length; i++) {
                  const item = parsed[i];
                  if (item && typeof item === 'object') {
                    // Check all string properties for "haim"
                    for (const prop in item) {
                      if (typeof item[prop] === 'string' && item[prop].toLowerCase().includes('haim')) {
                        console.log(`🎉 Found "haim" in ${key}[${i}].${prop}: "${item[prop]}"`);
                        foundData = item;
                        foundInKey = `${key}[${i}]`;
                        break;
                      }
                    }
                  }
                }
              } else if (parsed && typeof parsed === 'object') {
                // Check all string properties for "haim"
                for (const prop in parsed) {
                  if (typeof parsed[prop] === 'string' && parsed[prop].toLowerCase().includes('haim')) {
                    console.log(`🎉 Found "haim" in ${key}.${prop}: "${parsed[prop]}"`);
                    foundData = parsed;
                    foundInKey = key;
                    break;
                  }
                }
              }
            } catch (parseError) {
              // Not JSON, check if it's a string containing "haim"
              if (data.toLowerCase().includes('haim')) {
                console.log(`🎉 Found "haim" in raw data of ${key}: "${data.substring(0, 100)}..."`);
                foundData = data;
                foundInKey = key;
              }
            }
          }
        } catch (e) {
          console.log(`⚠️ Error reading ${key}:`, e.message);
        }
      }
      
      if (foundData) {
        console.log(`✅ Found Haim data in ${foundInKey}:`, foundData);
        
        // If it's a project with estimateData, use that
        if (foundData.estimateData) {
          console.log('🔄 Converting project estimateData back to bid...');
          setBid(foundData.estimateData);
          Alert.alert(
            '✅ Haim Bid Recovered!',
            `Found your Haim bid in ${foundInKey}`,
            [{ 
              text: 'OK',
              onPress: () => {
                console.log('✅ Bid should now be loaded:', foundData.estimateData);
              }
            }]
          );
          return;
        }
        
        // If it's a bid object, use it directly
        if (foundData.title || foundData.id) {
          console.log('🔄 Using found bid data directly...');
          console.log('📋 Setting bid to:', foundData);
          setBid(foundData);
          
          // Force a small delay to ensure state update
          setTimeout(() => {
            console.log('🔄 Forcing bid state refresh...');
            setBid(prevBid => ({ ...prevBid, ...foundData }));
          }, 100);
          
          Alert.alert(
            '✅ Haim Bid Recovered!',
            `Found your Haim bid in ${foundInKey}`,
            [{ 
              text: 'OK',
              onPress: () => {
                console.log('✅ Bid should now be loaded:', foundData);
                // Force another refresh after alert
                setTimeout(() => {
                  setBid(foundData);
                }, 50);
              }
            }]
          );
          return;
        }
        
        // If it's raw data, try to parse it as a bid
        if (typeof foundData === 'string') {
          try {
            const parsedData = JSON.parse(foundData);
            console.log('🔄 Parsing raw data as bid...');
            setBid(parsedData);
            Alert.alert(
              '✅ Haim Bid Recovered!',
              `Found your Haim bid in ${foundInKey}`,
              [{ 
                text: 'OK',
                onPress: () => {
                  console.log('✅ Bid should now be loaded:', parsedData);
                }
              }]
            );
            return;
          } catch (e) {
            console.log('⚠️ Could not parse raw data as JSON');
          }
        }
      }
      
      // If we get here, show detailed failure info
      console.log('❌ No Haim data found in any storage key');
      Alert.alert(
        '❌ Haim Bid Not Found',
        `Searched ${allKeys.length} storage keys but couldn't find any data containing "haim". The bid may have been permanently overwritten.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Error in comprehensive recovery:', error);
      Alert.alert('Error', `Recovery failed: ${error.message}`);
    }
  };

  // Save estimate to unified context
  const handleSaveEstimate = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      console.log('🔍 Debug - calc object:', calc);
      console.log('🔍 Debug - bid object:', bid);
      
      const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
      
      // Add safety checks for calc values
      const estimatedCost = Number(calc?.subtotal) || 0;
      const bidPrice = Number(calc?.grandTotal) || 0;
      const margin = Number(calc?.marginPercent) || 0;
      const markup = Number(bid.markupPct) || 0;
      
      console.log('🔍 Debug - calculated values:', {
        estimatedCost,
        bidPrice,
        margin,
        markup,
        calcSubtotal: calc?.subtotal,
        calcGrandTotal: calc?.grandTotal,
        calcMargin: calc?.marginPercent
      });
      
      // Preserve existing status if bid was already submitted
      const existingProject = [...activeProjects, ...estimates].find(p => p.id === bid.id);
      const preservedStatus = existingProject?.status || 'estimate';
      
      const estimateData = {
        id: bid.id,
        title: bid.title || 'Untitled Bid',
        status: preservedStatus, // Preserve existing status (estimate, bid_submitted, won, etc.)
        estimatedCost,
        bidPrice,
        actualCost: 0,
        margin,
        markup,
        location,
        city: bid.customerCity,
        state: bid.customerState,
        zip: bid.customerZip,
        startDate: bid.startDate || new Date().toISOString().split('T')[0],
        endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        progress: 0,
        client: bid.customerName || bid.clientName || 'Unknown Client',
        clientEmail: bid.customerEmail || bid.clientEmail,
        clientPhone: bid.customerPhone,
        projectType: bid.projectType,
        projectCategory: bid.projectCategory || PROJECT_CATEGORY_SLUGS[bid.projectType] || bid.category,
        category: bid.category || PROJECT_CATEGORY_SLUGS[bid.projectType] || 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimateData: bid,
      };
      
      console.log('🔍 Debug - estimate data to save:', estimateData);
      
      addEstimate(estimateData);
      
      Alert.alert(
        '✅ Estimate Saved!',
        'Your estimate has been saved and will appear in Dashboard and Projects.',
        [{ text: 'OK' }]
      );
      console.log(`✅ Saved estimate: ${bid.title} ($${bidPrice.toLocaleString()})`);
    } catch (error) {
      console.error('❌ Error saving estimate:', error);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', `Failed to save estimate: ${error.message}`);
    }
  };

  // Submit bid to client (changes status to bid_submitted)
  const handleSubmitBid = () => {
    console.log('🔍 handleSubmitBid called');
    console.log('🔍 calc object:', calc);
    console.log('🔍 bid object:', bid);
    
    Alert.alert(
      'Submit Bid to Client?',
      'This will mark the estimate as submitted and track it as a pending bid.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            console.log('🔍 Submit button pressed');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            
            // First ensure the estimate is saved, then update status
            try {
              // Save the estimate first if it doesn't exist
              const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
              const estimatedCost = Number(calc?.subtotal || 0);
              const bidPrice = Number(calc?.total || 0);
              const margin = Number(calc?.marginPercent || 0);
              const markup = Number(bid.markupPct || 0);
              
              console.log('🔍 Calculated values:', { estimatedCost, bidPrice, margin, markup });
              
              const estimateData = {
                id: bid.id,
                title: bid.title || 'Untitled Bid',
                status: 'bid_submitted', // Set status to bid_submitted so it shows as "Submitted" in projects
                estimatedCost,
                bidPrice,
                actualCost: 0,
                margin,
                markup,
                location,
                city: bid.customerCity,
                state: bid.customerState,
                zip: bid.customerZip,
                startDate: bid.startDate || new Date().toISOString().split('T')[0],
                endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress: 0,
                client: bid.customerName || bid.clientName || 'Unknown Client',
                clientEmail: bid.customerEmail || bid.clientEmail,
                clientPhone: bid.customerPhone,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimateData: bid,
              };
              
              console.log('🔍 Debug - submitting bid with data:', estimateData);
              addEstimate(estimateData);
              
              // Update lead stage to "proposal" if this bid came from a qualified lead
              if (bid.leadId && bid.leadSource === 'qualified_lead') {
                try {
                  const leadId = bid.leadId;
                  console.log(`🔄 Updating lead ${leadId} stage to proposal after submitting bid`);
                  console.log(`🔄 Lead source: ${bid.leadSource}, Lead ID: ${leadId}`);
                  
                  // Track that bid was submitted
                  const { trackBidSubmitted } = await import('../../services/engagementTracking');
                  await trackBidSubmitted(leadId);
                  
                  // Update backend lead (including MOCK- leads which are backend-managed)
                  try {
                    await unifiedLeadService.updateLeadStage(leadId, 'proposal');
                    console.log(`✅ Updated backend lead ${leadId} stage to proposal`);
                    
                    // Also update AsyncStorage as backup so leads screen picks up the change
                    const leadsData = await AsyncStorage.getItem('leadsData');
                    if (leadsData) {
                      const leads = JSON.parse(leadsData);
                      const existingIndex = leads.findIndex((l) => l.id === leadId);
                      if (existingIndex >= 0) {
                        leads[existingIndex] = {
                          ...leads[existingIndex],
                          stage: 'proposal',
                          updatedAt: new Date().toISOString()
                        };
                        await AsyncStorage.setItem('leadsData', JSON.stringify(leads));
                        console.log(`✅ Also updated AsyncStorage backup for backend lead ${leadId}`);
                      }
                    }
                  } catch (updateError) {
                    // If backend update fails (e.g., 404 for frontend-only leads), update AsyncStorage only
                    console.warn(`⚠️ Backend update failed for ${leadId}, updating AsyncStorage only:`, updateError);
                    const leadsData = await AsyncStorage.getItem('leadsData');
                    if (leadsData) {
                      const leads = JSON.parse(leadsData);
                      const updatedLeads = leads.map((l) => 
                        l.id === leadId ? { ...l, stage: 'proposal', updatedAt: new Date().toISOString() } : l
                      );
                      await AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads));
                      console.log(`✅ Updated frontend lead ${leadId} stage to proposal in AsyncStorage`);
                    }
                  }
                } catch (leadUpdateError) {
                  console.warn('⚠️ Failed to update lead stage after proposal submission:', leadUpdateError);
                  // Don't block the submission if lead update fails
                }
              }
              
              Alert.alert('✅ Bid Submitted!', 'Your bid is now being tracked as pending and will appear in Dashboard and Projects.');
              console.log(`📤 Submitted bid: ${bid.title} ($${bidPrice.toLocaleString()})`);
              
              // If this came from a lead, navigate back to leads screen to see the updated stage
              if (bid.leadId && bid.leadSource === 'qualified_lead') {
                console.log('🔄 Navigating back to leads screen to show updated stage');
                // Small delay to ensure backend update completes
                setTimeout(() => {
                  router.push('/(tabs)/leads');
                }, 500);
              }
            } catch (error) {
              console.error('❌ Error submitting bid:', error);
              Alert.alert('Error', `Failed to submit bid: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  // Mark bid as won (converts to project)
  const handleMarkAsWon = () => {
    Alert.alert(
      '🎉 Mark Bid as Won?',
      'This will convert your bid into an active project.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Won',
          style: 'default',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // First, ensure the bid/estimate is saved to the projects list
            // Check if it already exists
            const allProjects = [...activeProjects, ...estimates];
            console.log(`🔍 Checking for bid ${bid.id} in ${allProjects.length} projects`);
            console.log(`🔍 Available project IDs:`, allProjects.map(p => `${p.id} (${p.status})`));
            
            const existingProject = allProjects.find(p => p.id === bid.id);
            
            if (!existingProject) {
              console.log(`📝 Bid ${bid.id} not found in projects, saving it first...`);
              // Save the estimate with 'in_progress' status directly (since we're marking it as won)
              const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
              const estimatedCost = Number(calc?.subtotal) || 0;
              const bidPrice = Number(calc?.grandTotal) || 0;
              const margin = Number(calc?.marginPercent) || 0;
              const markup = Number(bid.markupPct) || 0;
              
              const estimateData = {
                id: bid.id,
                title: bid.title || 'Untitled Bid',
                status: 'won', // Set status to 'won' so it shows as "Active" in projects
                estimatedCost,
                bidPrice,
                actualCost: 0,
                margin,
                markup,
                location,
                city: bid.customerCity,
                state: bid.customerState,
                zip: bid.customerZip,
                startDate: bid.startDate || new Date().toISOString().split('T')[0],
                endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress: 0,
                client: bid.customerName || bid.clientName || 'Unknown Client',
                clientEmail: bid.customerEmail || bid.clientEmail,
                clientPhone: bid.customerPhone,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimateData: bid,
              };
              
              console.log(`💾 Saving bid as active project with status 'won':`, {
                id: estimateData.id,
                title: estimateData.title,
                status: estimateData.status,
                bidPrice: estimateData.bidPrice
              });
              addEstimate(estimateData);
              console.log(`✅ Bid saved! It should now appear in Projects tab with 'Active' status.`);
            } else {
              // Bid exists, convert it to won (Active)
              console.log(`🔄 Converting existing bid ${bid.id} from status '${existingProject.status}' to 'won'`);
              // Update the project status to 'won' so it shows as "Active"
              updateProject(bid.id, { status: 'won' });
              
              // Verify the update happened
              setTimeout(() => {
                const updatedProjects = [...activeProjects, ...estimates];
                const updated = updatedProjects.find(p => p.id === bid.id);
                if (updated) {
                  console.log(`✅ Verified: Bid ${bid.id} now has status '${updated.status}' (should display as 'Active')`);
                } else {
                  console.log(`⚠️ Warning: Could not find bid ${bid.id} after conversion`);
                }
              }, 500);
            }
            
            // Update lead stage to "won" if this bid came from a qualified lead
            if (bid.leadId && bid.leadSource === 'qualified_lead') {
              try {
                const leadId = bid.leadId;
                console.log(`🔄 Updating lead ${leadId} stage to won after marking bid as won`);
                
                // Track that bid was won
                const { trackBidWon } = await import('../../services/engagementTracking');
                await trackBidWon(leadId);
                
                // Update backend lead (including MOCK- leads which are backend-managed)
                try {
                  await unifiedLeadService.updateLeadStage(leadId, 'won');
                  console.log(`✅ Updated backend lead ${leadId} stage to won`);
                  
                  // Also update AsyncStorage as backup
                  const leadsData = await AsyncStorage.getItem('leadsData');
                  if (leadsData) {
                    const leads = JSON.parse(leadsData);
                    const existingIndex = leads.findIndex((l) => l.id === leadId);
                    if (existingIndex >= 0) {
                      leads[existingIndex] = {
                        ...leads[existingIndex],
                        stage: 'won',
                        updatedAt: new Date().toISOString()
                      };
                      await AsyncStorage.setItem('leadsData', JSON.stringify(leads));
                      console.log(`✅ Also updated AsyncStorage backup for backend lead ${leadId}`);
                    }
                  }
                } catch (updateError) {
                  // If backend update fails (e.g., 404 for frontend-only leads), update AsyncStorage only
                  console.warn(`⚠️ Backend update failed for ${leadId}, updating AsyncStorage only:`, updateError);
                  const leadsData = await AsyncStorage.getItem('leadsData');
                  if (leadsData) {
                    const leads = JSON.parse(leadsData);
                    const updatedLeads = leads.map((l) => 
                      l.id === leadId ? { ...l, stage: 'won', updatedAt: new Date().toISOString() } : l
                    );
                    await AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads));
                    console.log(`✅ Updated frontend lead ${leadId} stage to won in AsyncStorage`);
                  }
                }
              } catch (leadUpdateError) {
                console.warn('⚠️ Failed to update lead stage after marking bid as won:', leadUpdateError);
                // Don't block the action if lead update fails
              }
            }
            
            Alert.alert(
              '🎉 Congratulations!',
              `${bid.title} is now an active project! View it in the Projects tab.`,
              [{ text: 'OK' }]
            );
            console.log(`🎉 Won bid converted to project: ${bid.title}`);
          }
        }
      ]
    );
  };


  // Clear payment terms and schedule notes
  useEffect(() => {
    setBid(prev => ({
      ...prev,
      additionalPaymentTerms: '',
      scheduleNotes: ''
    }));
  }, []);

  // Calculate and save overhead percentage
  useEffect(() => {
    const totalOverhead = Number(bid.insuranceOverhead || 0) + Number(bid.equipment || 0) + Number(bid.facilities || 0) + Number(bid.otherOverhead || 0);
    const totalMaterials = Number(calc.materials || 0);
    const totalLabor = Number(calc.labor || 0);
    const totalPermitCosts = Number(bid.permitCost || 0);
    const subtotal = totalMaterials + totalLabor + totalPermitCosts;
    const overheadPct = subtotal > 0 ? Math.round((totalOverhead / subtotal) * 100) : 0;
    
    if (bid.overheadPct !== overheadPct) {
      setBid(prev => ({
        ...prev,
        overheadPct: overheadPct
      }));
    }
  }, [bid.insuranceOverhead, bid.equipment, bid.facilities, bid.otherOverhead, calc.materials, calc.labor]);

  
  // Enhanced materials helpers
  const filteredCatalog = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return MATERIAL_CATALOG;
    return MATERIAL_CATALOG.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.toLowerCase().includes(q))
    );
  }, [materialSearch]);
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => ({ ...prev, [categoryKey]: !prev[categoryKey] }));
  };
  
  const addMaterialToCart = (item, scope, section) => {
    const vendorId = materialSelectedVendor[item.id] || PRICE_BOOK[item.id][0].vendorId;
    const vendor = PRICE_BOOK[item.id].find(v => v.vendorId === vendorId);
    const qty = Number(materialNeedQty[item.id] || 0);
    if (!qty || qty <= 0 || !vendor) return;
    
    const row = {
      id: String(Date.now()),
      itemId: item.id,
      name: item.name,
      scope,
      section,
      vendorId,
      quantity: qty,
      unitPrice: vendor.price,
      total: qty * vendor.price,
    };
    
    setMaterialsCart(prev => [...prev, row]);
    Alert.alert('Added', `${item.name} added to ${section}`);
  };
  
  // Handle SKU attachment from live search
  const handleSubcontractorSelect = (subData) => {
    console.log('🔄 handleSubcontractorSelect called with:', subData);
    try {
      const newLaborItem = {
        id: String(Date.now()),
        name: `${subData.name} - ${subData.trade}`,
        mode: 'hourly',
        laborType: 'subcontractor',
        hours: 0,
        rate: subData.rate,
        total: 0,
        metadata: subData.metadata,
      };
      
      console.log('📝 Creating new labor item:', newLaborItem);
      
      setBid(prev => {
        console.log('🔄 Updating bid state...');
        const updated = {
          ...prev,
          laborLineItems: [...(prev.laborLineItems || []), newLaborItem]
        };
        console.log('✅ Bid state updated, new labor items count:', updated.laborLineItems.length);
        return updated;
      });
      
      // Simple success feedback without Alert to prevent freezing
      console.log('✅ Added subcontractor:', subData.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('✅ handleSubcontractorSelect completed successfully');
    } catch (error) {
      console.error('❌ Error in handleSubcontractorSelect:', error);
    }
  };

  // Auto-categorize materials based on name/keywords
  const autoCategorizeMaterial = (itemName, availableSections) => {
    const name = itemName.toLowerCase();
    
    // Shower & Plumbing (priority check - must be before general plumbing)
    if (name.includes('shower') || name.includes('showerhead') || name.includes('shower pan') || 
        name.includes('shower base') || name.includes('handheld shower') || name.includes('rain shower') ||
        name.includes('shower kit') || name.includes('shower door') || name.includes('shower surround')) {
      return availableSections.find(s => s.toLowerCase().includes('shower')) || 
             availableSections.find(s => s.toLowerCase().includes('plumb')) || 
             availableSections[0];
    }
    
    // Tile & Waterproofing
    if (name.includes('tile') || name.includes('grout') || name.includes('mortar') || 
        name.includes('thinset') || name.includes('redgard') || name.includes('kerdi') || 
        name.includes('waterproof') || name.includes('schluter') || name.includes('membrane')) {
      return availableSections.find(s => s.toLowerCase().includes('tile') || s.toLowerCase().includes('waterproof')) || availableSections[0];
    }
    
    // Framing & Structure
    if (name.includes('lumber') || name.includes('stud') || name.includes('2x4') || 
        name.includes('2x6') || name.includes('2x8') || name.includes('plywood') || 
        name.includes('osb') || name.includes('joist') || name.includes('beam') || 
        name.includes('sheathing') || name.includes('framing')) {
      return availableSections.find(s => s.toLowerCase().includes('fram')) || availableSections[0];
    }
    
    // Concrete & Masonry
    if (name.includes('concrete') || name.includes('cement') || name.includes('mortar') || 
        name.includes('brick') || name.includes('block') || name.includes('masonry') || 
        name.includes('rebar') || name.includes('foundation')) {
      return availableSections.find(s => s.toLowerCase().includes('concrete') || s.toLowerCase().includes('masonry')) || availableSections[0];
    }
    
    // Plumbing (general)
    if (name.includes('pipe') || name.includes('pvc') || name.includes('plumb') || 
        name.includes('drain') || name.includes('faucet') || name.includes('valve') || 
        name.includes('fitting') || name.includes('toilet') || name.includes('sink')) {
      return availableSections.find(s => s.toLowerCase().includes('plumb')) || availableSections[0];
    }
    
    // Electrical
    if (name.includes('wire') || name.includes('electric') || name.includes('cable') || 
        name.includes('outlet') || name.includes('switch') || name.includes('breaker') || 
        name.includes('conduit') || name.includes('panel') || name.includes('lighting')) {
      return availableSections.find(s => s.toLowerCase().includes('electric')) || availableSections[0];
    }
    
    // Drywall & Finishing
    if (name.includes('drywall') || name.includes('sheetrock') || name.includes('gypsum') || 
        name.includes('joint compound') || name.includes('mud') || name.includes('tape') || 
        name.includes('sanding')) {
      return availableSections.find(s => s.toLowerCase().includes('drywall') || s.toLowerCase().includes('finish')) || availableSections[0];
    }
    
    // Paint & Coatings
    if (name.includes('paint') || name.includes('primer') || name.includes('stain') || 
        name.includes('sealer') || name.includes('coating') || name.includes('caulk')) {
      return availableSections.find(s => s.toLowerCase().includes('paint')) || availableSections[0];
    }
    
    // Flooring
    if (name.includes('floor') || name.includes('laminate') || name.includes('vinyl') || 
        name.includes('hardwood') || name.includes('carpet') || name.includes('underlayment')) {
      return availableSections.find(s => s.toLowerCase().includes('floor')) || availableSections[0];
    }
    
    // HVAC
    if (name.includes('hvac') || name.includes('duct') || name.includes('vent') || 
        name.includes('furnace') || name.includes('ac ') || name.includes('air condition')) {
      return availableSections.find(s => s.toLowerCase().includes('hvac') || s.toLowerCase().includes('mechanical')) || availableSections[0];
    }
    
    // Roofing
    if (name.includes('roof') || name.includes('shingle') || name.includes('flashing') || 
        name.includes('gutter') || name.includes('soffit') || name.includes('fascia')) {
      return availableSections.find(s => s.toLowerCase().includes('roof')) || availableSections[0];
    }
    
    // Default to first section if no match
    return availableSections[0];
  };

  const handleSkuAttach = (skuItem) => {
    const quantity = skuItem.quantity || 1; // Get quantity from item, default to 1
    
    setMaterialsCart(prev => {
      // Check if this exact item already exists (same SKU + store)
      const existingIndex = prev.findIndex(item => 
        item.sku === skuItem.sku && 
        item.vendorId === (skuItem.store === 'hd' ? 'hd' : 'lw') &&
        item.scope === activeScope
      );
      
      if (existingIndex >= 0) {
        // Item exists - add to existing quantity
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          total: newQuantity * updated[existingIndex].unitPrice
        };
        
        Alert.alert('Updated!', `Quantity increased to ${newQuantity}`);
        return updated;
      } else {
        // New item - auto-categorize and add to cart
        const autoSection = autoCategorizeMaterial(skuItem.title, SECTIONS[activeScope]);
        
        const row = {
          id: String(Date.now()),
          itemId: skuItem.sku,
          name: skuItem.title,
          scope: activeScope,
          section: autoSection,
          vendorId: skuItem.store === 'hd' ? 'hd' : 'lw',
          quantity: quantity, // Use quantity from selector
          unitPrice: skuItem.price,
          total: (skuItem.price || 0) * quantity, // Calculate total based on quantity
          sku: skuItem.sku,
          url: skuItem.url,
          store: skuItem.store,
        };
        
        Alert.alert('Added!', `${skuItem.title} added to ${autoSection}`);
        return [...prev, row];
      }
    });
  };

  // Handle manual material & labor entries from full-page screens
  useFocusEffect(
    useCallback(() => {
      const checkForManualEntries = async () => {
        try {
          const [materialDataStr, laborDataStr] = await Promise.all([
            AsyncStorage.getItem('manualMaterialEntry'),
            AsyncStorage.getItem('manualLaborEntry'),
          ]);

          if (materialDataStr) {
            const materialData = JSON.parse(materialDataStr);
            await AsyncStorage.removeItem('manualMaterialEntry');
            
            const { name, quantity, unitPrice, vendorId, section } = materialData;
            const qty = Number(quantity);
            const price = Number(unitPrice);
            
            const autoSection = section || autoCategorizeMaterial(name, SECTIONS[activeScope]);
            const finalVendorId = vendorId || 'loc';
            
            const row = {
              id: String(Date.now()),
              itemId: `manual_${Date.now()}`,
              name: name.trim(),
              scope: activeScope,
              section: autoSection,
              vendorId: finalVendorId,
              quantity: qty,
              unitPrice: price,
              total: qty * price,
              isManual: true,
            };
            
            setMaterialsCart(prev => [...prev, row]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          if (laborDataStr) {
            const laborData = JSON.parse(laborDataStr);
            await AsyncStorage.removeItem('manualLaborEntry');

            const laborName = laborData.name?.trim() || 'Labor Item';
            const mode = laborData.mode === 'sqft' ? 'sqft' : 'hourly';
            const laborType = laborData.laborType === 'subcontractor' ? 'subcontractor' : 'inhouse';
            const hours = Number(laborData.hours) || Number(laborData.quantity) || 0;
            const rate = Number(laborData.rate) || 0;

            const laborRow = {
              id: String(Date.now()),
              name: laborName,
              mode,
              laborType,
              hours,
              rate,
              total: hours * rate,
            };

            setBid(prev => ({
              ...prev,
              laborLineItems: [...(prev.laborLineItems || []), laborRow],
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch (error) {
          console.error('Error processing manual entries:', error);
        }
      };
      
      checkForManualEntries();
    }, [activeScope])
  );
  
  const totalBySection = (section) => {
    return materialsCart
      .filter(r => r.scope === activeScope && r.section === section)
      .reduce((sum, r) => sum + r.total, 0);
  };
  
  const totalByScope = (scope) => {
    return materialsCart
      .filter(r => r.scope === scope)
      .reduce((sum, r) => sum + r.total, 0);
  };
  
  const grandMaterialsTotal = materialsCart.reduce((sum, r) => sum + r.total, 0);
  
  // Rental equipment helpers
  const handleRentalAttach = (rentalItem) => {
    const row = {
      id: Date.now(),
      scope: activeScope,
      section: 'Equipment',
      title: rentalItem.title,
      sku: rentalItem.sku,
      store: rentalItem.store,
      unit: rentalItem.unit || 'day',
      qty: 1,
      duration: 1, // days
      url: rentalItem.url,
    };
    
    setRentalCart(prev => [...prev, row]);
    Alert.alert('Added!', `${rentalItem.title} added to Equipment section`);
  };

  const updateRentalDuration = (id, duration) => {
    setRentalCart(prev => prev.map(item => 
      item.id === id ? { ...item, duration } : item
    ));
  };

  const removeRentalItem = (id) => {
    setRentalCart(prev => prev.filter(item => item.id !== id));
  };

  const grandRentalsTotal = rentalCart.reduce((sum, r) => sum + (r.duration || 1), 0);
  
  // Group materials by category for better organization
  const materialsByCategory = useMemo(() => {
    const groups = {};
    filteredCatalog.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredCatalog]);

  // Line item management
  const addMaterial = () => setMaterialModal({ visible: true, item: null });
  const editMaterial = (item) => setMaterialModal({ visible: true, item });
  const saveMaterial = (item) => {
    if (item.id) {
      // Update existing
      setBid(prev => ({
        ...prev,
        materialLineItems: prev.materialLineItems.map(m => m.id === item.id ? item : m)
      }));
    } else {
      // Add new
      const newItem = { ...item, id: String(Date.now()) };
      setBid(prev => ({
        ...prev,
        materialLineItems: [...(prev.materialLineItems || []), newItem]
      }));
    }
    setMaterialModal({ visible: false, item: null });
  };
  const deleteMaterial = (id) => {
    setBid(prev => ({
      ...prev,
      materialLineItems: prev.materialLineItems.filter(m => m.id !== id)
    }));
  };

  const addLabor = () => setLaborModal({ visible: true, item: null });
  const editLabor = (item) => setLaborModal({ visible: true, item });
  const saveLabor = (item) => {
    if (item.id) {
      // Update existing
      setBid(prev => ({
        ...prev,
        laborLineItems: prev.laborLineItems.map(l => l.id === item.id ? item : l)
      }));
    } else {
      // Add new
      const newItem = { ...item, id: String(Date.now()) };
      setBid(prev => ({
        ...prev,
        laborLineItems: [...(prev.laborLineItems || []), newItem]
      }));
    }
    setLaborModal({ visible: false, item: null });
  };
  const deleteLabor = (id) => {
    setBid(prev => ({
      ...prev,
      laborLineItems: prev.laborLineItems.filter(l => l.id !== id)
    }));
  };

  const createNewBid = () => {
    Alert.alert('New Bid', 'Start a new bid? Current bid will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New Bid',
        onPress: async () => {
          await backupCurrentEstimateSilently();
          try {
            await AsyncStorage.multiRemove([
              'bps.materialsCart',
              'bps.rentalCart',
              'manualMaterialEntry',
              'manualLaborEntry',
            ]);
          } catch (error) {
            console.warn('Failed to clear previous bid carts:', error);
          }

          const nextBid = blankState();
          lastSavedBidRef.current = null;
          pendingSaveRef.current = null;

          setMaterialsCart([]);
          setRentalCart([]);
          setBid(nextBid);
          setStep(1);
          setActiveScope('kitchen');

          try {
            await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(nextBid));
            console.log('🆕 Started new bid and saved blank state to storage');
          } catch (error) {
            console.warn('Failed to save new blank bid to storage:', error);
          }
        },
      },
    ]);
  };

  const applyTemplate = (template) => {
    const templates = {
      residential: { materials: 4200, labor: 3500, markupPct: 20, contingencyPct: 7, template: 'residential' },
      commercial: { materials: 8500, labor: 7200, markupPct: 18, contingencyPct: 5, template: 'commercial' },
      multifamily: { materials: 12000, labor: 10500, markupPct: 20, contingencyPct: 6, template: 'multifamily' },
    };
    setBid(prev => ({ ...prev, ...templates[template] }));
    Alert.alert('Template Applied', `${template} template loaded successfully!`);
  };


  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 0: {
        // Bid Summary - not a numbered step, accessible via Summary button
        // Calculate AI level and confidence from health score
        const aiLevel = healthScore >= 75 ? 'good' : healthScore >= 55 ? 'warn' : 'risk';
        const aiConfidence = aiLevel === 'good' ? 'High' : aiLevel === 'warn' ? 'Medium' : 'Low';
        const aiSummary = aiLevel === 'good'
          ? 'No major issues detected. Estimate looks on track.'
          : aiLevel === 'warn'
          ? 'Some items may need review. Consider verifying labor and scope.'
          : 'Risk detected. Labor-heavy bid and low health score—review before sending.';
        
        const maxBarHeight = 120;
        const maxValue = Math.max(calc.materials, calc.labor, calc.overhead, calc.profit, 1);
        const materialsHeight = (calc.materials / maxValue) * maxBarHeight;
        const laborHeight = (calc.labor / maxValue) * maxBarHeight;
        const overheadHeight = (calc.overhead / maxValue) * maxBarHeight;
        const markupHeight = (calc.profit / maxValue) * maxBarHeight;
        
        return (
          <View style={[s.wideContainer, {
            paddingVertical: 20,
            backgroundColor: Colors.card,
            marginBottom: 16,
            marginTop: 16,
          }]}>
                {/* Total Bid Section - green to blue gradient border */}
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                  marginBottom: 12,
                }}
              >
              <View style={{
                backgroundColor: '#000000',
                borderRadius: 18,
                padding: 20,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="heart" size={20} color="#22c55e" />
                    <Text style={{ color: Colors.text, fontSize: 14, marginLeft: 8, fontWeight: '600' }}>{healthScore}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trending-up" size={16} color="#22d3ee" />
                    <Text style={{ color: '#22d3ee', fontSize: 12, marginLeft: 4 }}>+4.9%</Text>
                  </View>
                </View>
                
                <Text style={{ color: Colors.sub, fontSize: 12, textAlign: 'center', marginBottom: 8, fontWeight: '600', letterSpacing: 1 }}>
                  TOTAL BID
                </Text>
                
                <Text style={{ color: Colors.text, fontSize: 36, textAlign: 'center', fontWeight: '700', marginBottom: 12 }}>
                  {money(calc.total)}
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                  <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8 }}>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>{money(calc.unitPrice)} / sqft</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>Markup {bid.markupPct || 0}%</Text>
                  </View>
                </View>
                
                {/* Bar Chart */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: maxBarHeight + 40, marginBottom: 8 }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.materials)}</Text>
                    <LinearGradient
                      colors={['#3b82f6', '#60a5fa']}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={{
                        width: '80%',
                        height: Math.max(materialsHeight, 8),
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Materi</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.labor)}</Text>
                    <LinearGradient
                      colors={['#22c55e', '#4ade80']}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={{
                        width: '80%',
                        height: Math.max(laborHeight, 8),
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Labor</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.overhead)}</Text>
                    <View
                      style={{
                        width: '80%',
                        height: Math.max(overheadHeight, 8),
                        backgroundColor: '#f59e0b',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Overhe</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.profit)}</Text>
                    <View
                      style={{
                        width: '80%',
                        height: Math.max(markupHeight, 8),
                        backgroundColor: '#a78bfa',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Markup</Text>
                  </View>
                </View>
              </View>
              </LinearGradient>
              
              {/* Cost Breakdown - green to blue gradient border */}
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                  marginBottom: 12,
                  marginTop: 12,
                }}
              >
                <View style={{
                  backgroundColor: '#000000',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
                      Cost Breakdown
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>
                      Materials, labor, overhead & markup
                    </Text>
                  </View>
                  {/* Full width cards with grey border and background */}
                  <View style={{ gap: 12 }}>
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Materials</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.materials)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Labor</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.labor)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Overhead</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.overhead)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a78bfa', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Markup ({bid.markupPct || 0}%)</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.profit)}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
              
              {/* Project Actions - no border */}
              <View style={{
                paddingTop: 24,
                paddingBottom: 24,
                backgroundColor: Colors.card,
                marginBottom: 0,
              }}>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 2 }}>
                    Project Actions
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 13 }}>
                    Save, submit or mark as won • Estimates save automatically
                  </Text>
                </View>
                
                  {/* Action Buttons Grid - grey buttons, Mark as Won has green-to-blue background */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {/* Save Bid - grey button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={saveCurrentEstimate}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="save-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Restore Bids - only show if there are saved bids */}
                    {savedEstimates.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          flex: 1, 
                          minWidth: '47%', 
                          backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={() => setShowRecoveryModal(true)}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="refresh-outline" size={16} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                            Restore Bids {savedEstimates.length > 0 && `(${savedEstimates.length})`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Submit Bid */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={handleSubmitBid}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="send-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Submit Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Mark as Won - green to blue background */}
                    <LinearGradient
                      colors={['#2DFFC4', '#00A6FF']}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={{ flex: 1, minWidth: '47%', borderRadius: 18 }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={handleMarkAsWon}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="trophy-outline" size={16} color="#000" />
                          <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>Mark as Won</Text>
                        </View>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
              </View>
            </View>
        );
      }
      
      case 1: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="person" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Customer Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Client contact details and preferences</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Customer Name *</Text>
                <TextInput
                  key="customerName"
                  style={s.input}
                  placeholder="Enter customer name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerName || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerName: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Email</Text>
                <TextInput
                  key="customerEmail"
                  style={s.input}
                  placeholder="customer@example.com"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerEmail || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerEmail: text }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Phone</Text>
                <TextInput
                  key="customerPhone"
                  style={s.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerPhone || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerPhone: text }));
                  }}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Address</Text>
                <TextInput
                  key="customerAddress"
                  style={s.input}
                  placeholder="Street address"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerAddress || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerAddress: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>City</Text>
                  <TextInput
                    key="customerCity"
                    style={s.input}
                    placeholder="City"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerCity || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerCity: text }));
                    }}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
                
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>State</Text>
                  <TextInput
                    key="customerState"
                    style={s.input}
                    placeholder="State"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerState || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerState: text }));
                    }}
                    maxLength={2}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>ZIP Code</Text>
                <TextInput
                  key="customerZip"
                  style={s.input}
                  placeholder="12345"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerZip || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerZip: text }));
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Company (Optional)</Text>
                <TextInput
                  key="customerCompany"
                  style={[s.input, { color: Colors.text }]}
                  placeholder="Company name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerCompany || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerCompany: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Notes</Text>
                <TextInput
                  key="customerNotes"
                  style={[s.input, { minHeight: 100, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Additional notes about the customer..."
                  placeholderTextColor={Colors.sub}
                  value={bid.customerNotes || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerNotes: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 2: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="information-circle" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Project Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Core details drive unit pricing and regional adjustments</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Title *</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="e.g., Kitchen Renovation"
                  placeholderTextColor={Colors.sub}
                  value={bid.title || ''}
                  onChangeText={(text) => updateBid('title', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Type</Text>
                <View style={s.chipRow}>
                  {PROJECT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[s.chip, bid.projectType === type.value && s.chipActive]}
                      onPress={() => updateBid('projectType', type.value)}
                    >
                      <Text style={[s.chipText, bid.projectType === type.value && { color: '#2DFFC4' }]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Square Footage</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="1250"
                  placeholderTextColor={Colors.sub}
                  value={bid.sqft?.toString() || ''}
                  onChangeText={(text) => updateBid('sqft', parseInt(text) || 0)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Description</Text>
                <TextInput
                  style={[s.input, { minHeight: 120, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Describe the project scope, requirements, and special considerations..."
                  placeholderTextColor={Colors.sub}
                  value={bid.scopeDescription || ''}
                  onChangeText={(text) => updateBid('scopeDescription', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={6}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Start Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowStartDateCalendar(!showStartDateCalendar)}
                >
                  <Text style={{ color: bid.startDate ? Colors.text : Colors.sub }}>
                    {bid.startDate ? new Date(bid.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select start date'}
                  </Text>
                </TouchableOpacity>
                {showStartDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('startDate', day.dateString);
                        setShowStartDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.startDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.startDate}
                    />
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>End Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowEndDateCalendar(!showEndDateCalendar)}
                >
                  <Text style={{ color: bid.endDate ? Colors.text : Colors.sub }}>
                    {bid.endDate ? new Date(bid.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select end date'}
                  </Text>
                </TouchableOpacity>
                {showEndDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('endDate', day.dateString);
                        setShowEndDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.endDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.endDate}
                    />
                  </View>
                )}
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 3: {
        const sections = SECTIONS[activeScope] || SECTIONS.other;
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
                {/* Header */}
                <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="cube-outline" size={20} color="#2DFFC4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Materials & Supplies</Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Live pricing and inflation tracking</Text>
                    </View>
                  </View>
                  
                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: materialModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: materialModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => setMaterialModal({ visible: true, item: null })}
                    >
                      <Ionicons name="add" size={18} color={materialModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                      <Text style={{ color: materialModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>Add Material</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: skuModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: skuModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => {
                        console.log('🔍 SKU Search button pressed');
                        console.log('🔍 Current skuModalVisible state:', skuModalVisible);
                        console.log('🔍 Setting skuModalVisible to true');
                        setSkuModalVisible(true);
                        // Force a re-render check
                        setTimeout(() => {
                          console.log('🔍 After setState - skuModalVisible should be true');
                        }, 100);
                      }}
                    >
                      <Ionicons name="barcode-outline" size={18} color={skuModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 8 }} />
                      <Text style={{ color: skuModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>SKU Search</Text>
                    </TouchableOpacity>
                  </View>
                </GlassBorderCard>
                
                {/* Materials Cart Summary */}
                <View style={{ marginTop: 16 }}>
                  <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                    <TouchableOpacity
                      onPress={() => setIsCartExpanded(!isCartExpanded)}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isCartExpanded ? 16 : 0 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="cart-outline" size={16} color="#22c55e" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                        Materials Cart
                      </Text>
                      {materialsCart.length > 0 && (
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>
                            {materialsCart.length}
                          </Text>
                        </View>
                      )}
                      <Ionicons
                        name={isCartExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Colors.sub}
                      />
                    </TouchableOpacity>
                    
                    {isCartExpanded && (
                      <>
                        {materialsCart.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                              <Ionicons name="cart-outline" size={28} color={Colors.sub} />
                            </View>
                            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                              Your cart is empty
                            </Text>
                            <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                              Add materials from the catalog below
                            </Text>
                          </View>
                        ) : (
                          <>
                            {materialsCart.map((item, index) => {
                              const isEditing = editingCartItem === index;
                              
                              return (
                                <View key={item.id || index} style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  borderRadius: 12,
                                  padding: 14,
                                  marginBottom: 10,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.1)',
                                }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                                        {item.name || item.description || 'Material'}
                                      </Text>
                                      {!isEditing ? (
                                        <>
                                          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                            {item.quantity || item.qty || 0} {item.unit || 'ea'} × {money(item.unitPrice || item.cost || 0)}
                                          </Text>
                                          {item.vendorId && (
                                            <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                              {VENDORS.find(v => v.id === item.vendorId)?.name || item.vendorId}
                                            </Text>
                                          )}
                                          {item.sku && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                              <Ionicons name="barcode-outline" size={12} color="#22d3ee" />
                                              <Text style={{ color: '#22d3ee', fontSize: 11, marginLeft: 4 }}>
                                                {item.sku}
                                              </Text>
                                            </View>
                                          )}
                                        </>
                                      ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = Math.max(1, (item.quantity || item.qty || 1) - 1);
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="remove" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                            <TextInput
                                              style={{ flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 6 }}
                                              value={String(item.quantity || item.qty || 1)}
                                              onChangeText={(text) => {
                                                const num = parseInt(text) || 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: num, qty: num, total: (it.unitPrice || it.cost || 0) * num } : it));
                                              }}
                                              keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                                            />
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = (item.quantity || item.qty || 1) + 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="add" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                          </View>
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(null)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary, borderRadius: 8 }}
                                          >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Done</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                        {money(item.total || 0)}
                                      </Text>
                                      <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {!isEditing && (
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(index)}
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: 14,
                                              backgroundColor: 'rgba(45, 255, 196, 0.15)',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Ionicons name="create-outline" size={14} color="#2DFFC4" />
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setMaterialsCart(prev => prev.filter((_, i) => i !== index));
                                            if (editingCartItem === index) setEditingCartItem(null);
                                          }}
                                          style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 14,
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                            
                            {materialsCart.length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert('Clear Cart?', 'This will remove all items from your cart.', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Clear', style: 'destructive', onPress: () => setMaterialsCart([]) },
                                  ]);
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingVertical: 10,
                                  marginTop: 8,
                                  marginBottom: 12,
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear Cart</Text>
                              </TouchableOpacity>
                            )}
                            
                            <View style={{
                              backgroundColor: 'rgba(45, 255, 196, 0.1)',
                              borderRadius: 12,
                              padding: 16,
                              borderWidth: 1,
                              borderColor: 'rgba(45, 255, 196, 0.3)',
                              marginTop: 8,
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                  {materialsCart.length}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                  Total Materials
                                </Text>
                                <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                  {money(materialsCart.reduce((sum, item) => sum + (item.total || 0), 0))}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </GlassBorderCard>
                </View>
            </View>
            
            {/* SKU Search Modal */}
            <AttachSkuModal
              visible={skuModalVisible}
              defaultZip={bid.customerZip || ''}
              onClose={() => setSkuModalVisible(false)}
              onAttach={handleSkuAttach}
              onOpenSaved={() => {
                setSkuModalVisible(false);
                setTimeout(() => setSavedMaterialsVisible(true), 300); // Small delay for smooth transition
              }}
            />

            {/* Saved Materials Modal */}
            <Modal
              visible={savedMaterialsVisible}
              animationType="slide"
              onRequestClose={() => setSavedMaterialsVisible(false)}
            >
              <SavedMaterialsScreen
                onClose={() => setSavedMaterialsVisible(false)}
                onAddToBid={(item) => {
                  // Convert saved material format to SKU item format
                  const skuItem = {
                    sku: item.sku,
                    title: item.title,
                    price: item.price,
                    store: (item.store === 'hd' || item.store === 'lowes') ? item.store : 'hd',
                    zip: item.zip || '',
                    url: item.url || '',
                    image: item.image || null,
                    unit: item.unit || null,
                    quantity: item.quantity || 1,
                  };
                  handleSkuAttach(skuItem);
                  setSavedMaterialsVisible(false);
                }}
              />
            </Modal>

            {/* Custom Deposit Input Modal (Android fallback) */}
            <Modal
              visible={customDepositModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomDepositModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Deposit</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter deposit percentage (0-50)</Text>
                  
                  <TextInput
                    value={customDepositModal.value}
                    onChangeText={(text) => setCustomDepositModal({ ...customDepositModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomDepositModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customDepositModal.value);
                        if (customDepositModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          const currentFinalPct = finalMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = numPct + currentFinalPct;
                          let adjustedFinalPct = currentFinalPct;
                          let remainingPct = 100 - numPct - currentFinalPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * numPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          updatedMilestones.unshift({
                            id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                            name: 'Deposit',
                            paymentAmount: depositAmount,
                            percentage: numPct,
                            type: 'deposit'
                          });
                          
                          // Update final milestone if it was adjusted
                          if (finalMilestone) {
                            updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                            updatedMilestones.push({
                              id: finalMilestone.id,
                              name: 'Final Completion',
                              paymentAmount: finalAmount,
                              percentage: adjustedFinalPct,
                              type: 'final'
                            });
                          }
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                            const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, currentGrandTotal);
                            
                            const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomDepositModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Custom Final Payment Input Modal (Android fallback) */}
            <Modal
              visible={customFinalModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomFinalModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Final Payment</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter final payment percentage (0-50)</Text>
                  
                  <TextInput
                    value={customFinalModal.value}
                    onChangeText={(text) => setCustomFinalModal({ ...customFinalModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomFinalModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customFinalModal.value);
                        if (customFinalModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          const currentDepositPct = depositMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = currentDepositPct + numPct;
                          let adjustedFinalPct = numPct;
                          let adjustedDepositPct = currentDepositPct;
                          let remainingPct = 100 - currentDepositPct - numPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * adjustedDepositPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone if it was adjusted
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          if (depositMilestone) {
                            updatedMilestones.unshift({
                              id: depositMilestone.id,
                              name: 'Deposit',
                              paymentAmount: depositAmount,
                              percentage: adjustedDepositPct,
                              type: 'deposit'
                            });
                          }
                          
                          // Update final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                          updatedMilestones.push({
                            id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                            name: 'Final Completion',
                            paymentAmount: finalAmount,
                            percentage: adjustedFinalPct,
                            type: 'final'
                          });
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            const updated = { ...prev, paymentMilestones: updatedMilestones, weeklyPayments: newWeekly };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomFinalModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        );
      }
      
      case 4: {
        const laborItems = bid.laborLineItems || [];
        const totalLabor = laborItems.reduce((sum, item) => sum + (item.total || 0), 0);
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              {/* Header */}
              <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="people-outline" size={20} color="#2DFFC4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Labor & Subcontractors</Text>
                    <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>In-house and subcontractor labor</Text>
                  </View>
                </View>
                
                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: laborModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: laborModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setLaborModal({ visible: true, item: null })}
                  >
                    <Ionicons name="add" size={18} color={laborModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                    <Text style={{ color: laborModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Add Labor Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: subcontractorModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: subcontractorModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.1)',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setSubcontractorModalVisible(true)}
                  >
                    <Ionicons name="search" size={18} color={subcontractorModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: subcontractorModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Find Subcontractor</Text>
                  </TouchableOpacity>
                </View>
              </GlassBorderCard>
              
              {/* Labor Cart Summary */}
              <View style={{ marginTop: 16 }}>
                <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                  <TouchableOpacity
                    onPress={() => setIsLaborCartExpanded(!isLaborCartExpanded)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isLaborCartExpanded ? 16 : 0 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="people-outline" size={16} color="#2DFFC4" />
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                      Labor Items
                    </Text>
                    {laborItems.length > 0 && (
                      <View style={{ backgroundColor: 'rgba(45, 255, 196, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                        <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '700' }}>
                          {laborItems.length}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name={isLaborCartExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={Colors.sub}
                    />
                  </TouchableOpacity>
                  
                  {isLaborCartExpanded && (
                    <>
                      {laborItems.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="people-outline" size={28} color={Colors.sub} />
                          </View>
                          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                            No labor items yet
                          </Text>
                          <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                            Add in-house labor or search for subcontractors
                          </Text>
                        </View>
                      ) : (
                        <>
                          {laborItems.map((item, index) => (
                            <View key={item.id || index} style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.1)',
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>
                                      {item.description || item.name || 'Labor'}
                                    </Text>
                                    {item.laborType === 'subcontractor' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#f59e0b',
                                      }}>
                                        <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>
                                          SUB
                                        </Text>
                                      </View>
                                    )}
                                    {item.laborType === 'inhouse' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#22c55e',
                                      }}>
                                        <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600' }}>
                                          IN-HOUSE
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                    {item.mode === 'sqft' ? (
                                      `${bid.sqft || 0} sqft × ${money(item.rate || 0)}/sqft`
                                    ) : (
                                      `${item.hours || 0} hrs × ${money(item.rate || 0)}/hr`
                                    )}
                                  </Text>
                                  {item.metadata && (
                                    <View style={{ marginTop: 4 }}>
                                      {item.metadata.rating && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          ⭐ {item.metadata.rating} ({item.metadata.reviews || 0} reviews)
                                        </Text>
                                      )}
                                      {item.metadata.location && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          📍 {item.metadata.location}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                    {money(item.total || 0)}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      Alert.alert(
                                        'Delete Labor Item?',
                                        `Remove "${item.description || item.name || 'Labor'}"?`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: () => {
                                              const updated = laborItems.filter(l => l.id !== item.id);
                                              updateBid('laborLineItems', updated);
                                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            }
                                          }
                                        ]
                                      );
                                    }}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ))}
                          
                          {laborItems.length > 1 && (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert('Clear All?', 'This will remove all labor items.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Clear', style: 'destructive', onPress: () => updateBid('laborLineItems', []) },
                                ]);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 10,
                                marginTop: 8,
                                marginBottom: 12,
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear All</Text>
                            </TouchableOpacity>
                          )}
                          
                          <View style={{
                            backgroundColor: 'rgba(45, 255, 196, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            marginTop: 8,
                          }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                              <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                {laborItems.length}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                Total Labor
                              </Text>
                              <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                {money(totalLabor)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </GlassBorderCard>
              </View>
            </View>
            
            {/* Subcontractor Search Modal */}
            <SubcontractorSearchModal
              visible={subcontractorModalVisible}
              onClose={() => setSubcontractorModalVisible(false)}
              onSelect={handleSubcontractorSelect}
              defaultZip={bid.customerZip || ''}
            />
          </>
        );
      }
      
      case 5: {
        // Load contractor type from profile or bid
        const contractorType = bid.contractorType || null;
        
        // Contractor type definitions
        const contractorTypes = {
          1: {
            name: 'Solo + Helper (No Subs)',
            description: 'I do everything myself',
            overheadRange: { min: 5, max: 8 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          2: {
            name: 'Small Crew + Subs',
            description: '1-3 guys + subcontractors',
            overheadRange: { min: 8, max: 12 },
            safeMarkupRange: { min: 20, max: 25 },
            defaultMarkup: 22,
          },
          3: {
            name: 'Subcontractor-Only GC',
            description: 'I manage, no direct labor',
            overheadRange: { min: 6, max: 10 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          4: {
            name: 'Large Crew + Subs',
            description: '5+ guys + subcontractors',
            overheadRange: { min: 12, max: 18 },
            safeMarkupRange: { min: 25, max: 30 },
            defaultMarkup: 27,
          },
        };
        
        // Ensure contractorType is a number for proper lookup
        const normalizedContractorType = contractorType ? parseInt(contractorType) : null;
        const contractorInfo = normalizedContractorType ? contractorTypes[normalizedContractorType] : null;
        
        // Calculate total overhead
        const totalOverhead = (bid.insuranceOverhead || 0) + 
                              (bid.equipment || 0) + 
                              (bid.facilities || 0) + 
                              (bid.otherOverhead || 0);
        
        // Calculate overhead as percentage of job total
        const jobTotal = calc?.grandTotal || calc?.total || 0;
        const overheadPct = jobTotal > 0 ? (totalOverhead / jobTotal) * 100 : 0;
        
        // Calculate recommended markup based on contractor type and job characteristics
        const materialsTotal = calc?.materials || 0;
        const laborTotal = calc?.labor || 0;
        const materialsRatio = jobTotal > 0 ? (materialsTotal / jobTotal) : 0.5;
        const laborRatio = jobTotal > 0 ? (laborTotal / jobTotal) : 0.5;
        
        // Recommended markup calculation based on contractor type
        // ALWAYS use contractor type default if set, otherwise calculate from job characteristics
        let recommendedMarkup;
        
        if (contractorInfo && normalizedContractorType) {
          // Use contractor type's default markup (this is the primary recommendation)
          recommendedMarkup = contractorInfo.defaultMarkup;
        } else {
          // Fallback: calculate based on job size and material/labor mix
          recommendedMarkup = 20;
          if (jobTotal > 100000) {
            recommendedMarkup = 22;
          } else if (jobTotal < 20000) {
            recommendedMarkup = 25;
          }
          if (laborRatio > 0.6) {
            recommendedMarkup += 2;
          }
          if (materialsRatio > 0.6) {
            recommendedMarkup -= 1;
          }
        }
        recommendedMarkup = Math.round(recommendedMarkup);
        
        // Calculate net profit (markup - overhead as % of subtotal)
        const currentMarkup = bid.markupPct || 0;
        const profit = calc?.profit || 0;
        const subtotal = calc?.subtotal || 0;
        const netProfitPct = subtotal > 0 ? ((profit - totalOverhead) / subtotal) * 100 : 0;
        
        // AI badge always shows - determine message and button text
        let showApplyButton = true; // Always show the AI badge
        let applyButtonText = '';
        let contextualMessage = null;
        const currentMarkupNum = Number(currentMarkup);
        const recommendedMarkupNum = Number(recommendedMarkup);
        const defaultMarkup = 20; // Global default markup
        
        if (contractorInfo && normalizedContractorType) {
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const rangeSize = maxMarkup - minMarkup;
          
          // Check if current markup matches default (20%) or recommended (within 1% tolerance)
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          const atMin = Math.abs(currentMarkupNum - minMarkup) <= 1;
          const atMax = Math.abs(currentMarkupNum - maxMarkup) <= 1;
          
          // If at minimum of range (which may also be the default), show range option
          if (atMin && rangeSize > 0) {
            // At minimum of range - show range option (e.g., "Apply 0-5%" for 20-25% range)
            applyButtonText = `Apply 0-${rangeSize}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'At minimum of range — can increase up to maximum',
              color: '#22c55e',
            };
          } else if (matchesRecommended && !atMin) {
            // At recommended (but not at min) - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (atMax) {
            // At maximum of range - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At maximum of range — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkupNum < minMarkup) {
            // Below minimum - show range needed to get into the safe range
            const diffToMin = Math.round(minMarkup - currentMarkupNum);
            const diffToMax = Math.round(maxMarkup - currentMarkupNum);
            applyButtonText = `Apply ${diffToMin}-${diffToMax}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkupNum > maxMarkup + 5) {
            // Far above range - show optional lower suggestion
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum > maxMarkup) {
            // Slightly above range
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'above',
              text: 'Above typical range — higher profitability',
              color: '#38d39f',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            // Within range but below recommended
            const diffToRecommended = Math.round(recommendedMarkupNum - currentMarkupNum);
            applyButtonText = `Apply ${diffToRecommended}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#38d39f',
            };
          } else {
            // Within range, above recommended but not far above
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        } else {
          // Generic logic if no contractor type
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          
          if (matchesDefault || matchesRecommended) {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkup < 15) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkup > 30) {
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#22c55e',
            };
          } else {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        }
        
        // Health badge based on NET PROFIT (markup - overhead), not just markup
        // Always show feedback, even if no subtotal yet
        let markupStatus = 'good';
        let markupStatusText = 'Right percentage – within typical range';
        let markupStatusColor = '#38d39f';
        
        if (subtotal > 0) {
          // Calculate based on net profit when we have subtotal
          if (netProfitPct < 5) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – net profit too low, increase markup';
            markupStatusColor = '#ef4444';
          } else if (netProfitPct < 8) {
            markupStatus = 'warn';
            markupStatusText = 'Too low – thin margins, consider increasing markup';
            markupStatusColor = '#fbbf24';
          } else if (netProfitPct >= 15) {
            markupStatus = 'strong';
            markupStatusText = 'Right percentage – strong profitability';
            markupStatusColor = '#38d39f'; // Green for "strong"
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – healthy and profitable';
            markupStatusColor = '#38d39f';
          }
        } else if (contractorInfo && normalizedContractorType) {
          // If no subtotal yet, validate based on markup vs contractor type range
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const currentMarkupNum = Number(currentMarkup);
          
          if (currentMarkupNum === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkupNum < minMarkup) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range for your business type';
            markupStatusColor = '#ef4444';
          } else if (currentMarkupNum > maxMarkup) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        } else {
          // Generic validation if no contractor type
          if (currentMarkup === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkup < 15) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range';
            markupStatusColor = '#ef4444';
          } else if (currentMarkup > 25) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        }
        
        return (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="calculator-outline" size={20} color="#2DFFC4" />
                  </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Overhead & Markup</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Break down overhead, tune markup</Text>
                </View>
              </View>
              
              {/* Contractor Type Selector */}
              <View style={s.inputGroup}>
                <Text style={s.label}>Business Type</Text>
                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8 }}>
                  Select your business model for personalized recommendations
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(contractorTypes).map(([type, info]) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        updateBid('contractorType', parseInt(type));
                        // Don't auto-apply markup - let user keep their current value and see recommendations
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '47%',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: normalizedContractorType === parseInt(type) 
                          ? '#38d39f' 
                          : 'rgba(255, 255, 255, 0.15)',
                        backgroundColor: normalizedContractorType === parseInt(type)
                          ? 'rgba(56, 211, 159, 0.1)'
                          : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <Text style={{ 
                        color: normalizedContractorType === parseInt(type) ? '#38d39f' : Colors.text, 
                        fontSize: 13, 
                        fontWeight: contractorType === parseInt(type) ? '700' : '600',
                        marginBottom: 4,
                      }}>
                        {info.name}
                      </Text>
                      <Text style={{ 
                        color: Colors.sub, 
                        fontSize: 11,
                      }}>
                        {info.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Show recommendations if contractor type is set */}
                {contractorInfo && (
                  <View style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(56, 211, 159, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(56, 211, 159, 0.2)',
                  }}>
                    <Text style={{ color: '#38d39f', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                      Suggested for {contractorInfo.name}:
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>
                      Markup: {contractorInfo.safeMarkupRange.min}–{contractorInfo.safeMarkupRange.max}% • 
                      Overhead: {contractorInfo.overheadRange.min}–{contractorInfo.overheadRange.max}%
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
                      Typical range — not a limit
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Insurance Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.insuranceOverhead && bid.insuranceOverhead !== 0 ? bid.insuranceOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('insuranceOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('insuranceOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Equipment</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.equipment && bid.equipment !== 0 ? bid.equipment.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('equipment', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('equipment', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Facilities</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.facilities && bid.facilities !== 0 ? bid.facilities.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('facilities', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('facilities', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Other Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.otherOverhead && bid.otherOverhead !== 0 ? bid.otherOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('otherOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('otherOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              {/* Total Overhead Summary */}
              {totalOverhead > 0 && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    ≈ {overheadPct.toFixed(1)}% of job total
                  </Text>
                </View>
              )}
              
              {/* Total Overhead and Markup Summary */}
              {(totalOverhead > 0 || (calc?.profit && calc.profit > 0)) && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead & Markup: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead + (calc?.profit || 0))}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Overhead: {money(totalOverhead)} + Markup: {money(calc?.profit || 0)}
                  </Text>
                  {jobTotal > 0 && (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>
                      ≈ {((totalOverhead + (calc?.profit || 0)) / jobTotal * 100).toFixed(1)}% of job total
                    </Text>
                  )}
                </View>
              )}
              
              {/* Total Bid Summary */}
              {calc && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
                    Total Bid: <Text style={{ color: '#22d3ee' }}>{money(calc?.grandTotal || calc?.total || 0)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Final project total including all costs, overhead, and markup
                  </Text>
                </View>
              )}
              
              <View style={s.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={s.label}>Markup Percentage</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Only update if not already at recommended (not "Apply 0%")
                      if (applyButtonText !== 'Apply 0%') {
                        // If it's a range (e.g., "Apply 0-5%"), apply the recommended markup
                        updateBid('markupPct', recommendedMarkup);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={{
                      backgroundColor: contextualMessage?.type === 'low' 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? 'rgba(56, 211, 159, 0.15)'
                        : 'rgba(251, 191, 36, 0.15)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={14} 
                      color={contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24'} 
                    />
                    <Text style={{ 
                      color: contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24', 
                      fontSize: 12, 
                      fontWeight: '600' 
                    }}>
                      {applyButtonText}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={markupInputRef}
                  style={[s.input, { color: Colors.text }]}
                  placeholder="20"
                  placeholderTextColor={Colors.sub}
                  value={markupPctText}
                  onFocus={() => {
                    isMarkupFocused.current = true;
                  }}
                  onChangeText={(text) => {
                    // Only update local state while typing - no re-renders of parent
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setMarkupPctText(cleaned);
                  }}
                  onBlur={() => {
                    isMarkupFocused.current = false;
                    // Only update bid state when done typing
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    // Also apply the value on submit
                    isMarkupFocused.current = false;
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  blurOnSubmit={true}
                />

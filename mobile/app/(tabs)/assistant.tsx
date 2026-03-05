import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AIAssistantModal from '@/components/AIAssistantModal';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});

export default function AssistantScreen() {
  useRequireAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { activeProjects, estimates, updateProject } = useProjectList();
  const [showAIAssistant, setShowAIAssistant] = useState(false); // Start false to prevent flash
  const [isReady, setIsReady] = useState(false);

  // Auto-open modal when this tab is focused
  useFocusEffect(
    React.useCallback(() => {
      // Small delay to ensure smooth transition
      setIsReady(true);
      setTimeout(() => {
        setShowAIAssistant(true);
      }, 50);
    }, [])
  );

  // Build context for AI Assistant
  const context = React.useMemo(() => {
    const allProjectsList = [...activeProjects, ...estimates];
    const mappedProjects = allProjectsList.map(p => ({
      id: p.id,
      title: p.title,
      customerName: (p as any).client || p.title,
      status: p.status,
      bidPrice: p.bidPrice || 0,
      estimatedCost: p.estimatedCost || 0,
      actualCost: p.actualCost || p.totalSpent || (p.projectData?.actualCost || p.projectData?.spent || 0),
      totalSpent: p.totalSpent || p.actualCost || (p.projectData?.spent || p.projectData?.actualCost || 0),
      expenses: p.expenses || p.projectData?.expenses || [],
      expensesCount: (p.expenses || p.projectData?.expenses || []).length,
      totalBudget: p.estimatedCost || p.bidPrice || 0,
      margin: p.margin || 0,
      markup: p.markup || 0,
    }));
    
    // If there's only one project, or if there's a "won" or "active" project, use it as current
    let currentProject = null;
    if (allProjectsList.length === 1) {
      currentProject = allProjectsList[0];
    } else {
      // Prefer active/won projects, then estimates
      currentProject = allProjectsList.find(p => 
        ['won', 'active', 'in_progress', 'in-progress'].includes((p.status || '').toLowerCase())
      ) || allProjectsList.find(p => 
        ['estimate', 'draft', 'bid_submitted', 'submitted'].includes((p.status || '').toLowerCase())
      ) || allProjectsList[0];
    }
    
    const contextObj: any = {
      screen: "AI Assistant Tab",
      allProjects: mappedProjects,
    };
    
    // Include current project info if available
    if (currentProject) {
      contextObj.projectName = currentProject.title;
      contextObj.projectId = currentProject.id;
      contextObj.currentProject = currentProject.title;
      contextObj.bidTitle = currentProject.title;
      contextObj.status = currentProject.status;
      contextObj.bidTotal = currentProject.bidPrice || currentProject.estimatedCost || 0;
      contextObj.total = currentProject.bidPrice || currentProject.estimatedCost || 0;
      contextObj.estimatedCost = currentProject.estimatedCost || 0;
      contextObj.actualCost = currentProject.actualCost || currentProject.totalSpent || (currentProject.projectData?.actualCost || currentProject.projectData?.spent || 0);
      contextObj.margin = currentProject.margin || 0;
      contextObj.markup = currentProject.markup || 0;
      contextObj.overheadPct = 12; // Default
    }
    
    return JSON.stringify(contextObj);
  }, [activeProjects, estimates]);

  const handleClose = () => {
    // Close the modal first, then navigate to dashboard
    console.log('✅ Back button pressed in Assistant tab, navigating to dashboard');
    setShowAIAssistant(false);
    // Use replace to avoid going back to this tab when back is pressed
    setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 150);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.bg }]}>
      {!isReady && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={handleClose}
        context={context}
        onAction={async (action) => {
          console.log('AI Action from Assistant page:', action);
          
          // Handle project expense actions (when user is in general AI Assistant page)
          if ((action.type === 'add_material' || action.type === 'add_material_purchase') && 
              action.projectId && 
              action.projectName) {
            // Find the project in activeProjects or estimates
            const allProjects = [...activeProjects, ...estimates];
            const project = allProjects.find(p => p.id === action.projectId);
            
            if (project) {
              const existingExpenses = (project.projectData?.expenses || []);
              // Normalize category: if it's a specific material name (Tile, Drywall, etc.), 
              // keep it as-is so it matches Materials/Equipment in CategoryDetailModal
              // The CategoryDetailModal will match specific material names to Materials/Equipment
              const expenseCategory = action.category || 'Materials/Equipment';
              
              const newExpense = {
                id: `exp-${Date.now()}`,
                category: expenseCategory, // Keep specific material names like "Tile", "Drywall", etc.
                vendor: action.vendor || '',
                amount: action.amount || 0,
                date: new Date().toISOString(),
                notes: action.notes || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                receiptUri: null,
              };
              
              const updatedExpenses = [...existingExpenses, newExpense];
              const newSpent = (project.projectData?.spent || 0) + (action.amount || 0);
              
              // CRITICAL: Update budget buckets to match the expense category
              // This ensures the expense shows up in the Materials & Equipment transactions
              const expenseCategoryLower = expenseCategory.toLowerCase();
              const updatedBuckets = (project.projectData?.buckets || []).map((bucket: any) => {
                const bucketName = (bucket.name || '').toLowerCase();
                
                // Exact match
                if (bucketName === expenseCategoryLower) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                // Flexible match for Materials/Equipment
                const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
                const isMaterialCategory = expenseCategoryLower.includes('materials') || 
                                         expenseCategoryLower.includes('equipment') ||
                                         ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                          'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                          'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                          'decking', 'fencing', 'landscaping'].includes(expenseCategoryLower);
                
                if (isMaterialsBucket && isMaterialCategory) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                // Flexible match for Labor
                if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                return bucket;
              });
              
              // Update project using ProjectListContext
              updateProject(action.projectId, {
                projectData: {
                  ...project.projectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                  buckets: updatedBuckets,
                  lastUpdated: new Date().toISOString(), // Ensure timestamp is updated
                },
              });
              
              // Also save to AsyncStorage directly for immediate sync with ProjectDataContext
              // CRITICAL: Load existing projectData from AsyncStorage first to preserve all fields
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                let existingProjectData = existingDataStr ? JSON.parse(existingDataStr) : {};
                
                // CRITICAL: Use expenses from AsyncStorage (existingProjectData) as the source of truth
                // This ensures deleted expenses don't come back
                const currentExpensesFromStorage = existingProjectData.expenses || [];
                const updatedExpensesFromStorage = [...currentExpensesFromStorage, newExpense];
                const newSpentFromStorage = (existingProjectData.spent || 0) + (action.amount || 0);
                
                // Update buckets based on storage expenses
                const expenseCategoryLower = expenseCategory.toLowerCase();
                const updatedBucketsFromStorage = (existingProjectData.buckets || []).map((bucket: any) => {
                  const bucketName = (bucket.name || '').toLowerCase();
                  
                  // Exact match
                  if (bucketName === expenseCategoryLower) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  // Flexible match for Materials/Equipment
                  const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
                  const isMaterialCategory = expenseCategoryLower.includes('materials') || 
                                           expenseCategoryLower.includes('equipment') ||
                                           ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                            'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                            'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                            'decking', 'fencing', 'landscaping'].includes(expenseCategoryLower);
                  
                  if (isMaterialsBucket && isMaterialCategory) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  // Flexible match for Labor
                  if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  return bucket;
                });
                
                // Merge with updated data, ensuring we preserve all existing fields
                // CRITICAL: Use expenses from AsyncStorage (not project.projectData) to avoid restoring deleted items
                const projectDataToSave = {
                  ...existingProjectData, // Preserve all existing fields (buckets, milestones, etc.)
                  expenses: updatedExpensesFromStorage, // Use expenses from storage + new expense
                  spent: newSpentFromStorage, // Use spent from storage + new amount
                  buckets: updatedBucketsFromStorage, // Use updated buckets from storage
                  lastUpdated: new Date().toISOString(),
                };
                
                await AsyncStorage.setItem(storageKey, JSON.stringify(projectDataToSave));
                console.log('✅ Saved expense to AsyncStorage with updated buckets');
                console.log('📊 Expense saved:', {
                  id: newExpense.id,
                  category: newExpense.category,
                  vendor: newExpense.vendor,
                  amount: newExpense.amount,
                });
                console.log('📊 Materials/Equipment bucket spent:', 
                  updatedBuckets.find((b: any) => 
                    (b.name || '').toLowerCase().includes('materials') || 
                    (b.name || '').toLowerCase().includes('equipment')
                  )?.spent || 0
                );
                console.log('📊 Total expenses count:', updatedExpensesFromStorage.length);
                console.log('📊 Total spent:', newSpentFromStorage);
                console.log('📊 All expenses:', updatedExpensesFromStorage.map((e: any) => ({ 
                  id: e.id, 
                  category: e.category, 
                  vendor: e.vendor, 
                  amount: e.amount 
                })));
              } catch (error) {
                console.error('Error saving to AsyncStorage:', error);
              }
              
              console.log('✅ Added expense to project:', action.projectName, action.amount, action.category);
            } else {
              console.warn('⚠️ Project not found:', action.projectId);
            }
          } else if (action.type === 'add_labor_expense' && action.projectId && action.projectName) {
            // Handle labor expenses
            const allProjects = [...activeProjects, ...estimates];
            const project = allProjects.find(p => p.id === action.projectId);
            
            if (project) {
              const existingExpenses = (project.projectData?.expenses || []);
              const newExpense = {
                id: `exp-${Date.now()}`,
                category: 'Labor',
                vendor: action.vendor || action.laborType || '',
                amount: action.amount || 0,
                date: new Date().toISOString(),
                notes: action.notes || `${action.laborType || 'Labor'} expense`,
                receiptUri: null,
              };
              
              const updatedExpenses = [...existingExpenses, newExpense];
              const newSpent = (project.projectData?.spent || 0) + (action.amount || 0);
              
              updateProject(action.projectId, {
                projectData: {
                  ...project.projectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                },
              });
              
              console.log('✅ Added labor expense to project:', action.projectName, action.amount);
            }
          } else if (action.type === 'mark_payment_collected' && action.projectId) {
            // Mark a payment milestone as collected
            try {
              const storageKey = `timeline_${action.projectId}`;
              const raw = await AsyncStorage.getItem(storageKey);
              const items = raw ? JSON.parse(raw) : [];
              const updated = items.map((item: any) => {
                if ((action.milestoneId && item.id === action.milestoneId) ||
                    (action.milestoneName && (item.title || '').toLowerCase().includes(action.milestoneName.toLowerCase()))) {
                  return { ...item, status: 'collected', collectedAt: action.collectedAt || new Date().toISOString(), collectedAmount: action.amount };
                }
                return item;
              });
              await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
              console.log('✅ Payment marked as collected from assistant page');
            } catch (e) {
              console.error('❌ Error marking payment collected:', e);
            }
          } else if (action.type === 'add_daily_log' && action.projectId) {
            // Save daily log to AsyncStorage
            try {
              const logKey = `daily_logs_${action.projectId}`;
              const raw = await AsyncStorage.getItem(logKey);
              const logs = raw ? JSON.parse(raw) : [];
              logs.push({
                id: action.id || `log-${Date.now()}`,
                date: action.date || new Date().toISOString().split('T')[0],
                noteText: action.noteText,
                weather: action.weather || null,
                crewCount: action.crewCount || null,
                hoursWorked: action.hoursWorked || null,
                createdAt: new Date().toISOString(),
              });
              await AsyncStorage.setItem(logKey, JSON.stringify(logs));
              console.log('✅ Daily log saved from assistant page');
            } catch (e) {
              console.error('❌ Error saving daily log:', e);
            }
          } else if (action.type === 'create_change_order' && action.projectId) {
            // Create change order - map backend fields to expected format
            try {
              const co = action.changeOrder || {};
              const project = [...activeProjects, ...estimates].find(p => p.id === action.projectId);
              if (project) {
                // Map backend CO fields to the format expected by the change orders page
                const mappedCO = {
                  id: co.id || `co-${Date.now()}`,
                  title: co.description || co.title || 'Change Order',
                  amount: co.clientPrice || co.cost || co.amount || 0,
                  approved: true,
                  notes: co.vendor ? `Vendor: ${co.vendor}` : '',
                  status: 'Approved',
                  materialsAmount: co.cost || co.amount || 0,
                  laborAmount: 0,
                  date: co.createdAt || new Date().toISOString(),
                };
                const existingCOs = project.projectData?.changeOrders || [];
                const updatedCOs = [...existingCOs, mappedCO];
                const currentBudget = Number(project.projectData?.budgeted || 0);
                updateProject(action.projectId, {
                  projectData: {
                    ...project.projectData,
                    changeOrders: updatedCOs,
                    changeOrderTotal: updatedCOs.reduce((s: number, c: any) => s + Number(c.amount || c.cost || 0), 0),
                    budgeted: currentBudget + mappedCO.amount,
                  },
                });
                console.log('✅ Change order created from assistant page:', mappedCO.title, '$' + mappedCO.amount);
              }
            } catch (e) {
              console.error('❌ Error creating change order:', e);
            }
          } else if (action.type === 'populate_estimate' && action.projectId) {
            // Populate estimate with AI-generated data
            try {
              const est = action.estimate;
              const project = [...activeProjects, ...estimates].find(p => p.id === action.projectId);
              if (project) {
                updateProject(action.projectId, {
                  projectData: {
                    ...project.projectData,
                    estimateData: {
                      ...(project.projectData?.estimateData || {}),
                      materialLineItems: est.materialLineItems || [],
                      laborLineItems: est.laborLineItems || [],
                      overheadItems: est.overheadItems || [],
                      materialTotal: est.materialTotal,
                      laborTotal: est.laborTotal,
                      overheadTotal: est.overheadTotal,
                      totalCost: est.baseCost,
                      markupPct: est.markupPct,
                      markup: est.markup,
                      totalBid: est.totalBid,
                      generatedByAI: true,
                      generatedAt: new Date().toISOString(),
                    },
                  },
                });
                console.log('✅ Estimate populated from assistant page');
              }
            } catch (e) {
              console.error('❌ Error populating estimate:', e);
            }
          }
        }}
      />
    </View>
  );
}

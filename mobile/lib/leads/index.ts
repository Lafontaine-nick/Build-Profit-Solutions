/**
 * Lead Management System
 * Main export file for the new leads system
 */

// Types
export * from './types';

// Store
export { useLeadStore } from './store';

// AI Functions
export { scoreLead, rankContractors } from './ai';
export * from './ai/advanced-scoring';

// Automation
export * from './automation/smart-automation';

// Enrichment
export * from './enrichment/lead-enrichment';

// Analytics
export * from './analytics/predictive-analytics';

// Components
export { default as LeadCard } from './components/LeadCard';
export { ScreenHeader } from './components/ScreenHeader';
export { default as ModernLeadsSystem } from './components/ModernLeadsSystem';
export { default as AnalyticsDashboard } from './components/AnalyticsDashboard';
export { default as AdvancedFilters } from './components/AdvancedFilters';
export { default as StageRail } from './components/StageRail';
export { default as ActionBar } from './components/ActionBar';

// UI Tokens
export * from './ui/tokens';

// Screens
export { default as NewScreen } from './screens/NewScreen';
export { default as VerifyScreen } from './screens/VerifyScreen';
export { default as QualifiedScreen } from './screens/QualifiedScreen';
export { default as PipelineScreen } from './screens/PipelineScreen';
export { default as AutomationScreen } from './screens/AutomationScreen';
export { default as LeadDetailScreen } from './screens/LeadDetailScreen';

// Navigation
export { default as LeadNavigation } from './navigation/LeadNavigation';
export * from './navigation/types';

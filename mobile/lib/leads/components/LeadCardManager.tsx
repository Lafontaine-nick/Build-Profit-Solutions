/**
 * Lead Card Manager
 * Manages different lead card display modes and handles card rendering
 */

import React from 'react';
import { Lead } from '../types';
import CompactLeadCard from './CompactLeadCard';
import DetailedLeadCard from './DetailedLeadCard';

export type CardDisplayMode = 'compact' | 'detailed';

interface LeadCardManagerProps {
  lead: Lead;
  mode: CardDisplayMode;
  onPress: () => void;
  onAddNote: (lead: Lead) => void;
  onSetReminder: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onStageChange?: (lead: Lead, newStage: string) => void;
}

export default function LeadCardManager({
  lead,
  mode,
  onPress,
  onAddNote,
  onSetReminder,
  onDelete,
  onStageChange,
}: LeadCardManagerProps) {
  // Render different card types based on mode
  switch (mode) {
    case 'compact':
      return (
        <CompactLeadCard
          lead={lead}
          onPress={onPress}
          onAddNote={onAddNote}
          onSetReminder={onSetReminder}
          onStageChange={onStageChange}
        />
      );

    case 'detailed':
      return (
        <DetailedLeadCard
          lead={lead}
          onPress={onPress}
          onDelete={onDelete}
          onAddNote={onAddNote}
          onSetReminder={onSetReminder}
          onStageChange={onStageChange}
        />
      );

    default:
      return (
        <CompactLeadCard
          lead={lead}
          onPress={onPress}
          onAddNote={onAddNote}
          onSetReminder={onSetReminder}
        />
      );
  }
}

// Card mode descriptions for UI
export const CARD_MODE_INFO = {
  compact: {
    name: 'Compact',
    description: 'Balanced - key details with expandable info',
    icon: 'view-module',
    color: '#43cea2',
    features: [
      'All essential information',
      'Quality indicators',
      'Expandable details',
      'Full quick actions',
      'Market pricing (when available)'
    ],
  },
  detailed: {
    name: 'Detailed',
    description: 'Full information - comprehensive view',
    icon: 'view-comfy',
    color: '#8B5CF6',
    features: [
      'Complete lead information',
      'All analytics & insights',
      'Photo galleries',
      'Competitor intelligence',
      'Customer LTV analysis',
      'Engagement tracking'
    ],
  },
};

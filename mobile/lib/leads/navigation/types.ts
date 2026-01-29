/**
 * Navigation Types for Lead Management System
 */

export type RootStackParamList = {
  LeadTabs: undefined;
  LeadDetail: { id: string };
};

export type LeadTabParamList = {
  New: undefined;
  Verify: undefined;
  Qualified: undefined;
  Pipeline: undefined;
  Automation: undefined;
};




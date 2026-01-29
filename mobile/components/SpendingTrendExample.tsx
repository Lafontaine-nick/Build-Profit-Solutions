import React from 'react';
import { ScrollView } from 'react-native';
import SpendingTrendChart from '@/components/SpendingTrendChart';

// Example data: cumulative spend by day (or by transaction date)
const exampleData = [
  { date: '2025-11-01', spent: 5000 },
  { date: '2025-11-12', spent: 12000 },
  { date: '2025-12-05', spent: 18000 },
  { date: '2026-01-03', spent: 20000 },
  { date: '2026-02-07', spent: 21500 },
  { date: '2026-03-02', spent: 32000 },
  { date: '2026-04-01', spent: 41000 },
];

export default function BudgetSection() {
  return (
    <ScrollView>
      <SpendingTrendChart
        plannedBudget={45000}
        data={exampleData}
        // Optional: customize colors
        // tintBudget="#00e0a4"
        // tintActual="#66a3ff"
      />
    </ScrollView>
  );
} 
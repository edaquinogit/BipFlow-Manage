import type { Component } from 'vue';

export interface StatItem {
  label: string;
  value: string | number;
  icon: Component;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose'; // Cores semânticas
  trend?: {
    value: string;
    isPositive: boolean;
  };
}
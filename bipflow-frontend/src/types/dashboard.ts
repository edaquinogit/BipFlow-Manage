import type { Component } from "vue";

/**
 * 🛰️ BIPFLOW SEMANTIC DESIGN SYSTEM
 * Define as cores permitidas para manter a consistência visual do Dashboard.
 */
export type StatColor =
  | "indigo"
  | "orange"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan";

/**
 * 📈 TREND INDICATOR (TELEMETRY)
 * Representa a variação de performance comparada ao período anterior.
 */
export interface StatTrend {
  value: string;
  isPositive: boolean;
  label?: string; // Ex: "vs last month"
}

/**
 * 📊 STAT ITEM (THE NYC STANDARD)
 * Contrato principal para os cards de métricas do Dashboard.
 */
export interface StatItem {
  id: string; // Identificador único para loops (key)
  label: string; // Nome da métrica (ex: Total Revenue)
  value: string | number; // O valor formatado vindo do useProducts
  icon: Component; // O componente de ícone (Lucide/Heroicons)
  color: StatColor; // Cor semântica obrigatória para o Ring/Icon
  isLoading?: boolean; // Estado de esqueleto (Skeleton)
  trend?: StatTrend; // Telemetria de crescimento/queda
  description?: string; // Tooltip ou texto auxiliar para acessibilidade
}

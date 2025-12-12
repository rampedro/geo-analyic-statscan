export enum MetricType {
  RealEstate = 'RealEstate',
  Crime = 'Crime',
  Social = 'Social'
}

// Updated hierarchy to match provided data sources
export type LODLevel = 'PROVINCE' | 'CMA' | 'CD' | 'CCS' | 'FSA' | 'DA';

export interface GeoHierarchy {
  id: string;
  name: string;
  type: 'PR' | 'CMA' | 'CD' | 'CCS' | 'FSA' | 'DA'; 
  label: string;
}

export interface DataProduct {
  id: string;
  title: string;
  category: 'Demographics' | 'Labour' | 'Housing' | 'Economy' | 'Health' | 'Education' | 'Transport';
  description: string;
  variableName: string;
  units: string;
  releaseDate?: string;
  frequency?: 'Monthly' | 'Quarterly' | 'Annual' | 'Occasional';
  dimensions: 1 | 2 | 3; // 1=Dot, 2=Line, 3=Triangle
}

export interface GeoPoint {
  id: string;
  name: string; 
  lat: number;
  lng: number;
  
  // Primary value for legacy glyphs
  value: number; 
  trend: number; 
  
  // Multivariable store: { [productId]: value }
  metrics: Record<string, number>;
  parentMetrics?: Record<string, number>;
  
  category?: string;
  lod: LODLevel;
  postalCode?: string;
  parentId?: string;
  
  [key: string]: any;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export type AIProvider = 'gemini' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  geminiKey?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}
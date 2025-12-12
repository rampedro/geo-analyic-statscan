export enum MetricType {
  RealEstate = 'RealEstate',
  Crime = 'Crime',
  Social = 'Social'
}

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
  category: string; // Changed to string to support dynamic categories from WDS
  description: string;
  variableName: string;
  units: string;
  releaseDate?: string;
  frequency?: 'Monthly' | 'Quarterly' | 'Annual' | 'Occasional';
  dimensions: 1 | 2 | 3; 
}

export interface GeoPoint {
  id: string;
  name: string; 
  lat: number;
  lng: number;
  value: number; 
  trend: number; 
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

export interface VisualSettings {
  glyphSizeScale: number;
  opacity: number;
  strokeWidth: number;
  darkMode: boolean;
}

export interface AIConfig {
  provider: 'gemini' | 'ollama';
  ollamaUrl?: string;
  ollamaModel?: string;
}

// --- WDS Specific Types ---

export interface WDSCubeLite {
  productId: number;
  cubeTitleEn: string;
  releaseTime: string;
  subjectCode: string[];
}

export interface WDSCodeSet {
  scalarFactorCode: number;
  scalarFactorDescEn: string;
  frequencyCode: number;
  frequencyDescEn: string;
  // Add others as needed
}

export interface LoadingTask {
  id: string;
  message: string;
  progress?: number; // 0 to 100
  type: 'info' | 'success' | 'error';
}

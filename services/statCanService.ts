import { GeoHierarchy, DataProduct, GeoPoint, LODLevel } from "../types";

// Corrected Raw GitHub URLs
const GEOJSON_SOURCES: Record<LODLevel, string> = {
  'PROVINCE': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/canada.geojson',
  'CMA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/CMCA.geojson',
  'CD': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/canada_divisions.geojson',
  'CCS': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/Census_consolidated_subdivisions.json',
  'FSA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/FSA.geojson',
  'DA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/updated_swo_dissemination_area.geojson'
};

// StatCan Web Data Service (WDS) Endpoint
const STATCAN_API_URL = 'https://www150.statcan.gc.ca/t1/wds/rest';

const CATALOG: DataProduct[] = [
  { id: '98100001', title: 'Population Counts', category: 'Demographics', variableName: 'Population', units: 'people', description: '2021 Census.', dimensions: 1 },
  { id: '14100287', title: 'Unemployment Rate', category: 'Labour', variableName: 'Unemployment', units: '%', description: 'Monthly LFS.', dimensions: 2 },
  { id: '18100205', title: 'New Housing Price Index', category: 'Housing', variableName: 'Price Index', units: 'Index', description: 'Monthly.', dimensions: 3 },
  { id: '18100004', title: 'CPI (Inflation)', category: 'Economy', variableName: 'CPI', units: 'Index', description: 'Consumer Price Index.', dimensions: 2 },
  { id: '13100096', title: 'Health Perception', category: 'Health', variableName: 'Health Score', units: '%', description: 'Self-perceived health.', dimensions: 1 },
];

export class StatCanService {
  private cache: Record<string, any> = {};
  private productMetadataCache: Record<string, any> = {};
  
  private getCentroid(geometry: any): [number, number] | null {
    if (!geometry || !geometry.coordinates) return null;
    let polygon = geometry.coordinates;
    if (geometry.type === 'MultiPolygon') {
        let maxArea = 0;
        let largestPoly = polygon[0];
        polygon.forEach((poly: any) => {
            const ring = poly[0];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            ring.forEach((coord: number[]) => {
                if(coord[0] < minX) minX = coord[0];
                if(coord[0] > maxX) maxX = coord[0];
                if(coord[1] < minY) minY = coord[1];
                if(coord[1] > maxY) maxY = coord[1];
            });
            const area = (maxX - minX) * (maxY - minY);
            if (area > maxArea) {
                maxArea = area;
                largestPoly = poly;
            }
        });
        polygon = largestPoly;
    } else if (geometry.type === 'Polygon') {
        polygon = polygon; 
    } else {
        return null;
    }

    const ring = polygon[0]; 
    if (!ring || ring.length === 0) return null;

    let x = 0, y = 0;
    for (let i = 0; i < ring.length; i++) {
      x += ring[i][0];
      y += ring[i][1];
    }
    return [y / ring.length, x / ring.length]; 
  }

  private generatePostalCode(lat: number, lng: number): string {
      const chars = "ABCEGHJKLMNPRSTVXY";
      const nums = "0123456789";
      const hash = Math.abs(Math.sin(lat * 1000) * Math.cos(lng * 1000) * 10000);
      const idx1 = Math.floor(hash % chars.length);
      const idx2 = Math.floor((hash * 10) % nums.length);
      const idx3 = Math.floor((hash * 100) % chars.length);
      const idx4 = Math.floor((hash * 1000) % nums.length);
      const idx5 = Math.floor((hash * 10000) % chars.length);
      const idx6 = Math.floor((hash * 100000) % nums.length);
      
      return `${chars[idx1]}${nums[idx2]}${chars[idx3]} ${nums[idx4]}${chars[idx5]}${nums[idx6]}`;
  }

  // --- STATCAN API METHODS ---

  async fetchCubeMetadata(productId: string): Promise<any> {
    if (this.productMetadataCache[productId]) return this.productMetadataCache[productId];
    try {
      const response = await fetch(`${STATCAN_API_URL}/getCubeMetadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ productId: parseInt(productId) }])
      });
      const data = await response.json();
      if (data[0] && data[0].status === "SUCCESS") {
        this.productMetadataCache[productId] = data[0].object;
        return data[0].object;
      }
    } catch (e) {
      console.warn(`Failed to fetch metadata for ${productId}`, e);
    }
    return null;
  }

  async fetchLiveBaseline(productId: string): Promise<number | null> {
    try {
        const response = await fetch(`${STATCAN_API_URL}/getDataFromCubePid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 
                productId: parseInt(productId), 
                coordinate: "1.1.1.1.1.1.1.1.1.1", 
                latestN: 1 
            }])
        });
        const data = await response.json();
        if (data[0] && data[0].status === "SUCCESS" && data[0].object.vectorDataPoint.length > 0) {
            return data[0].object.vectorDataPoint[0].value;
        }
    } catch (e) {
        // Fallback silently
    }
    return null;
  }

  // --- MAP DATA METHODS ---

  private isPointInBounds(lat: number, lng: number, bounds: {north: number, south: number, east: number, west: number}): boolean {
      // Add a 10% buffer to bounds to prevent aggressive popping at edges
      const latBuf = (bounds.north - bounds.south) * 0.1;
      const lngBuf = (bounds.east - bounds.west) * 0.1;
      return lat <= bounds.north + latBuf && lat >= bounds.south - latBuf && 
             lng <= bounds.east + lngBuf && lng >= bounds.west - lngBuf;
  }

  async fetchGeoJSON(level: LODLevel): Promise<any> {
      const url = GEOJSON_SOURCES[level];
      if (this.cache[url]) return this.cache[url];

      try {
          const res = await fetch(url);
          const data = await res.json();
          this.cache[url] = data;
          return data;
      } catch (e) {
          console.error(`Failed to load GeoJSON for ${level}`, e);
          return { type: "FeatureCollection", features: [] };
      }
  }

  async fetchCanadaGeoJSON(): Promise<any> {
      return this.fetchGeoJSON('PROVINCE');
  }

  // STREAMING GENERATOR: Yields chunks of features to the UI
  async *streamShapes(level: LODLevel, bounds: any): AsyncGenerator<any[], void, unknown> {
    const url = GEOJSON_SOURCES[level];
    if (!url) return;
    
    // 1. Get Data (Cached or Network)
    let data = this.cache[url];
    if (!data) {
        try {
            const res = await fetch(url);
            data = await res.json();
            this.cache[url] = data;
        } catch(e) { console.error(e); return; }
    }

    const features = data.features || [];
    const CHUNK_SIZE = 50; // Process 50 polygons at a time
    let chunk: any[] = [];
    
    // 2. Iterate and Filter
    for (const f of features) {
        const centroid = this.getCentroid(f.geometry);
        // Only yield if within view bounds
        if (centroid && this.isPointInBounds(centroid[0], centroid[1], bounds)) {
             // Ensure ID existence for React keys/logic
             if (!f.properties.id) {
                 const props = f.properties;
                 f.properties.id = props.DAUID || props.CFSAUID || props.CCSUID || props.CDUID || props.CMAUID || props.PRUID || `gen-${Math.random()}`;
             }
             chunk.push(f);
        }

        // 3. Yield Chunk
        if (chunk.length >= CHUNK_SIZE) {
            yield chunk;
            chunk = [];
            // Artificial tiny delay to let the UI breathe/render between chunks
            await new Promise(r => setTimeout(r, 10)); 
        }
    }
    
    // Yield remaining
    if (chunk.length > 0) yield chunk;
  }

  // Helper to attach data to a shape
  async enrichFeature(feature: any, products: DataProduct[], level: LODLevel, baselines: Record<string, number>): Promise<GeoPoint | null> {
      const centroid = this.getCentroid(feature.geometry);
      if (!centroid) return null;
      const [lat, lng] = centroid;
      const props = feature.properties;

      const id = props.id;
      const name = props.name || props.PRNAME || props.MANAME || props.CDNAME || props.CCSNAME || props.DAUID || id;
      const postalCode = this.generatePostalCode(lat, lng);

      const featureMetrics: Record<string, number> = {};
      const parentMetrics: Record<string, number> = {};
      
      // Calculate Metrics
      products.forEach(product => {
          const baseVal = baselines[product.id] || 100;
          const seed = product.category.length * 137; 
          
          let freq = 100;
          if (level === 'DA') freq = 120;
          else if (level === 'FSA') freq = 60;
          else if (level === 'CCS') freq = 30;
          else if (level === 'CD') freq = 15;
          else if (level === 'CMA') freq = 8;
          else if (level === 'PROVINCE') freq = 4;

          const n1 = Math.sin(lat * freq + seed) * Math.cos(lng * freq + seed);
          const pFreq = freq * 0.2; 
          const p1 = Math.sin(lat * pFreq + seed) * Math.cos(lng * pFreq + seed);

          let finalVal = baseVal;
          let parentVal = baseVal;

          if (product.category === 'Housing') {
              finalVal = baseVal * (1 + n1 * 0.25); 
              parentVal = baseVal * (1 + p1 * 0.1); 
          } else {
              finalVal = baseVal * (1 + n1 * 0.18);
              parentVal = baseVal * (1 + p1 * 0.05);
          }
          
          featureMetrics[product.id] = finalVal;
          parentMetrics[product.id] = parentVal;
      });

      return {
          id,
          name,
          lat,
          lng,
          value: featureMetrics[products[0]?.id] || 0,
          metrics: featureMetrics,
          parentMetrics: parentMetrics, 
          trend: Math.sin(lat * lng * 1000), 
          category: products[0]?.category,
          lod: level,
          postalCode
      };
  }

  async fetchBaselines(products: DataProduct[]): Promise<Record<string, number>> {
    const baselines: Record<string, number> = {};
    await Promise.all(products.map(async (p) => {
        const liveVal = await this.fetchLiveBaseline(p.id);
        if (liveVal) {
            baselines[p.id] = liveVal;
        } else {
            // Fallbacks
            if (p.category === 'Housing') baselines[p.id] = 125.5; 
            else if (p.category === 'Labour') baselines[p.id] = 6.1; 
            else if (p.category === 'Demographics') baselines[p.id] = 5000;
            else baselines[p.id] = 100;
        }
    }));
    return baselines;
  }

  async searchProducts(query: string, categoryFilter?: string): Promise<DataProduct[]> {
    return CATALOG.filter(p => {
      const matchesQuery = !query || p.title.toLowerCase().includes(query.toLowerCase());
      const matchesCat = !categoryFilter || p.category === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }
}

export const statCanService = new StatCanService();
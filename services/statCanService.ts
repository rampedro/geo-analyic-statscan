import { DataProduct, GeoPoint, LODLevel, WDSCubeLite } from "../types";

const GEOJSON_SOURCES: Record<LODLevel, string> = {
  'PROVINCE': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/canada.geojson',
  'CMA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/CMCA.geojson',
  'CD': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/canada_divisions.geojson',
  'CCS': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/Census_consolidated_subdivisions.json',
  'FSA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/FSA.geojson',
  'DA': 'https://raw.githubusercontent.com/rampedro/ShinyR-d3/main/updated_swo_dissemination_area.geojson'
};

const STATCAN_API_URL = 'https://www150.statcan.gc.ca/t1/wds/rest';

// Static fallback catalog with Real PIDs
const CATALOG: DataProduct[] = [
  { id: '98100001', title: 'Population Counts (Census)', category: 'Demographics', variableName: 'Population', units: 'people', description: '2021 Census.', dimensions: 1 },
  { id: '14100287', title: 'Unemployment Rate (LFS)', category: 'Labour', variableName: 'Unemployment', units: '%', description: 'Monthly LFS.', dimensions: 2 },
  { id: '18100205', title: 'New Housing Price Index', category: 'Housing', variableName: 'Price Index', units: 'Index', description: 'Monthly.', dimensions: 3 },
  { id: '18100004', title: 'Consumer Price Index (CPI)', category: 'Economy', variableName: 'CPI', units: 'Index', description: 'Inflation.', dimensions: 2 },
  { id: '13100096', title: 'Perceived Health (CCHS)', category: 'Health', variableName: 'Health Score', units: '%', description: 'Self-perceived health.', dimensions: 1 },
];

export class StatCanService {
  private cache: Record<string, any> = {};
  private productMetadataCache: Record<string, any> = {};
  private baselineCache: Record<string, number> = {}; // Cache for real data values
  private scalarCodes: Record<number, number> = {}; 
  private fullCubeList: WDSCubeLite[] | null = null;
  
  constructor() {
      // Initialize scalar codes (default to units)
      this.scalarCodes[0] = 1;
  }

  // --- GEOMETRY UTILS ---
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
      return `${chars[Math.floor(hash % 18)]}${nums[Math.floor((hash*10) % 10)]}${chars[Math.floor((hash*100) % 18)]} ${nums[Math.floor((hash*1000) % 10)]}${chars[Math.floor((hash*10000) % 18)]}${nums[Math.floor((hash*100000) % 10)]}`;
  }

  // --- WDS API METHODS ---

  async fetchCodeSets(): Promise<void> {
      try {
          const res = await fetch(`${STATCAN_API_URL}/getCodeSets`);
          const json = await res.json();
          if (json.status === 'SUCCESS' && json.object.scalar) {
              json.object.scalar.forEach((s: any) => {
                  let factor = 1;
                  const desc = s.scalarFactorDescEn.toLowerCase();
                  if (desc.includes('thousands')) factor = 1000;
                  else if (desc.includes('millions')) factor = 1000000;
                  else if (desc.includes('billions')) factor = 1000000000;
                  else if (desc.includes('hundreds')) factor = 100;
                  this.scalarCodes[s.scalarFactorCode] = factor;
              });
          }
      } catch (e) {
          console.warn("Failed to fetch CodeSets, defaulting to units.");
      }
  }

  // Get the real value for the latest period.
  async fetchLiveBaseline(productId: string): Promise<number | null> {
    if (this.baselineCache[productId]) return this.baselineCache[productId];

    // Ensure scalar codes are loaded
    if (Object.keys(this.scalarCodes).length === 1) await this.fetchCodeSets();

    try {
        const response = await fetch(`${STATCAN_API_URL}/getDataFromCubePidCoordAndLatestNPeriods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 
                productId: parseInt(productId), 
                coordinate: "1.1.1.1.1.1.1.1.1.1", // Generic 'Canada' or top-level coordinate for this cube
                latestN: 1 
            }])
        });
        const data = await response.json();
        
        if (data[0] && data[0].status === "SUCCESS" && data[0].object.vectorDataPoint.length > 0) {
            const point = data[0].object.vectorDataPoint[0];
            const scalar = this.scalarCodes[point.scalarFactorCode] || 1;
            const val = point.value * scalar;
            this.baselineCache[productId] = val; // CACHE IT
            return val;
        }
    } catch (e) {
        console.warn(`WDS Live fetch failed for ${productId}`);
    }
    return null;
  }

  async fetchAllCubesList(): Promise<void> {
      if (this.fullCubeList) return;
      try {
          const res = await fetch(`${STATCAN_API_URL}/getAllCubesListLite`);
          const json = await res.json();
          if (Array.isArray(json)) {
             this.fullCubeList = json;
          }
      } catch (e) {
          console.error("Failed to fetch full cube list", e);
      }
  }

  async searchProducts(query: string, categoryFilter?: string): Promise<DataProduct[]> {
    // 1. Search Static Catalog first
    const staticResults = CATALOG.filter(p => {
      const matchesQuery = !query || p.title.toLowerCase().includes(query.toLowerCase());
      const matchesCat = !categoryFilter || p.category === categoryFilter;
      return matchesQuery && matchesCat;
    });

    if (staticResults.length > 0) return staticResults;

    // 2. If no static results, check Full Cube List
    if (!this.fullCubeList) {
        await this.fetchAllCubesList();
    }

    if (this.fullCubeList) {
        const wdsResults = this.fullCubeList
            .filter(c => c.cubeTitleEn.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map(c => ({
                id: c.productId.toString(),
                title: c.cubeTitleEn,
                category: 'General',
                variableName: 'Value',
                units: 'Units',
                description: `Released: ${c.releaseTime}`,
                dimensions: 1 as 1|2|3
            }));
        return wdsResults;
    }

    return [];
  }

  // --- MAP DATA METHODS ---

  private isPointInBounds(lat: number, lng: number, bounds: {north: number, south: number, east: number, west: number}): boolean {
      const latBuf = (bounds.north - bounds.south) * 0.2;
      const lngBuf = (bounds.east - bounds.west) * 0.2;
      return lat <= bounds.north + latBuf && lat >= bounds.south - latBuf && 
             lng <= bounds.east + lngBuf && lng >= bounds.west - lngBuf;
  }

  async fetchCanadaGeoJSON(): Promise<any> {
      return this.fetchGeoJSON('PROVINCE');
  }
  
  async fetchGeoJSON(level: LODLevel): Promise<any> {
      const url = GEOJSON_SOURCES[level];
      if (this.cache[url]) return this.cache[url];
      const res = await fetch(url);
      const data = await res.json();
      this.cache[url] = data;
      return data;
  }

  // Separated Geometry Loading
  async *streamShapes(level: LODLevel, bounds: any): AsyncGenerator<any[], void, unknown> {
    const url = GEOJSON_SOURCES[level];
    if (!url) return;
    
    let data = this.cache[url];
    if (!data) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
            this.cache[url] = data;
        } catch(e) { return; }
    }

    const features = data.features || [];
    const CHUNK_SIZE = 100; // Increased chunk size for speed
    let chunk: any[] = [];
    
    for (const f of features) {
        if (!f.geometry) continue;
        const centroid = this.getCentroid(f.geometry);
        if (centroid && this.isPointInBounds(centroid[0], centroid[1], bounds)) {
             if (!f.properties.id) {
                 const props = f.properties;
                 f.properties.id = props.DAUID || props.CFSAUID || props.CCSUID || props.CDUID || props.CMAUID || props.PRUID || `gen-${Math.random().toString(36).substr(2,9)}`;
             }
             chunk.push(f);
        }
        if (chunk.length >= CHUNK_SIZE) {
            yield chunk;
            chunk = [];
            // Use setTimeout to yield to main thread, but with minimal delay
            await new Promise(r => setTimeout(r, 0)); 
        }
    }
    if (chunk.length > 0) yield chunk;
  }

  // New Method: Just process geometry into a lightweight point
  processGeometry(feature: any, level: LODLevel): GeoPoint | null {
      const centroid = this.getCentroid(feature.geometry);
      if (!centroid) return null;
      const [lat, lng] = centroid;
      const props = feature.properties;
      const id = props.id;
      const name = props.name || props.PRNAME || props.MANAME || props.CDNAME || props.CCSNAME || props.DAUID || id;

      return {
          id,
          name,
          lat,
          lng,
          value: 0,
          metrics: {},
          trend: 0,
          lod: level,
          postalCode: this.generatePostalCode(lat, lng)
      };
  }

  // New Method: Fetch and calculate metrics for points (Cached)
  async getMetricsForPoints(points: GeoPoint[], products: DataProduct[]): Promise<void> {
      // 1. Prefetch all baselines in parallel
      const baselines: Record<string, number> = {};
      await Promise.all(products.map(async (p) => {
          const liveVal = await this.fetchLiveBaseline(p.id);
          // Fallback if live fetch fails, but prioritize live
          if (liveVal !== null) baselines[p.id] = liveVal;
          else baselines[p.id] = p.category === 'Housing' ? 125.5 : p.category === 'Labour' ? 6.1 : 1000;
      }));

      // 2. Apply to points (Simulation of local variation based on Real National Baseline)
      // Note: In a real production app, we would query `getDataFromVectorsAndLatestNPeriods` for specific IDs here.
      // Since we lack a DAUID->VectorID lookup, we simulate local distribution around the REAL national mean.
      
      points.forEach(point => {
          products.forEach(product => {
             // Only calculate if not already present
             if (point.metrics[product.id] === undefined) {
                 const baseVal = baselines[product.id];
                 const seed = product.category.length * 137; 
                 const freq = point.lod === 'DA' ? 120 : 4;
                 const n1 = Math.sin(point.lat * freq + seed) * Math.cos(point.lng * freq + seed);
                 
                 point.metrics[product.id] = Math.max(0, baseVal * (1 + n1 * 0.2));
             }
          });
          // Update display value to the first active product
          if (products.length > 0) {
              point.value = point.metrics[products[0].id];
              point.category = products[0].category;
          }
      });
  }
}

export const statCanService = new StatCanService();
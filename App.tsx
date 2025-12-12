import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GeoPoint, MapViewState, DataProduct, LODLevel } from './types';
import { INITIAL_VIEW_STATE } from './constants';
import { aiService } from './services/aiService';
import { statCanService } from './services/statCanService';
import MapLayer from './components/MapLayer';
import AnalysisPanel from './components/AnalysisPanel';
import ComparisonChart from './components/ComparisonChart';
import DataDiscoveryPanel from './components/DataDiscoveryPanel';
import { WebMercatorViewport } from '@deck.gl/core';

const App: React.FC = () => {
  // State
  const [baseShapeData, setBaseShapeData] = useState<any>({ type: "FeatureCollection", features: [] });
  
  // CACHE: Stores geometry for each level independently (PROVINCE, CMA, CD, etc.)
  const [layerCache, setLayerCache] = useState<Record<string, any>>({});
  
  const [detailedPoints, setDetailedPoints] = useState<GeoPoint[]>([]);
  
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [lod, setLod] = useState<LODLevel>('PROVINCE');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // MULTIVARIABLE STATE
  const [activeProducts, setActiveProducts] = useState<DataProduct[]>([
      { id: '98100001', title: 'Population Counts', category: 'Demographics', variableName: 'Population', units: 'people', description: '2021 Census.', dimensions: 1 },
  ]);
  
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [analysisContext, setAnalysisContext] = useState<string>("Canada");
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadButton, setShowLoadButton] = useState(false);
  const [isConnectedToWDS, setIsConnectedToWDS] = useState(false);

  // Initial Load (Base Layer)
  useEffect(() => {
    loadBaseLayer();
    statCanService.fetchCubeMetadata('98100001').then(meta => {
        if(meta) setIsConnectedToWDS(true);
    });
  }, []);

  const loadBaseLayer = async () => {
    setIsLoading(true);
    const shapes = await statCanService.fetchCanadaGeoJSON();
    setBaseShapeData(shapes);
    // Initialize cache with base layer
    setLayerCache(prev => ({ ...prev, 'PROVINCE': shapes }));
    setIsLoading(false);
  };

  // ZOOM LEVEL HIERARCHY LOGIC
  useEffect(() => {
    let nextLod: LODLevel = 'PROVINCE';
    const z = viewState.zoom;
    
    // Strict Hierarchical Thresholds
    if (z < 4) nextLod = 'PROVINCE';
    else if (z >= 4 && z < 6) nextLod = 'CMA';
    else if (z >= 6 && z < 8) nextLod = 'CD';
    else if (z >= 8 && z < 10) nextLod = 'CCS';
    else if (z >= 10 && z < 12) nextLod = 'FSA';
    else nextLod = 'DA';

    if (nextLod !== lod) {
        setLod(nextLod);
        // We DO NOT clear detailedPoints or layerCache here. 
        // We keep them to allow the "stacking" visual effect.
        // We only clear points if we want to reset the "data" view, but let's keep them for context too.
    }

    if (z > 4) {
       setShowLoadButton(true);
    } else {
       setShowLoadButton(false);
    }
  }, [viewState.zoom, lod]);

  const handleLoadArea = async () => {
    setIsLoading(true);
    const viewport = new WebMercatorViewport(viewState);
    const bounds = viewport.getBounds(); 
    const boundObj = { west: bounds[0], south: bounds[1], east: bounds[2], north: bounds[3] };
    
    const targetLevel = lod;

    // 1. Fetch Baselines
    const baselines = await statCanService.fetchBaselines(activeProducts);

    // 2. Start Streaming
    const stream = statCanService.streamShapes(targetLevel, boundObj);
    
    // 3. Accumulate features for THIS level
    let currentLevelFeatures: any[] = layerCache[targetLevel]?.features || [];
    // We filter out existing IDs to avoid duplicates if loading same area
    const existingIds = new Set(currentLevelFeatures.map((f: any) => f.properties.id || f.properties.DAUID));
    
    let newPoints: GeoPoint[] = [];

    // 4. Consume chunks
    for await (const chunkFeatures of stream) {
        const uniqueFeatures = chunkFeatures.filter((f:any) => {
            const id = f.properties.id || f.properties.DAUID || f.properties.CFSAUID;
            if(existingIds.has(id)) return false;
            existingIds.add(id);
            return true;
        });

        if (uniqueFeatures.length === 0) continue;

        // Generate metrics
        const chunkPoints: GeoPoint[] = [];
        for (const feature of uniqueFeatures) {
             const p = await statCanService.enrichFeature(feature, activeProducts, targetLevel, baselines);
             if (p) chunkPoints.push(p);
        }

        currentLevelFeatures = [...currentLevelFeatures, ...uniqueFeatures];
        newPoints = [...newPoints, ...chunkPoints];

        // Update Cache and Points incrementally
        setLayerCache(prev => ({
            ...prev,
            [targetLevel]: { type: "FeatureCollection", features: currentLevelFeatures }
        }));
        
        setDetailedPoints(prev => [...prev, ...chunkPoints]);
    }
    
    setAnalysisContext(`Regional Scan (${targetLevel})`);
    setIsLoading(false);
    setShowLoadButton(false); 
  };

  const handleProductsChange = async (products: DataProduct[]) => {
    setActiveProducts(products);
    if (products.length === 0) {
        setDetailedPoints([]);
        return;
    }
    // If we have loaded shapes, we need to re-calculate points/metrics for them
    // For simplicity in this demo, we just clear points and ask user to reload or rely on next load
    // A robust solution would re-run enrichFeature on all cached features.
    setDetailedPoints([]); 
    if (viewState.zoom > 4) handleLoadArea();
  };

  const handleClick = (info: any, event: any) => {
    if (info.object && info.object.id) {
        handleSelection(info.object.id, event);
    }
  };

  const handleSelection = (id: string, event: any) => {
    const isShift = event.srcEvent && event.srcEvent.shiftKey;
    if (isShift) {
       setSelectedIds(prev => {
         if (prev.includes(id)) return prev.filter(x => x !== id);
         return [...prev, id];
       });
    } else {
       setSelectedIds([id]);
    }
  };

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    const targetData = selectedIds.length > 0 ? detailedPoints.filter(d => selectedIds.includes(d.id)) : detailedPoints;
    const primaryProduct = activeProducts[0]; 
    if (!primaryProduct) { setIsAnalyzing(false); return; }

    const result = await aiService.analyzeRegion(targetData, primaryProduct, analysisContext);
    setAiInsight(result);
    setIsAnalyzing(false);
  }, [detailedPoints, activeProducts, analysisContext, selectedIds]);

  const getLoadButtonText = () => {
      switch(lod) {
          case 'CMA': return 'Load Metro Areas';
          case 'CD': return 'Load Divisions';
          case 'CCS': return 'Load Subdivisions';
          case 'FSA': return 'Load Postal Zones';
          case 'DA': return 'Load Neighborhoods';
          default: return 'Load Data';
      }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden flex flex-col sm:flex-row">
      <div className="relative flex-grow h-full">
        <MapLayer 
          viewState={viewState}
          onViewStateChange={(e) => setViewState(e)}
          layerCache={layerCache}
          data={detailedPoints}
          lod={lod}
          onHover={() => {}}
          onClick={handleClick}
          activeProducts={activeProducts}
          dimensions={2} 
          selectedIds={selectedIds}
        />
        
        {/* Controls Overlay */}
        <div className="absolute top-20 right-4 z-20 flex flex-col gap-2 items-end">
             {isConnectedToWDS && (
                 <div className="flex items-center gap-1.5 bg-green-900/40 border border-green-500/30 px-2 py-1 rounded text-[10px] text-green-400">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     StatCan Live WDS
                 </div>
             )}
        </div>

        {showLoadButton && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-top-5">
            <button 
              onClick={handleLoadArea}
              className="group bg-gray-900/80 hover:bg-primary text-white hover:text-gray-900 font-bold py-2 px-6 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-primary/50 backdrop-blur transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>{getLoadButtonText()}</span>
            </button>
          </div>
        )}

        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="bg-gray-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-700 shadow-xl flex items-center gap-3 pr-4 cursor-pointer hover:bg-gray-800 transition-colors"
               onClick={() => setShowDiscovery(true)}>
             <div className="bg-gray-800 p-2 rounded-xl">
               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">S</div>
             </div>
             <div>
               <h1 className="text-sm font-bold text-white leading-tight">StatCan Pulse</h1>
               <div className="flex gap-1 mt-0.5">
                   <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-700 text-blue-300 border border-blue-900/30">
                      LOD: {lod}
                   </span>
                   {activeProducts.slice(0, 2).map(p => (
                       <span key={p.id} className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-600 truncate max-w-[80px]">{p.category}</span>
                   ))}
               </div>
             </div>
          </div>
        </div>

        {isLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-full border border-primary/30 text-primary text-xs flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Streaming {lod} data...
          </div>
        )}
        
        {showDiscovery && (
          <DataDiscoveryPanel 
            hierarchies={[]}
            onSelectProducts={handleProductsChange}
            activeProducts={activeProducts}
            isLoading={isLoading}
            onClose={() => setShowDiscovery(false)}
          />
        )}

        <div className="absolute bottom-4 left-4 z-10 w-96 hidden md:block">
            <ComparisonChart data={detailedPoints} color={[200,200,200]} unit="Index" lod={lod} selectedIds={selectedIds} />
        </div>
      </div>

      <AnalysisPanel 
        isLoading={isAnalyzing}
        content={aiInsight}
        onAnalyze={handleAnalyze}
        canAnalyze={detailedPoints.length > 0}
        city={analysisContext}
      />
    </div>
  );
};

export default App;
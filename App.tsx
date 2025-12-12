import React, { useState, useEffect, useRef } from 'react';
import { GeoPoint, MapViewState, DataProduct, LODLevel, VisualSettings, LoadingTask } from './types';
import { INITIAL_VIEW_STATE } from './constants';
import { statCanService } from './services/statCanService';
import MapLayer from './components/MapLayer';
import ComparisonChart from './components/ComparisonChart';
import DataDiscoveryPanel from './components/DataDiscoveryPanel';
import SettingsPanel from './components/SettingsPanel';
import ComparisonView from './components/ComparisonView';
import ProgressPanel from './components/ProgressPanel';
import { WebMercatorViewport } from '@deck.gl/core';

const App: React.FC = () => {
  // State
  const [baseShapeData, setBaseShapeData] = useState<any>({ type: "FeatureCollection", features: [] });
  const [layerCache, setLayerCache] = useState<Record<string, any>>({});
  
  // Display State
  const [detailedPoints, setDetailedPoints] = useState<GeoPoint[]>([]); 
  
  // Data State (Master Cache)
  const masterPointsRef = useRef<Map<string, GeoPoint>>(new Map());
  const loadedProductIds = useRef<Set<string>>(new Set());

  const [tasks, setTasks] = useState<LoadingTask[]>([]);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [lod, setLod] = useState<LODLevel>('PROVINCE');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // VISUAL SETTINGS
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
      glyphSizeScale: 1.0,
      opacity: 0.8,
      strokeWidth: 2.0,
      darkMode: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showComparisonView, setShowComparisonView] = useState(false);

  // MULTIVARIABLE STATE
  const [activeProducts, setActiveProducts] = useState<DataProduct[]>([
      { id: '98100001', title: 'Population Counts', category: 'Demographics', variableName: 'Population', units: 'people', description: '2021 Census.', dimensions: 1 },
  ]);
  
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showLoadButton, setShowLoadButton] = useState(false);
  const [isConnectedToWDS, setIsConnectedToWDS] = useState(false);

  // TASK HELPERS
  const addTask = (id: string, message: string) => {
      setTasks(prev => [...prev, { id, message, type: 'info', progress: 0 }]);
  };
  const updateTask = (id: string, progress: number) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, progress } : t));
  };
  const removeTask = (id: string) => {
      setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Initial Load (Base Layer)
  useEffect(() => {
    const init = async () => {
        addTask('init', 'Connecting to StatCan WDS...');
        try {
            await statCanService.fetchCodeSets();
            const shapes = await statCanService.fetchCanadaGeoJSON();
            setBaseShapeData(shapes);
            setLayerCache(prev => ({ ...prev, 'PROVINCE': shapes }));
            setIsConnectedToWDS(true);
            
            // Mark initial product as loaded so we don't fetch it twice
            loadedProductIds.current.add('98100001');
        } catch(e) { console.error(e); }
        removeTask('init');
    };
    init();
  }, []);

  // ZOOM LEVEL HIERARCHY LOGIC
  useEffect(() => {
    let nextLod: LODLevel = 'PROVINCE';
    const z = viewState.zoom;
    
    if (z < 4) nextLod = 'PROVINCE';
    else if (z >= 4 && z < 6) nextLod = 'CMA';
    else if (z >= 6 && z < 8) nextLod = 'CD';
    else if (z >= 8 && z < 10) nextLod = 'CCS';
    else if (z >= 10 && z < 12) nextLod = 'FSA';
    else nextLod = 'DA';

    if (nextLod !== lod) {
        setLod(nextLod);
        // Reset master points when LOD changes to avoid mixing levels
        masterPointsRef.current.clear();
        setDetailedPoints([]); 
    }

    if (z > 4) {
       setShowLoadButton(true);
    } else {
       setShowLoadButton(false);
    }
  }, [viewState.zoom, lod]);

  // LOAD GEOMETRY
  const handleLoadArea = async () => {
    const taskId = `load-${Date.now()}`;
    addTask(taskId, `Streaming ${lod} Geometry...`);
    setShowLoadButton(false);
    
    const viewport = new WebMercatorViewport(viewState);
    const bounds = viewport.getBounds(); 
    const boundObj = { west: bounds[0], south: bounds[1], east: bounds[2], north: bounds[3] };
    const targetLevel = lod;

    try {
        const stream = statCanService.streamShapes(targetLevel, boundObj);
        
        // Cache management
        let currentLevelFeatures: any[] = layerCache[targetLevel]?.features || [];
        const existingIds = new Set(currentLevelFeatures.map((f: any) => f.properties.id || f.properties.DAUID));
        
        let newFeaturesAccumulator: any[] = [];
        let pointsToEnrich: GeoPoint[] = [];
        let processedCount = 0;

        for await (const chunkFeatures of stream) {
            const uniqueFeatures = chunkFeatures.filter((f:any) => {
                const id = f.properties.id || f.properties.DAUID || f.properties.CFSAUID || f.properties.CCSUID || f.properties.CDUID;
                if (!id) return true; 
                if (existingIds.has(id)) return false;
                existingIds.add(id);
                return true;
            });

            if (uniqueFeatures.length === 0) continue;

            const chunkPoints: GeoPoint[] = [];
            for (const feature of uniqueFeatures) {
                const p = statCanService.processGeometry(feature, targetLevel);
                if (p) chunkPoints.push(p);
            }

            newFeaturesAccumulator = [...newFeaturesAccumulator, ...uniqueFeatures];
            pointsToEnrich = [...pointsToEnrich, ...chunkPoints];
            
            processedCount += uniqueFeatures.length;
            
            // Visual update every 200 items or so
            if (processedCount % 200 === 0 || processedCount < 200) {
                 updateTask(taskId, 50); // Geometry loaded, now fetching data
            }
        }
        
        // Store geometry
        if (newFeaturesAccumulator.length > 0) {
             setLayerCache(prev => ({
                ...prev,
                [targetLevel]: { 
                    type: "FeatureCollection", 
                    features: [...(prev[targetLevel]?.features || []), ...newFeaturesAccumulator] 
                }
            }));
            
            // Now fetch data for these new points
            updateTask(taskId, 70); 
            
            // Add new points to master map
            pointsToEnrich.forEach(p => masterPointsRef.current.set(p.id, p));

            // Fetch metrics for new points using ACTIVE products
            await statCanService.getMetricsForPoints(pointsToEnrich, activeProducts);
            
            // Update View
            setDetailedPoints(Array.from(masterPointsRef.current.values()));
        }

    } catch (e) {
        console.error("Loading failed", e);
    } finally {
        removeTask(taskId);
    }
  };

  // LOAD DATA (Metric Changes)
  const handleProductsChange = async (products: DataProduct[]) => {
    // 1. Identify missing products that haven't been loaded for current points
    const missingProducts = products.filter(p => !loadedProductIds.current.has(p.id));
    
    if (missingProducts.length > 0) {
        const taskId = `data-${Date.now()}`;
        addTask(taskId, `Fetching Real Data: ${missingProducts.map(p=>p.title).join(', ')}`);
        
        const allPoints = Array.from(masterPointsRef.current.values());
        
        if (allPoints.length > 0) {
             await statCanService.getMetricsForPoints(allPoints, missingProducts);
        }
        
        missingProducts.forEach(p => loadedProductIds.current.add(p.id));
        removeTask(taskId);
    }

    // 2. Update Active Products State (This triggers re-render of MapLayer)
    setActiveProducts(products);
    
    // 3. Force update of detailedPoints to trigger React render if we just modified the objects inside
    // Note: We clone the array to ensure React sees the change, but objects inside are mutated
    setDetailedPoints([...Array.from(masterPointsRef.current.values())]);
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
          selectedIds={selectedIds}
          settings={visualSettings}
        />
        
        {/* Progress Panel (Non-blocking) */}
        <ProgressPanel tasks={tasks} />

        {/* Controls Overlay */}
        <div className="absolute top-20 right-4 z-20 flex flex-col gap-2 items-end">
             {isConnectedToWDS && (
                 <div className="flex items-center gap-1.5 bg-green-900/40 border border-green-500/30 px-2 py-1 rounded text-[10px] text-green-400 pointer-events-none">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     StatCan Live WDS
                 </div>
             )}
             
             {selectedIds.length > 1 && (
                 <button 
                    onClick={() => setShowComparisonView(true)}
                    className="bg-primary hover:bg-cyan-400 text-gray-900 font-bold py-2 px-4 rounded-full shadow-lg border border-cyan-300 animate-bounce flex items-center gap-2"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    Compare ({selectedIds.length})
                 </button>
             )}
        </div>

        {showLoadButton && tasks.length === 0 && (
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

        {/* Header Bar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button 
             onClick={() => setShowSettings(!showSettings)}
             className="bg-gray-900/90 backdrop-blur-md p-3 rounded-2xl border border-gray-700 shadow-xl hover:bg-gray-800 transition-colors text-gray-400"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>

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

        {showSettings && (
            <SettingsPanel settings={visualSettings} onUpdate={setVisualSettings} onClose={() => setShowSettings(false)} />
        )}
        
        {showComparisonView && (
            <ComparisonView 
                selectedPoints={detailedPoints.filter(p => selectedIds.includes(p.id))}
                products={activeProducts}
                onClose={() => setShowComparisonView(false)}
            />
        )}
        
        {showDiscovery && (
          <DataDiscoveryPanel 
            hierarchies={[]}
            onSelectProducts={handleProductsChange}
            activeProducts={activeProducts}
            isLoading={tasks.length > 0}
            onClose={() => setShowDiscovery(false)}
          />
        )}

        <div className="absolute bottom-4 left-4 z-10 w-96 hidden md:block">
            <ComparisonChart 
                data={detailedPoints} 
                products={activeProducts}
                lod={lod} 
                selectedIds={selectedIds} 
            />
        </div>
      </div>
    </div>
  );
};

export default App;
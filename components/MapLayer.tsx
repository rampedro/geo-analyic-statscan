import React, { useMemo } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { PickingInfo } from '@deck.gl/core';
import * as d3 from 'd3';
import { GeoPoint, MapViewState, LODLevel, DataProduct, VisualSettings } from '../types';
import { MAP_STYLE } from '../constants';

interface MapLayerProps {
  viewState: MapViewState;
  onViewStateChange: (view: any) => void;
  data: GeoPoint[];
  layerCache: Record<string, any>; 
  lod: LODLevel;
  onHover: (info: PickingInfo) => void;
  onClick: (info: PickingInfo, event: any) => void;
  activeProducts: DataProduct[];
  selectedIds: string[];
  settings: VisualSettings;
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
    'Housing': [250, 204, 21],   
    'Labour': [244, 63, 94],     
    'Economy': [16, 185, 129],   
    'Health': [6, 182, 212],     
    'Demographics': [99, 102, 241], 
    'Education': [139, 92, 246], 
    'Transport': [249, 115, 22]  
};

// Hierarchy definition for rendering order (Index 0 = Bottom)
const HIERARCHY_ORDER: LODLevel[] = ['PROVINCE', 'CMA', 'CD', 'CCS', 'FSA', 'DA'];

const MapLayer: React.FC<MapLayerProps> = ({
  viewState,
  onViewStateChange,
  data,
  layerCache,
  lod,
  activeProducts,
  selectedIds,
  onHover,
  onClick,
  settings
}) => {

  // Domain Calculation for normalization
  const metricDomains = useMemo(() => {
      const domains: Record<string, {min: number, max: number}> = {};
      activeProducts.forEach(p => {
          const values = data.map(d => d.metrics ? d.metrics[p.id] : 0).filter(v => v !== undefined);
          domains[p.id] = {
              min: d3.min(values) || 0,
              max: d3.max(values) || 100
          };
      });
      return domains;
  }, [data, activeProducts]);

  const getNormVal = (d: GeoPoint, index: number) => {
      if (!activeProducts[index]) return 0.5;
      const pid = activeProducts[index].id;
      const val = d.metrics[pid] || 0;
      const domain = metricDomains[pid];
      const norm = (val - domain.min) / (domain.max - domain.min || 1);
      return Math.max(0.1, norm); // Ensure at least small visibility
  };

  // --- GLYPH GENERATION ---

  // 1. SCATTERPLOT (1 Variable)
  const renderScatterplot = () => {
      return new ScatterplotLayer({
        id: 'glyph-scatter',
        data: data,
        pickable: false,
        stroked: true,
        filled: true,
        radiusScale: 100 * settings.glyphSizeScale,
        radiusMinPixels: 2,
        radiusMaxPixels: 50,
        getPosition: (d: GeoPoint) => [d.lng, d.lat],
        getRadius: (d: GeoPoint) => 5 + (getNormVal(d, 0) * 10),
        getFillColor: (d: GeoPoint) => {
            const c = CATEGORY_COLORS[activeProducts[0].category] || [200,200,200];
            return [...c, settings.opacity * 255];
        },
        getLineColor: (d: GeoPoint) => selectedIds.includes(d.id) ? [255,255,255,255] : [0,0,0,0],
        getLineWidth: 2,
        updateTriggers: {
            getRadius: [activeProducts, settings.glyphSizeScale],
            getFillColor: [activeProducts, settings.opacity]
        }
      });
  };

  // 2. RADAR / POLYGON EDGES (2+ Variables)
  // We flatten the data: 1 Point -> N Edges (Paths)
  // Each edge connects Vertex I to Vertex I+1
  const renderRadarEdges = () => {
      const radarData: any[] = [];
      const numVars = activeProducts.length;
      const baseRadius = 0.005 * settings.glyphSizeScale * (10 / Math.max(viewState.zoom, 1)); // Adjust radius by zoom roughly
      
      data.forEach(d => {
         const cx = d.lng;
         const cy = d.lat;
         
         // Calculate Vertices
         const vertices: [number, number][] = [];
         for(let i=0; i<numVars; i++) {
             const angle = (i / numVars) * Math.PI * 2 - Math.PI / 2; // Start at top
             const mag = getNormVal(d, i);
             // Scale radius by magnitude. 
             // Note: Lat/Lng scaling is approximate here, correct for aspect ratio in production
             const r = baseRadius * (0.5 + mag * 1.5); 
             
             // Simple projection for visual glyphs
             const vx = cx + Math.cos(angle) * r; 
             const vy = cy + Math.sin(angle) * r; // Flattened earth approximation
             vertices.push([vx, vy]);
         }

         // Create Segments
         for(let i=0; i<numVars; i++) {
             const p1 = vertices[i];
             const p2 = vertices[(i + 1) % numVars]; // Loop back to close
             
             // If only 2 variables, we just draw a line between them? 
             // Or a "flat" polygon. 2 variables = Line. 3 = Triangle. 4 = Square.
             
             if (numVars === 2 && i === 1) continue; // For line, just one segment or two overlapping? Let's do 2 colors split.
             
             // The Edge Color represents the variable at the START of the edge (or blend)
             const cat = activeProducts[i].category;
             const color = CATEGORY_COLORS[cat] || [200,200,200];

             radarData.push({
                 path: [p1, p2],
                 color: [...color, settings.opacity * 255],
                 id: d.id
             });
         }
      });

      return new PathLayer({
          id: 'glyph-radar-edges',
          data: radarData,
          pickable: false,
          widthMinPixels: settings.strokeWidth,
          getPath: (d: any) => d.path,
          getColor: (d: any) => d.color,
          getWidth: settings.strokeWidth,
          updateTriggers: {
              getPath: [activeProducts, viewState.zoom, settings.glyphSizeScale],
              getColor: [activeProducts, settings.opacity]
          }
      });
  };

  // --- LAYER ASSEMBLY ---

  const stackedLayers = HIERARCHY_ORDER.map((level, index) => {
      const shapeData = layerCache[level];
      if (!shapeData) return null;

      const isActive = level === lod;
      const isParent = HIERARCHY_ORDER.indexOf(lod) > index;
      
      if (!isActive && !isParent) return null; 

      return new GeoJsonLayer({
          id: `layer-${level}`,
          data: shapeData,
          pickable: isActive, 
          stroked: true,
          filled: isActive,
          
          // Context Styling (Parent Layers)
          getLineColor: isParent ? [60, 60, 60, 200] : [100, 116, 139, 200],
          getLineWidth: isParent ? 3 - (index * 0.5) : 1,
          lineWidthMinPixels: isParent ? 2 : 1,
          
          // Active Styling
          getFillColor: [30, 41, 59, 150], 
          autoHighlight: isActive,
          highlightColor: [6, 182, 212, 50],
          
          getPolygonOffset: ({layerIndex}) => [0, -index * 100], 
          
          onHover: isActive ? onHover : undefined,
          onClick: isActive ? onClick : undefined
      });
  }).filter(Boolean);

  let glyphLayer;
  if (activeProducts.length <= 1) {
      glyphLayer = renderScatterplot();
  } else {
      glyphLayer = renderRadarEdges();
  }

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={e => onViewStateChange(e.viewState)}
      controller={true}
      layers={[...stackedLayers, glyphLayer]}
      getTooltip={({object}) => {
        if (!object) return null;
        const props = object.properties || object; 
        
        let metrics = props.metrics;
        let id = props.id || props.DAUID;
        let name = props.name || props.DAUID || id;

        // Try to find metrics if not directly on object
        if (!metrics && data) {
            const match = data.find(p => p.id === id);
            if (match) {
                metrics = match.metrics;
                name = match.name;
            }
        }

        if (metrics) {
             let metricHtml = '';
             // Limit tooltip to first 5 metrics to prevent overflow
             const showMetrics = activeProducts.slice(0, 5);
             showMetrics.forEach(p => {
                 const val = metrics[p.id];
                 metricHtml += `<div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:4px;">
                    <span style="color:#cbd5e1">${p.variableName}</span>
                    <div style="text-align:right">
                         <span style="font-weight:bold; color:#fff;">${Math.round(val).toLocaleString()}</span>
                    </div>
                 </div>`;
             });
             return {
              html: `<div style="background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(4px); color:#fff; padding:10px; border:1px solid #334155; border-radius:6px; font-size:11px; min-width:180px;">
                 <div style="font-weight:bold; font-size:12px; margin-bottom:2px; color:#fff;">${name}</div>
                 <div style="font-size:9px; color:#64748b; margin-bottom:6px; font-family:monospace; border-bottom:1px solid #334155; padding-bottom:4px;">${id}</div>
                 ${metricHtml}
              </div>`
            };
        }
        return { text: name };
      }}
      cursor="crosshair"
    >
      <Map mapStyle={MAP_STYLE} attributionControl={false}>
        <NavigationControl position="top-right" />
      </Map>
    </DeckGL>
  );
};

export default MapLayer;
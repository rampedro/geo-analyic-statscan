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
      return Math.max(0.1, norm); 
  };

  // --- CLUTTER CONTROL ---
  // Calculates a safe maximum pixel radius based on zoom level to ensure separation
  const getSmartRadius = () => {
      // Zoom 4 -> Radius 2px
      // Zoom 12 -> Radius 30px
      const zoomFactor = Math.pow(viewState.zoom, 1.8) / 10;
      return Math.max(2, Math.min(zoomFactor * 5 * settings.glyphSizeScale, 60));
  };
  
  const maxRadiusPixels = getSmartRadius();

  // 1. SCATTERPLOT (1 Variable)
  const renderScatterplot = () => {
      return new ScatterplotLayer({
        id: 'glyph-scatter',
        data: data,
        pickable: false,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels', // Lock to pixels for predictable visual footprint
        radiusScale: 1, 
        radiusMinPixels: 2,
        radiusMaxPixels: maxRadiusPixels, // Dynamic cap
        getPosition: (d: GeoPoint) => [d.lng, d.lat],
        getRadius: (d: GeoPoint) => {
            // Norm (0.1 to 1.0) * MaxRadius
            return getNormVal(d, 0) * maxRadiusPixels; 
        },
        getFillColor: (d: GeoPoint) => {
            const c = CATEGORY_COLORS[activeProducts[0].category] || [200,200,200];
            return [...c, settings.opacity * 255];
        },
        getLineColor: (d: GeoPoint) => selectedIds.includes(d.id) ? [255,255,255,255] : [0,0,0,0],
        getLineWidth: 2,
        updateTriggers: {
            getRadius: [activeProducts, settings.glyphSizeScale, viewState.zoom],
            getFillColor: [activeProducts, settings.opacity]
        }
      });
  };

  // 2. RADAR EDGES (2+ Variables)
  const renderRadarEdges = () => {
      const radarData: any[] = [];
      const numVars = activeProducts.length;
      
      // Dynamic scaling for "world space" polygons to match pixel feeling
      // At zoom 10, 1 degree ~ 111km. 
      // We want ~20px size. 
      const metersPerPixel = 156543.03392 * Math.cos(viewState.latitude * Math.PI / 180) / Math.pow(2, viewState.zoom);
      const baseRadiusMeters = maxRadiusPixels * metersPerPixel * 0.5; // Half diameter

      data.forEach(d => {
         const cx = d.lng;
         const cy = d.lat;
         
         // Convert meters radius to degrees approx
         const rDeg = baseRadiusMeters / 111320; 

         const vertices: [number, number][] = [];
         for(let i=0; i<numVars; i++) {
             const angle = (i / numVars) * Math.PI * 2 - Math.PI / 2; 
             const mag = getNormVal(d, i);
             const r = rDeg * (0.5 + mag); // Variation
             
             // Aspect ratio correction for latitude
             const aspect = 1 / Math.cos(cy * Math.PI / 180);
             const vx = cx + Math.cos(angle) * r * aspect; 
             const vy = cy + Math.sin(angle) * r; 
             vertices.push([vx, vy]);
         }

         for(let i=0; i<numVars; i++) {
             const p1 = vertices[i];
             const p2 = vertices[(i + 1) % numVars]; 
             
             if (numVars === 2 && i === 1) continue; 
             
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
          widthUnits: 'pixels',
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
          getLineColor: isParent ? [60, 60, 60, 200] : [100, 116, 139, 200],
          getLineWidth: isParent ? 3 - (index * 0.5) : 1,
          lineWidthMinPixels: isParent ? 2 : 1,
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
      viewState={viewState as any}
      onViewStateChange={e => onViewStateChange(e.viewState)}
      controller={true}
      layers={[...stackedLayers, glyphLayer]}
      getTooltip={({object}) => {
        if (!object) return null;
        const props = object.properties || object; 
        
        let metrics = props.metrics;
        let id = props.id || props.DAUID;
        let name = props.name || props.DAUID || id;

        if (!metrics && data) {
            const match = data.find(p => p.id === id);
            if (match) {
                metrics = match.metrics;
                name = match.name;
            }
        }

        if (metrics) {
             let metricHtml = '';
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
      getCursor={() => "crosshair"}
    >
      <Map mapStyle={MAP_STYLE} attributionControl={false}>
        <NavigationControl position="top-right" />
      </Map>
    </DeckGL>
  );
};

export default MapLayer;
import React, { useMemo } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { PickingInfo } from '@deck.gl/core';
import * as d3 from 'd3';
import { GeoPoint, MapViewState, LODLevel, DataProduct } from '../types';
import { MAP_STYLE } from '../constants';

interface MapLayerProps {
  viewState: MapViewState;
  onViewStateChange: (view: any) => void;
  data: GeoPoint[];
  layerCache: Record<string, any>; // Stores all loaded hierarchies
  lod: LODLevel;
  onHover: (info: PickingInfo) => void;
  onClick: (info: PickingInfo, event: any) => void;
  activeProducts: DataProduct[];
  dimensions: 1 | 2 | 3;
  selectedIds: string[];
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
  onClick
}) => {

  // Domain Calculation
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
      if (!activeProducts[index]) return 0;
      const pid = activeProducts[index].id;
      const val = d.metrics[pid] || 0;
      const domain = metricDomains[pid];
      return (val - domain.min) / (domain.max - domain.min || 1);
  };

  const getColor = (d: GeoPoint, opacity = 255) => {
      let r=0, g=0, b=0, count=0;
      activeProducts.forEach((p, i) => {
          const intensity = getNormVal(d, i);
          const c = CATEGORY_COLORS[p.category] || [200,200,200];
          r += c[0] * (0.5 + intensity);
          g += c[1] * (0.5 + intensity);
          b += c[2] * (0.5 + intensity);
          count += (0.5 + intensity);
      });
      if (count === 0) return [100,100,100, opacity];
      return [r/count, g/count, b/count, opacity];
  };

  // --- ARROW GENERATION (Trends) ---
  const getArrowPath = (d: GeoPoint) => {
      let scale = 0.005; // Size of arrow in degrees
      if (lod === 'DA') scale = 0.002;
      if (lod === 'FSA') scale = 0.008;
      if (lod === 'PROVINCE') scale = 1.0;

      const trend = d.trend || 0; 
      const rotation = trend < 0 ? Math.PI/2 : -Math.PI/2;
      const x = d.lng;
      const y = d.lat;
      const tipX = x + Math.cos(rotation) * scale;
      const tipY = y + Math.sin(rotation) * scale;
      const baseX = x - Math.cos(rotation) * scale * 0.5;
      const baseY = y - Math.sin(rotation) * scale * 0.5;
      
      return [[baseX, baseY], [tipX, tipY]];
  };

  // --- DYNAMIC LAYER GENERATION ---
  
  // We iterate through the hierarchy levels (Province -> DA)
  // Each level present in layerCache creates a GeoJsonLayer
  // Lower levels (Parents) get "Context" styling (Outlines, No Fill)
  // The Active level (lod) gets "Active" styling (Filled, Highlighted)

  const stackedLayers = HIERARCHY_ORDER.map((level, index) => {
      const shapeData = layerCache[level];
      if (!shapeData) return null;

      const isActive = level === lod;
      const isParent = HIERARCHY_ORDER.indexOf(lod) > index;
      
      // If the layer is deeper than current LOD (child), we generally hide it to avoid clutter
      // unless we want to show everything. For cleanliness, hide children of current view.
      if (!isActive && !isParent) return null; 

      return new GeoJsonLayer({
          id: `layer-${level}`,
          data: shapeData,
          pickable: isActive, // Only active layer is interactive
          stroked: true,
          filled: isActive,   // Only active layer is filled
          
          // Context Styling (Parent Layers)
          getLineColor: isParent ? [60, 60, 60, 200] : [100, 116, 139, 200],
          getLineWidth: isParent ? 3 - (index * 0.5) : 1, // Parents have thicker borders
          lineWidthMinPixels: isParent ? 2 : 1,
          
          // Active Styling
          getFillColor: [30, 41, 59, 150], 
          autoHighlight: isActive,
          highlightColor: [6, 182, 212, 50],
          
          // Ensure correct stacking order (Z-fighting prevention)
          getPolygonOffset: ({layerIndex}) => [0, -index * 100], 
          
          onHover: isActive ? onHover : undefined,
          onClick: isActive ? onClick : undefined
      });
  }).filter(Boolean);

  const glyphLayers = [
    // Dots
    new ScatterplotLayer({
        id: 'main-glyphs',
        data: data,
        pickable: false, 
        stroked: true,
        filled: true,
        radiusScale: 100,
        radiusMinPixels: 2,
        radiusMaxPixels: 10,
        getPosition: (d: GeoPoint) => [d.lng, d.lat],
        getRadius: (d: GeoPoint) => 5 + (getNormVal(d, 0) * 10),
        getFillColor: (d: GeoPoint) => getColor(d, 200),
        getLineColor: (d: GeoPoint) => selectedIds.includes(d.id) ? [255,255,255,255] : [0,0,0,0],
        getLineWidth: 2,
        updateTriggers: {
            getFillColor: [activeProducts, selectedIds],
        }
    }),
    // Arrows
    new PathLayer({
        id: 'trend-arrows',
        data: data,
        pickable: false,
        widthMinPixels: 2,
        getPath: getArrowPath,
        getColor: (d: GeoPoint) => (d.trend || 0) > 0 ? [74, 222, 128, 200] : [248, 113, 113, 200],
        getWidth: 3,
        updateTriggers: {
            getPath: [activeProducts, lod]
        }
    })
  ];

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={e => onViewStateChange(e.viewState)}
      controller={true}
      layers={[...stackedLayers, ...glyphLayers]}
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
             const showMetrics = activeProducts.slice(0, 4);
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
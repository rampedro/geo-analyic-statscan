import React from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { MAP_STYLE } from '../constants';
import { GeoPoint, MapViewState } from '../types';

interface OverviewMapProps {
  viewState: MapViewState;
  data: GeoPoint[]; // Usually just the province data or simplified
  shapeData: any;
  activeColor: [number, number, number];
}

const OverviewMap: React.FC<OverviewMapProps> = ({ viewState, data, shapeData, activeColor }) => {
  // Always keep overview zoomed out relative to main map, but follow center
  const overviewViewState = {
    ...viewState,
    zoom: Math.max(4, viewState.zoom - 4),
    pitch: 0,
    bearing: 0
  };

  const layers = [
    new GeoJsonLayer({
      id: 'overview-shapes',
      data: shapeData,
      stroked: true,
      filled: true,
      getLineColor: [255, 255, 255, 100],
      getFillColor: [activeColor[0], activeColor[1], activeColor[2], 100],
      lineWidthMinPixels: 1,
    })
  ];

  return (
    <div className="w-48 h-48 rounded-lg overflow-hidden border-2 border-gray-700 shadow-2xl relative">
      <DeckGL
        viewState={overviewViewState as any}
        layers={layers}
        controller={false} // No interaction on minimap
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      <div className="absolute bottom-1 right-1 text-[9px] text-white bg-black/50 px-1 rounded">Overview</div>
    </div>
  );
};

export default OverviewMap;
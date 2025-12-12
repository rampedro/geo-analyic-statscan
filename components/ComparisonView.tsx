import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { GeoPoint, DataProduct } from '../types';

interface ComparisonViewProps {
  selectedPoints: GeoPoint[];
  products: DataProduct[];
  onClose: () => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ selectedPoints, products, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || selectedPoints.length === 0 || products.length === 0) return;

    const width = 800;
    const height = 600;
    const margin = 100;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // 1. Scales
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);
    
    // Angle per variable
    const angleSlice = (Math.PI * 2) / products.length;

    // 2. Draw Grid (Web)
    const levels = 5;
    for (let level = 0; level < levels; level++) {
      const levelFactor = radius * ((level + 1) / levels);
      
      g.selectAll(".levels")
        .data(products)
        .enter()
        .append("line")
        .attr("x1", (d, i) => levelFactor * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("y1", (d, i) => levelFactor * Math.sin(angleSlice * i - Math.PI / 2))
        .attr("x2", (d, i) => levelFactor * Math.cos(angleSlice * (i + 1) - Math.PI / 2))
        .attr("y2", (d, i) => levelFactor * Math.sin(angleSlice * (i + 1) - Math.PI / 2))
        .attr("class", "grid-line")
        .style("stroke", "#334155")
        .style("stroke-opacity", "0.5")
        .style("stroke-width", "1px");
    }

    // 3. Axes & Labels
    const axis = g.selectAll(".axis")
      .data(products)
      .enter()
      .append("g")
      .attr("class", "axis");

    axis.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => rScale(1.1) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y2", (d, i) => rScale(1.1) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr("class", "line")
      .style("stroke", "#94a3b8")
      .style("stroke-width", "1px");

    axis.append("text")
      .attr("class", "legend")
      .style("font-size", "12px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (d, i) => rScale(1.25) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y", (d, i) => rScale(1.25) * Math.sin(angleSlice * i - Math.PI / 2))
      .text(d => d.variableName)
      .style("fill", "#cbd5e1");

    // 4. Data Polygons
    
    // Helper to get normalized value for a point and product index
    const getNormValue = (point: GeoPoint, prodIdx: number) => {
        const pId = products[prodIdx].id;
        const val = point.metrics[pId] || 0;
        // Normalize against the selected set for comparison, or global?
        // Let's normalize against the SET of selected points to maximize contrast
        const values = selectedPoints.map(sp => sp.metrics[pId] || 0);
        const min = d3.min(values) || 0;
        const max = d3.max(values) || 100;
        if (max === min) return 0.5;
        return (val - min) / (max - min);
    };

    const radarLine = d3.lineRadial<{val: number, idx: number}>()
      .radius(d => rScale(d.val))
      .angle(d => d.idx * angleSlice)
      .curve(d3.curveLinearClosed);

    const colors = d3.scaleOrdinal(d3.schemeCategory10);

    selectedPoints.forEach((point, i) => {
        const dataValues = products.map((p, idx) => ({ 
            val: 0.1 + (getNormValue(point, idx) * 0.9), // Ensure simple baseline 
            idx 
        }));

        // Area
        g.append("path")
          .attr("class", "radar-area")
          .attr("d", radarLine(dataValues))
          .style("fill", colors(i.toString()))
          .style("fill-opacity", 0.1)
          .on("mouseover", function() {
              d3.select(this).style("fill-opacity", 0.7);
          })
          .on("mouseout", function() {
              d3.select(this).style("fill-opacity", 0.1);
          });

        // Outline
        g.append("path")
          .attr("class", "radar-stroke")
          .attr("d", radarLine(dataValues))
          .style("stroke-width", 2)
          .style("stroke", colors(i.toString()))
          .style("fill", "none");
          
        // Points
        g.selectAll(`.radar-circle-${i}`)
           .data(dataValues)
           .enter()
           .append("circle")
           .attr("class", `radar-circle-${i}`)
           .attr("r", 4)
           .attr("cx", (d) => rScale(d.val) * Math.cos(angleSlice * d.idx - Math.PI / 2))
           .attr("cy", (d) => rScale(d.val) * Math.sin(angleSlice * d.idx - Math.PI / 2))
           .style("fill", colors(i.toString()));
    });

  }, [selectedPoints, products]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full h-full max-w-5xl max-h-[90vh] flex flex-col items-center">
         <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800 p-2 rounded-full text-white hover:bg-gray-700 z-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
         </button>
         
         <div className="w-full p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-2xl font-bold text-white tracking-tight">Multi-Regional Comparative Analysis</h2>
            <div className="flex gap-4">
                {selectedPoints.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: d3.schemeCategory10[i % 10]}}></div>
                        <span className="text-sm text-gray-300 font-mono">{p.name || p.id}</span>
                    </div>
                ))}
            </div>
         </div>

         <div className="flex-grow w-full flex items-center justify-center p-8 overflow-hidden">
             <svg ref={svgRef} viewBox="0 0 800 600" className="w-full h-full max-w-4xl drop-shadow-[0_0_50px_rgba(6,182,212,0.15)]"></svg>
         </div>
         
         <div className="p-4 text-center text-gray-500 text-xs font-mono">
            Radial axis represents relative percentile within the selected set.
         </div>
      </div>
    </div>
  );
};

export default ComparisonView;
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { GeoPoint, LODLevel } from '../types';

interface ComparisonChartProps {
  data: GeoPoint[];
  color: [number, number, number];
  unit: string;
  lod: LODLevel;
  selectedIds: string[];
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, color, unit, lod, selectedIds }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: 200
            });
        }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || dimensions.width === 0) return;

    // Filter and Sort Data
    let chartData = [...data];
    if (selectedIds.length > 0) {
      chartData = data.filter(d => selectedIds.includes(d.id));
    }
    // Sort by value desc
    chartData.sort((a, b) => b.value - a.value);
    
    // Limit to top 50 if too many
    if (selectedIds.length === 0) {
        chartData = chartData.slice(0, 50);
    }

    const margin = { top: 20, right: 10, bottom: 20, left: 35 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .range([0, innerWidth])
        .domain(chartData.map(d => d.id))
        .padding(0.3);

    const y = d3.scaleLinear()
        .range([innerHeight, 0])
        .domain([0, d3.max(chartData, d => d.value) || 100]);

    // Axes
    // Y Axis
    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(".2s")(d)))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").attr("stroke", "#334155").attr("stroke-dasharray", "2,2"))
        .call(g => g.selectAll(".tick text").attr("fill", "#94a3b8").style("font-size", "9px"));

    // Bars
    const cssColor = `rgb(${color.join(',')})`;
    
    g.selectAll(".bar")
        .data(chartData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.id) || 0)
        .attr("y", innerHeight) // Animate from bottom
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("fill", cssColor)
        .attr("rx", 2)
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.7);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        })
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.value))
        .attr("height", d => innerHeight - y(d.value));

    // Axis Label (Unit)
    g.append("text")
       .attr("x", -margin.left + 10)
       .attr("y", -5)
       .text(unit)
       .attr("fill", "#64748b")
       .style("font-size", "10px");

  }, [data, color, selectedIds, dimensions]);

  return (
    <div ref={containerRef} className="w-full mt-4 bg-gray-900/90 rounded-lg p-3 border border-gray-700 backdrop-blur-md shadow-2xl">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {selectedIds.length > 0 ? 'Analysis (Selected)' : 'Top 50 Hotspots'}
        </h3>
        <span className="text-xs text-primary font-mono">{data.length > 50 && selectedIds.length === 0 ? '50 displayed' : data.length + ' pts'}</span>
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}></svg>
      <div className="text-[9px] text-gray-600 mt-1 text-right">D3.js Visualization</div>
    </div>
  );
};

export default ComparisonChart;
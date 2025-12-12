import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { GeoPoint, LODLevel, DataProduct } from '../types';

interface ComparisonChartProps {
  data: GeoPoint[]; // The visible points
  products: DataProduct[];
  lod: LODLevel;
  selectedIds: string[];
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, products, lod, selectedIds }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 250 });

  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: 250
            });
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current || dimensions.width === 0) return;

    // --- HOTSPOT SCORING ALGORITHM ---
    
    // 1. Define Directionality
    // Metrics where Lower is Better
    const invertedMetrics = ['Housing', 'Crime', 'Unemployment'];
    
    // 2. Normalize and Score
    const scoredData = data.map(point => {
        let totalScore = 0;
        let validMetrics = 0;

        products.forEach(prod => {
            // Find Min/Max for this product across all visible data
            const values = data.map(d => d.metrics[prod.id] || 0);
            const min = d3.min(values) || 0;
            const max = d3.max(values) || 1; // avoid divide by zero
            
            const rawVal = point.metrics[prod.id] || 0;
            let norm = (rawVal - min) / (max - min); // 0 to 1

            // Invert if necessary (e.g. Price)
            if (invertedMetrics.includes(prod.category)) {
                norm = 1 - norm;
            }

            totalScore += norm;
            validMetrics++;
        });

        const finalScore = validMetrics > 0 ? (totalScore / validMetrics) * 100 : 0;
        return { ...point, finalScore };
    });

    // 3. Sort by Score
    let chartData = scoredData.sort((a, b) => b.finalScore - a.finalScore);
    
    // 4. Filter if selected
    if (selectedIds.length > 0) {
        const selectedSet = chartData.filter(d => selectedIds.includes(d.id));
        // If selection exists, show them at top, plus some context neighbors
        if (selectedSet.length > 0) chartData = selectedSet; 
    } else {
        // Show top 20
        chartData = chartData.slice(0, 20);
    }

    // --- D3 RENDERING ---

    const margin = { top: 30, right: 20, bottom: 20, left: 100 }; // More left margin for names
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale (Score)
    const x = d3.scaleLinear()
        .domain([0, 100])
        .range([0, innerWidth]);

    // Y Scale (Items)
    const y = d3.scaleBand()
        .range([0, innerHeight])
        .domain(chartData.map(d => d.id))
        .padding(0.2);

    // Color Scale based on Score
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 100]);

    // Bars
    g.selectAll(".bar")
        .data(chartData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.id) || 0)
        .attr("width", 0) // Animate from 0
        .attr("height", y.bandwidth())
        .attr("fill", d => colorScale(d.finalScore))
        .attr("rx", 3)
        .transition()
        .duration(800)
        .attr("width", d => x(d.finalScore));

    // Labels (Names)
    g.selectAll(".label")
        .data(chartData)
        .enter().append("text")
        .attr("x", -10)
        .attr("y", d => (y(d.id) || 0) + y.bandwidth() / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .text(d => (d.name || d.id).substring(0, 15))
        .style("fill", "#94a3b8")
        .style("font-size", "10px")
        .style("font-family", "monospace");

    // Score Text on Bar
    g.selectAll(".score-text")
        .data(chartData)
        .enter().append("text")
        .attr("x", d => x(d.finalScore) + 5)
        .attr("y", d => (y(d.id) || 0) + y.bandwidth() / 2)
        .attr("dy", ".35em")
        .text(d => d.finalScore.toFixed(1))
        .style("fill", "#fff")
        .style("font-size", "9px")
        .style("opacity", 0)
        .transition()
        .delay(500)
        .style("opacity", 1);

    // Top Axis (Grid)
    g.append("g")
        .call(d3.axisTop(x).ticks(5))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").attr("stroke", "#334155"))
        .call(g => g.selectAll(".tick text").attr("fill", "#64748b"));

  }, [data, products, selectedIds, dimensions]);

  return (
    <div ref={containerRef} className="w-full mt-4 bg-gray-900/95 rounded-xl p-4 border border-gray-700 backdrop-blur-md shadow-2xl">
      <div className="flex justify-between items-center mb-1">
        <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <span className="text-secondary">✦</span> Hotspot Ranker
            </h3>
            <p className="text-[10px] text-gray-500">
                Composite Score: {products.map(p => p.category).join(' + ')}
            </p>
        </div>
        <div className="text-right">
             <div className="text-xl font-mono text-primary font-bold">{data.length}</div>
             <div className="text-[9px] text-gray-500 uppercase">Visible Areas</div>
        </div>
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}></svg>
    </div>
  );
};

export default ComparisonChart;
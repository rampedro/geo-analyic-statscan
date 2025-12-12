import React, { useState, useEffect } from 'react';
import { GeoHierarchy, DataProduct } from '../types';
import { statCanService } from '../services/statCanService';

interface DataDiscoveryPanelProps {
  hierarchies: GeoHierarchy[];
  onSelectProducts: (products: DataProduct[]) => void; // Multi-select callback
  activeProducts: DataProduct[];
  isLoading: boolean;
  onClose: () => void;
}

const CATEGORIES = ['All', 'Demographics', 'Labour', 'Housing', 'Economy', 'Health'];

const DataDiscoveryPanel: React.FC<DataDiscoveryPanelProps> = ({
  hierarchies,
  onSelectProducts,
  activeProducts,
  isLoading,
  onClose
}) => {
  const [selectedHierarchy, setSelectedHierarchy] = useState<GeoHierarchy | null>(null);
  const [products, setProducts] = useState<DataProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearching, setIsSearching] = useState(false);
  
  // Local state for toggling before applying? Or instant apply.
  // Instant apply is better for "fusion" visualization.

  useEffect(() => {
    if (hierarchies.length > 0) setSelectedHierarchy(hierarchies[0]);
    handleSearch();
  }, [hierarchies]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeCategory]);

  const handleSearch = async () => {
    setIsSearching(true);
    const cat = activeCategory === 'All' ? undefined : activeCategory;
    const results = await statCanService.searchProducts(searchQuery, cat);
    setProducts(results);
    setIsSearching(false);
  };

  const toggleProduct = (product: DataProduct) => {
      const isActive = activeProducts.find(p => p.id === product.id);
      let newSelection: DataProduct[] = [];
      
      if (isActive) {
          // Remove
          newSelection = activeProducts.filter(p => p.id !== product.id);
          // Prevent empty selection? Maybe keep at least one, or allow empty (clear map)
      } else {
          // Add
          newSelection = [...activeProducts, product];
      }
      onSelectProducts(newSelection);
  };

  return (
    <div className="absolute top-4 right-4 z-30 w-96 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-right-5">
      
      <div className="p-4 border-b border-gray-800 bg-gray-800/50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-secondary">StatCan</span> Fusion Engine
            </h2>
            <p className="text-[10px] text-gray-400">Select multiple layers to fuse</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="relative">
          <input 
            type="text" 
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-sm text-white rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-primary outline-none"
          />
          <svg className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="flex overflow-x-auto p-2 border-b border-gray-800 gap-2 no-scrollbar bg-gray-900/30">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-3 py-1 text-[10px] uppercase font-bold tracking-wide rounded-full transition-colors
              ${activeCategory === cat ? 'bg-primary text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isSearching ? (
           <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : products.length === 0 ? (
           <div className="text-center py-10 text-gray-500 text-xs">No data tables found.</div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const isActive = activeProducts.some(ap => ap.id === p.id);
              return (
              <div 
                key={p.id}
                onClick={() => toggleProduct(p)}
                className={`group p-3 border rounded-lg cursor-pointer transition-all flex justify-between items-center
                    ${isActive 
                        ? 'bg-primary/10 border-primary shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                        : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700 hover:border-gray-500'}
                `}
              >
                <div>
                    <div className="flex items-center gap-2">
                         <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold mb-1 inline-block
                            ${p.category === 'Housing' ? 'text-yellow-500 bg-yellow-900/20' : 
                              p.category === 'Labour' ? 'text-rose-500 bg-rose-900/20' :
                              p.category === 'Demographics' ? 'text-red-500 bg-red-900/20' : // Crime usually here
                              'text-cyan-500 bg-cyan-900/20'}
                         `}>
                           {p.category}
                         </span>
                         {isActive && <span className="text-[9px] text-green-400 font-bold animate-pulse">ACTIVE</span>}
                    </div>
                    <h3 className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>{p.title}</h3>
                    <p className="text-[11px] text-gray-500 mt-1">{p.variableName}</p>
                </div>
                
                {/* Checkbox Visual */}
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                    ${isActive ? 'bg-primary border-primary' : 'border-gray-600 bg-gray-800'}
                `}>
                    {isActive && <svg className="w-3 h-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-800 bg-gray-900 text-[10px] text-gray-400 flex justify-between items-center">
         <span>{activeProducts.length} Layers Fused</span>
         {activeProducts.length > 0 && <button onClick={() => onSelectProducts([])} className="text-red-400 hover:text-white">Clear All</button>}
      </div>
    </div>
  );
};

export default DataDiscoveryPanel;
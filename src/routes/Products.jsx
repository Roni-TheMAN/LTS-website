import React from 'react';
import ProductCard from '../components/ProductCard.jsx';
import { products } from '../data/products.js';

function Products() {
  return (
    <div className="section-container py-10">
      <div className="grid gap-8 lg:grid-cols-[0.35fr_1fr]">
        <aside className="card-surface h-fit space-y-5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="tag">Filters</p>
              <h3 className="text-lg font-semibold text-white">Refine results</h3>
            </div>
            <button type="button" className="text-sm text-blue-300">
              Clear all
            </button>
          </div>
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase text-slate-500">Price Range</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <input type="range" min="0" max="500" defaultValue="420" className="w-full accent-blue-500" />
                  <span>$0 - $500</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500">Categories</p>
              {['Connectivity', 'Access Control', 'Surveillance', 'Voice'].map((item) => (
                <label key={item} className="flex items-center gap-3 text-slate-300">
                  <input type="checkbox" className="form-checkbox rounded border-slate-700 bg-slate-800 text-blue-500" />
                  {item}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500">Brand</p>
              {['UniFi', 'Grandstream', 'Ubiquiti'].map((item) => (
                <label key={item} className="flex items-center gap-3 text-slate-300">
                  <input type="checkbox" className="form-checkbox rounded border-slate-700 bg-slate-800 text-blue-500" />
                  {item}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500">Availability</p>
              {['In Stock', 'Preorder', 'Backorder'].map((item) => (
                <label key={item} className="flex items-center gap-3 text-slate-300">
                  <input type="checkbox" className="form-checkbox rounded border-slate-700 bg-slate-800 text-blue-500" />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="card-surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="tag">Top hardware</p>
              <h2 className="text-2xl font-bold text-white">Streaming {products.length} products</h2>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <label htmlFor="sort">Sort by</label>
              <select
                id="sort"
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                defaultValue="featured"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;

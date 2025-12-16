import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="card-surface flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 badge-soft">{product.category}</div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white leading-tight">{product.name}</h3>
            <p className="text-sm text-slate-400">{product.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">From</p>
            <p className="text-xl font-bold text-white">${product.price.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-soft">{product.stock} in stock</span>
          <span className="badge-soft">{product.delivery}</span>
        </div>
        <p className="text-sm text-slate-400 line-clamp-2">{product.description}</p>
        <div className="mt-auto flex items-center gap-3">
          <Link to={`/products/${product.id}`} className="btn-secondary flex-1 justify-center">
            View Details
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => addToCart(product, 1)}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;

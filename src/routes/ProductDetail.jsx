import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useCart } from '../context/CartContext.jsx';
import { getProductById, products } from '../data/products.js';

function ProductDetail() {
  const { productId } = useParams();
  const product = useMemo(() => getProductById(productId), [productId]);
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const navigate = useNavigate();

  if (!product) {
    return (
      <div className="section-container py-12">
        <div className="card-surface p-8 space-y-4 text-center">
          <p className="text-slate-300">Product not found.</p>
          <Link to="/products" className="btn-primary w-fit mx-auto">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const recommended = products.filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <div className="section-container py-10 space-y-10">
      <div className="flex items-center justify-between">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Products', to: '/products' },
            { label: product.name },
          ]}
        />
        <button type="button" className="btn-secondary hidden md:inline-flex">
          Secure Checkout
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface overflow-hidden">
          <div className="aspect-[16/10] overflow-hidden bg-slate-900">
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {product.highlights?.map((item) => (
              <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="card-surface space-y-3 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="tag">{product.category}</span>
                <span className="badge-soft">{product.badge}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                In stock
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">{product.name}</h1>
            <p className="text-slate-400">{product.subtitle}</p>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-bold text-white">${product.price.toFixed(2)}</p>
              {product.oldPrice && <p className="text-slate-500 line-through">${product.oldPrice.toFixed(2)}</p>}
              <span className="badge-soft">Retailer Price</span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              {product.specs?.map((spec) => (
                <span key={spec} className="badge-soft">
                  {spec}
                </span>
              ))}
            </div>
            <p className="text-slate-300 leading-relaxed">{product.description}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-200">
                <button
                  type="button"
                  className="px-3 text-lg"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-transparent text-center text-lg font-semibold focus:outline-none"
                />
                <button type="button" className="px-3 text-lg" onClick={() => setQuantity((q) => q + 1)}>
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                onClick={() => addToCart(product, quantity)}
              >
                Add to Cart
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/cart')}>
                Go to Cart
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="badge-soft">Free Shipping</span>
              <span className="badge-soft">30-day returns</span>
              <span className="badge-soft">Warranty Included</span>
            </div>
          </div>

          <div className="card-surface space-y-3 p-6">
            <h3 className="text-lg font-semibold text-white">Product Insights</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Capture every detail with edge AI processing, dual-band WiFi fallback, and secure remote management. Built for
                indoor or outdoor deployments with IP67 protection.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase text-slate-500">Analytics</p>
                  <p className="text-slate-200">On-device motion analysis with alert zones.</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase text-slate-500">Security</p>
                  <p className="text-slate-200">End-to-end encryption and signed firmware updates.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="tag">Frequently bought together</p>
            <h3 className="text-xl font-semibold text-white">Pair with these essentials</h3>
          </div>
          <Link to="/products" className="text-sm text-blue-300">
            View all products
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {recommended.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;

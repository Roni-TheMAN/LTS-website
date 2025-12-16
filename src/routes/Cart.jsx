import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

function Cart() {
  const { items, updateQuantity, removeFromCart, totals } = useCart();
  const navigate = useNavigate();

  const hasItems = items.length > 0;

  return (
    <div className="section-container py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="tag">Cart</p>
          <h1 className="text-3xl font-bold text-white">Your Cart</h1>
          <p className="text-slate-400 text-sm">{items.length} items ready for checkout.</p>
        </div>
        <Link to="/products" className="text-sm text-blue-300">
          Continue shopping
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] mt-8">
        <div className="card-surface divide-y divide-slate-800">
          {!hasItems && <p className="p-6 text-slate-300">Your cart is empty.</p>}
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-20 w-28 overflow-hidden rounded-xl bg-slate-900">
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm uppercase text-slate-500">{item.category}</p>
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="text-slate-300 text-sm">{item.subtitle}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="badge-soft">{item.delivery}</span>
                    <span className="badge-soft">In Stock</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-200">
                  <button
                    type="button"
                    className="px-3 text-lg"
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.id, Math.max(1, Number(e.target.value)))}
                    className="w-16 bg-transparent text-center text-lg font-semibold focus:outline-none"
                  />
                  <button type="button" className="px-3 text-lg" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>
                <p className="text-lg font-semibold text-white w-24 text-right">${(item.price * item.quantity).toFixed(2)}</p>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-300 text-sm"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Order Summary</h3>
              <span className="badge-soft">Secure Checkout</span>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span>${totals.shipping.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated Tax</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-base font-semibold text-white">
                <span>Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary w-full justify-center"
              disabled={!hasItems}
              onClick={() => navigate('/checkout')}
            >
              Proceed to Checkout
            </button>
          </div>
          <div className="card-surface p-5 text-sm text-slate-300 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <p>In stock • Ships next business day</p>
            </div>
            <p className="text-slate-400">All orders include tamper-proof packaging and insurance.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Cart;

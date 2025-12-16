import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

function Checkout() {
  const { items, totals } = useCart();

  return (
    <div className="section-container py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="tag">Checkout</p>
          <h1 className="text-3xl font-bold text-white">Secure Checkout</h1>
          <p className="text-slate-400 text-sm">Please review your details and complete your purchase.</p>
        </div>
        <Link to="/cart" className="text-sm text-blue-300">
          Return to cart
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="card-surface p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Contact Information</h3>
              <p className="text-sm text-slate-400">
                Already have an account? <button type="button" className="text-blue-300">Log in</button>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="Email address" />
              <input className="input" placeholder="Phone number" />
            </div>
          </div>

          <div className="card-surface p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Shipping Address</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="First name" />
              <input className="input" placeholder="Last name" />
            </div>
            <input className="input" placeholder="Company (optional)" />
            <input className="input" placeholder="Street address" />
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="City" />
              <input className="input" placeholder="State / Region" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <input className="input" placeholder="Postal code" />
              <input className="input" placeholder="Country" />
              <input className="input" placeholder="Contact phone" />
            </div>
          </div>

          <div className="card-surface p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Shipping Method</h3>
            <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
              <div>
                <p className="font-semibold text-white">Expedited Shipping</p>
                <p className="text-slate-400">Arrives in 2 business days</p>
              </div>
              <div className="text-right">
                <p className="text-white">${totals.shipping.toFixed(2)}</p>
                <p className="text-xs text-slate-500">Calculated at next step</p>
              </div>
              <input type="radio" name="shipping" defaultChecked className="h-4 w-4 text-blue-500" />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
              <div>
                <p className="font-semibold text-white">Standard Shipping</p>
                <p className="text-slate-400">Arrives in 5-7 business days</p>
              </div>
              <div className="text-right">
                <p className="text-white">Included</p>
                <p className="text-xs text-slate-500">Free with orders over $500</p>
              </div>
              <input type="radio" name="shipping" className="h-4 w-4 text-blue-500" />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <Link to="/cart" className="text-sm text-blue-300">
              Return to cart
            </Link>
            <button type="button" className="btn-primary">Continue to Shipping</button>
          </div>
        </div>

        <div className="lg:sticky lg:top-20 space-y-4">
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Order Summary</h3>
              <span className="badge-soft">{items.length} items</span>
            </div>
            <div className="divide-y divide-slate-800 text-sm text-slate-300">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-20 overflow-hidden rounded-xl bg-slate-900">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-400">Qty {item.quantity}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-white">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping Estimate</span>
                <span>${totals.shipping.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated Taxes</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-base font-semibold text-white">
                <span>Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
            <button type="button" className="btn-primary w-full justify-center">
              Secure Checkout
            </button>
          </div>
          <div className="card-surface p-5 text-sm text-slate-300 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <p>Payments secured with end-to-end encryption.</p>
            </div>
            <p className="text-slate-400">Need help? Email support@legacy.tech for white-glove deployment assistance.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;

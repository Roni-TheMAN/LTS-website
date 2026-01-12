
import React from 'react';
import { useNavigation } from '../src/NavigationContext.tsx';
import { useCart } from '../src/CartContext.tsx';

const CheckoutPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { items, cartTotal } = useCart();
  const tax = cartTotal * 0.08;
  const total = cartTotal + tax;

  return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 py-4">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('HOME')}>
              <div className="size-8 text-blue-600 bg-blue-50 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">hub</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 font-display">Legacy Tech Solutions</h2>
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span className="hidden sm:inline">Secure Checkout</span>
            </div>
          </div>
        </header>

        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            <div className="lg:col-span-7 flex flex-col gap-10">
              {/* Improved Stepper Component */}
              <nav aria-label="Progress" className="py-4">
                <ol className="flex items-center w-full" role="list">
                  {/* Step 1: Info (Completed) */}
                  <li className="relative flex-1">
                    <div className="absolute top-4 left-0 w-full h-0.5 bg-blue-600" aria-hidden="true"></div>
                    <div className="group relative flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white transition-colors relative z-10">
                      <span className="material-symbols-outlined text-white text-[18px]">check</span>
                    </span>
                      <span className="mt-2 text-xs font-bold uppercase tracking-wider text-blue-600 hidden sm:block">Info</span>
                    </div>
                  </li>

                  {/* Step 2: Shipping (Active) */}
                  <li className="relative flex-1">
                    <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200" aria-hidden="true">
                      <div className="absolute left-0 h-full w-1/2 bg-blue-600"></div>
                    </div>
                    <div className="group relative flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white ring-4 ring-white transition-colors relative z-10">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                    </span>
                      <span className="mt-2 text-xs font-bold uppercase tracking-wider text-gray-900 hidden sm:block">Shipping</span>
                    </div>
                  </li>

                  {/* Step 3: Payment (Pending) */}
                  <li className="relative flex-shrink-0">
                    <div className="group relative flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-200 bg-white ring-4 ring-white transition-colors relative z-10">
                      <span className="h-2.5 w-2.5 rounded-full bg-transparent"></span>
                    </span>
                      <span className="mt-2 text-xs font-bold uppercase tracking-wider text-gray-400 hidden sm:block">Payment</span>
                    </div>
                  </li>
                </ol>
              </nav>

              <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
                  <span className="text-sm text-gray-500">Already have an account? <button className="text-blue-600 hover:text-blue-700 font-medium">Log in</button></span>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <label className="block">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">Email address</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="tech@legacy.com" type="email" />
                  </label>
                  <div className="flex items-center gap-3">
                    <input className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" id="newsletter" type="checkbox" />
                    <label className="text-sm text-gray-500 select-none" htmlFor="newsletter">Email me with news and offers</label>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Shipping Address</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <label className="block">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">First name</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="John" type="text" />
                  </label>
                  <label className="block">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">Last name</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="Doe" type="text" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">Address</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="123 Tech Blvd, Suite 400" type="text" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">Apartment, suite, etc. (optional)</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" type="text" />
                  </label>
                  <label className="block">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">City</span>
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="San Francisco" type="text" />
                  </label>
                  <div className="grid grid-cols-2 gap-5">
                    <label className="block">
                      <span className="text-gray-900 text-sm font-medium mb-1.5 block">State</span>
                      <select className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all">
                        <option>CA</option>
                        <option>NY</option>
                        <option>TX</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-gray-900 text-sm font-medium mb-1.5 block">Zip</span>
                      <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 transition-all" placeholder="94107" type="text" />
                    </label>
                  </div>
                  <label className="block md:col-span-2">
                    <span className="text-gray-900 text-sm font-medium mb-1.5 block">Phone</span>
                    <div className="relative">
                      <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4 pl-10 transition-all" placeholder="(555) 000-0000" type="tel" />
                      <span className="material-symbols-outlined absolute left-3 top-3 text-gray-500 text-[20px]">call</span>
                    </div>
                  </label>
                </div>
              </section>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
                <button
                    onClick={() => navigate('CART')}
                    className="flex items-center gap-2 text-gray-500 font-medium hover:text-blue-600 transition-colors py-2"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  Return to Cart
                </button>
                <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                  Continue to Shipping
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 p-6 shadow-xl shadow-slate-200/50">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
                  Order Summary
                  <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100">{items.length} items</span>
                </h3>
                <div className="flex flex-col gap-6 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map(item => (
                      <div key={item.id} className="flex gap-4 group">
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-gray-200 group-hover:border-blue-200 transition-colors">
                          <img alt={item.name} className="h-full w-full object-cover mix-blend-multiply" src={item.image} />
                          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-blue-600 text-[10px] font-bold text-white">{item.quantity}</span>
                        </div>
                        <div className="flex flex-1 flex-col justify-center">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-gray-900 text-sm leading-tight pr-4">{item.name}</h4>
                            <p className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                          {/*<p className="text-xs text-gray-500">{item.category}</p>*/}
                        </div>
                      </div>
                  ))}
                </div>

                <div className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <input className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-600 focus:ring-blue-600 text-sm h-11 px-3 pl-9 transition-all" placeholder="Discount code" type="text" />
                    <span className="material-symbols-outlined absolute left-2.5 top-3 text-gray-400 text-[18px]">sell</span>
                  </div>
                  <button className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg px-5 text-sm transition-colors border border-gray-200">Apply</button>
                </div>

                <div className="border-t border-gray-200 pt-5 flex flex-col gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900 font-medium">${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span className="text-gray-500 italic">Calculated at next step</span>
                  </div>
                  <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1 group cursor-help">
                    Estimated Taxes
                    <span className="material-symbols-outlined text-[14px] text-gray-400 group-hover:text-blue-600 transition-colors">help</span>
                  </span>
                    <span className="text-gray-900 font-medium">${tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 mt-6 pt-6 flex justify-between items-end">
                  <span className="text-gray-900 text-lg font-bold">Total</span>
                  <div className="text-right">
                    <span className="text-gray-500 text-xs block mb-1">USD</span>
                    <span className="text-3xl font-bold text-blue-600 tracking-tight">${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-8 flex justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">lock</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider">SSL Secure</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">verified_user</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider">Money Back</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
};

export default CheckoutPage;

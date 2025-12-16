import React from 'react';
import { Link } from 'react-router-dom';
import CategoryCard from '../components/CategoryCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { products } from '../data/products.js';

function Home() {
  const featured = products.slice(0, 4);
  const categories = [
    { title: 'Access Control', description: 'Smart entry, encrypted credentials', icon: '🔐' },
    { title: 'Voice', description: 'HD voice with PoE and SIP', icon: '📞' },
    { title: 'Surveillance', description: 'Cameras with AI analytics', icon: '🎯' },
    { title: 'Connectivity', description: 'WiFi 6 and secure gateways', icon: '📡' },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-bg opacity-40" />
      <div className="section-container py-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-200 shadow-glow">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              Enterprise-grade hardware ships same day
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white">
              Secure. Connect. <span className="text-blue-400">Communicate.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl">
              Modernize your infrastructure with rugged UniFi hardware, AI-powered surveillance, and dependable voice systems built for scale.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary">
                Explore Catalog
              </Link>
              <button type="button" className="btn-secondary">
                Talk to an Expert
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-300 max-w-lg">
              <div className="card-surface p-4">
                <p className="text-2xl font-bold text-white">48+</p>
                <p className="text-slate-400">Products in stock and ready to deploy</p>
              </div>
              <div className="card-surface p-4">
                <p className="text-2xl font-bold text-white">99.99%</p>
                <p className="text-slate-400">Network uptime across enterprise rollouts</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-blue-500/10 blur-3xl" />
            <div className="relative card-surface p-6">
              <div className="flex items-center gap-3 text-sm text-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                Live network health • No incidents
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 p-4 border border-slate-800">
                  <p className="text-xs text-slate-400">Latency</p>
                  <p className="text-3xl font-semibold text-white">4.2 ms</p>
                  <p className="text-xs text-blue-300 mt-1">-0.8% vs last hour</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-b from-blue-600/60 to-blue-500/60 p-4 border border-blue-500/30 shadow-glow">
                  <p className="text-xs text-blue-50">Throughput</p>
                  <p className="text-3xl font-semibold text-white">9.8 Gbps</p>
                  <p className="text-xs text-blue-50/80 mt-1">Peak capacity</p>
                </div>
                <div className="col-span-2 rounded-2xl bg-slate-900/80 p-4 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Sites</span>
                    <span>US • EU • APAC</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                  </div>
                  <p className="mt-2 text-sm text-blue-200">Deployments scaling globally</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-container py-8">
        <div className="grid gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="badge-soft">Cloud Managed</span>
            <p className="text-slate-300 text-sm">Single-pane control</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="badge-soft">Official Partner</span>
            <p className="text-slate-300 text-sm">Certified deployments</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="badge-soft">Expert Support</span>
            <p className="text-slate-300 text-sm">24/7 helpdesk</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="badge-soft">Pro Tools</span>
            <p className="text-slate-300 text-sm">RF & network design</p>
          </div>
        </div>
      </div>

      <div className="section-container py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="tag">Product Categories</p>
            <h2 className="text-2xl font-bold text-white">Purpose-built for modern networks</h2>
          </div>
          <Link to="/products" className="btn-secondary hidden md:inline-flex">
            View All
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.title} {...category} />
          ))}
        </div>
      </div>

      <div className="section-container py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="tag">Featured Hardware</p>
            <h2 className="text-2xl font-bold text-white">Ready to deploy</h2>
          </div>
          <Link to="/products" className="btn-secondary hidden md:inline-flex">
            Browse Catalog
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>

      <div className="section-container py-12">
        <div className="card-surface relative overflow-hidden p-8 md:p-10">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-transparent to-indigo-500/10" />
          <div className="relative grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-3">
              <p className="tag">Stay ahead of the curve</p>
              <h3 className="text-2xl md:text-3xl font-bold text-white">Network intelligence in your inbox</h3>
              <p className="text-slate-300 max-w-2xl">
                Get architecture guides, deployment playbooks, and product releases curated by our engineering team.
              </p>
              <div className="flex flex-col gap-3 md:flex-row">
                <input className="input md:flex-1" placeholder="you@company.com" />
                <button type="button" className="btn-primary md:w-40">Subscribe</button>
              </div>
              <p className="text-xs text-slate-500">We respect your inbox. Unsubscribe anytime.</p>
            </div>
            <div className="card-surface bg-slate-900/80 p-5 space-y-3 border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-200 flex items-center justify-center text-lg">⚡</span>
                <div>
                  <p className="text-slate-200 font-semibold">Secure updates</p>
                  <p className="text-sm text-slate-400">Signed firmware and rapid patching.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-200 flex items-center justify-center text-lg">🛰️</span>
                <div>
                  <p className="text-slate-200 font-semibold">Remote visibility</p>
                  <p className="text-sm text-slate-400">Single dashboard for every site.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-200 flex items-center justify-center text-lg">🛡️</span>
                <div>
                  <p className="text-slate-200 font-semibold">Hardened security</p>
                  <p className="text-sm text-slate-400">Zero-trust defaults and MFA access.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;

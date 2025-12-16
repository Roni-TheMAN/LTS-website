import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="border-t border-slate-800/70 bg-slate-950/60 mt-16">
      <div className="section-container grid gap-10 py-10 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
                <path d="M4 4h6v6H4z" opacity="0.8" />
                <path d="M14 4h6v6h-6z" />
                <path d="M4 14h6v6H4z" />
                <path d="M14 14h6v6h-6z" opacity="0.8" />
              </svg>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Legacy Tech</p>
              <p className="text-lg font-semibold text-white">Solutions</p>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Precision-engineered hardware and software that secures and connects your infrastructure at scale.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="text-slate-200 font-semibold">Product</h4>
          <div className="flex flex-col gap-2 text-slate-400">
            <Link to="/products">Hardware</Link>
            <Link to="/products">Software</Link>
            <Link to="/products">Integrations</Link>
            <Link to="/products">Network Design</Link>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="text-slate-200 font-semibold">Resources</h4>
          <div className="flex flex-col gap-2 text-slate-400">
            <Link to="/products">Documentation</Link>
            <Link to="/products">Support</Link>
            <Link to="/products">Security</Link>
            <Link to="/products">Status</Link>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="text-slate-200 font-semibold">Contact</h4>
          <div className="flex flex-col gap-2 text-slate-400">
            <p>sales@legacy.tech</p>
            <p>+1 (415) 555-0147</p>
            <p>Mon-Fri 9am-6pm PT</p>
            <Link to="/products" className="text-blue-300 font-semibold">Request a demo</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        © 2024 Legacy Tech Solutions. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;

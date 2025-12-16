import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="section-container py-16 text-center space-y-4">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 text-2xl font-bold shadow-glow">
        404
      </div>
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <p className="text-slate-400 max-w-xl mx-auto">
        The page you are looking for does not exist or was moved. Please return to the catalog.
      </p>
      <div className="flex justify-center gap-3">
        <Link to="/" className="btn-secondary">
          Back Home
        </Link>
        <Link to="/products" className="btn-primary">
          Browse Products
        </Link>
      </div>
    </div>
  );
}

export default NotFound;

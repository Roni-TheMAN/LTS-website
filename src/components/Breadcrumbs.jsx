import React from 'react';
import { Link } from 'react-router-dom';

function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-400" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <span className="text-slate-600">/</span>}
          {item.to ? (
            <Link to={item.to} className="text-slate-300 hover:text-white">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-200">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default Breadcrumbs;

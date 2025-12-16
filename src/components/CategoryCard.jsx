import React from 'react';

function CategoryCard({ title, description, icon }) {
  return (
    <div className="card-surface p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <button type="button" className="btn-secondary w-full justify-center">
        Explore
      </button>
    </div>
  );
}

export default CategoryCard;

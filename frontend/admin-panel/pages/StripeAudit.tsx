import React from 'react';
import { RefreshCw, History, CheckCircle, Radio, AlertTriangle, Gavel } from 'lucide-react';

const StripeAudit: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
             Stripe Audit & Reconciliation
             <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase border border-orange-200">Read Only</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">Monitor sync status between internal database and Stripe ledger. Check for uncaptured charges and product mapping.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
            <History className="w-4 h-4" /> Sync Logs
          </button>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm opacity-50 cursor-not-allowed">
            <RefreshCw className="w-4 h-4" /> Force Sync
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Sync Status", val: "Healthy", icon: CheckCircle, color: "emerald", sub: "Last sync: 2 mins ago" },
          { label: "Pending Webhooks", val: "0", icon: Radio, color: "slate", sub: "All events processed" },
          { label: "Unmapped Products", val: "3", icon: AlertTriangle, color: "amber", sub: "Action required", subColor: "amber-600" },
          { label: "Disputes", val: "0", icon: Gavel, color: "slate", sub: "Last 30 days" }
        ].map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-slate-300 transition-colors">
             <div>
               <span className="text-sm text-slate-500 font-medium">{card.label}</span>
               <div className={`mt-2 text-2xl font-bold text-${card.color === 'slate' ? 'slate-900' : card.color + '-600'}`}>{card.val}</div>
               <div className={`text-xs mt-1 ${card.subColor ? `text-${card.subColor}` : 'text-slate-400'}`}>{card.sub}</div>
             </div>
             <div className={`absolute top-4 right-4 w-8 h-8 rounded-full bg-${card.color}-50 flex items-center justify-center border border-${card.color}-100`}>
                <card.icon className={`w-4 h-4 text-${card.color}-500`} />
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
               <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900">Product ID Mapping</h2>
                    <p className="text-xs text-slate-500 mt-0.5">LTS SKU vs Stripe Product ID correlation.</p>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200">Live</span>
               </div>
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Internal SKU</th>
                      <th className="px-6 py-3 font-medium">Stripe Product ID</th>
                      <th className="px-6 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-white">
                      <td className="px-6 py-4 font-medium text-slate-900">LTS-2023-KEY</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">prod_N8s9...2kja</td>
                      <td className="px-6 py-4 text-right"><span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Synced</span></td>
                    </tr>
                    <tr className="bg-amber-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">LTS-SUB-PREM</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 italic">-- Missing --</td>
                      <td className="px-6 py-4 text-right"><span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">Unmapped</span></td>
                    </tr>
                  </tbody>
               </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
               <h3 className="font-bold text-slate-900 mb-4">Integrity Check</h3>
               <div className="flex items-start gap-4 p-4 rounded-lg bg-white border border-slate-200">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                     <h4 className="text-sm font-semibold text-slate-900 mb-1">Orphaned Price ID Detected</h4>
                     <p className="text-xs text-slate-500 leading-relaxed">Price ID <code className="bg-slate-100 px-1 py-0.5 rounded">price_1Mz...</code> exists in Stripe but is not linked to any variant.</p>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-amber-200">High</span>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
               <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 text-sm">Recent Webhooks</h2>
                  <button className="text-indigo-600 text-xs font-medium">View All</button>
               </div>
               <div className="divide-y divide-slate-100">
                  {['payment_intent.succeeded', 'customer.created', 'charge.failed'].map((evt, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-500">evt_1N...9j{i}</span>
                        <span className="text-[10px] text-slate-400">10m ago</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{evt}</span>
                        {evt.includes('failed') ? <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Ignored</span> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default StripeAudit;

import React, { useState } from 'react';
import { ShieldCheck, Loader2, Lock, Mail } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('lts@lts.com');
  const [password, setPassword] = useState('fcdrfecd');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API network delay
    setTimeout(() => {
      // Basic validation mock - in a real app this would hit an endpoint
      if (email.length > 0 && password.length > 0) {
         onLogin();
      } else {
         setError('Please enter a valid email and password.');
         setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] relative overflow-hidden font-sans text-neutral-900">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
      </div>

      <div className="w-full max-w-md z-10 p-4 animate-in fade-in zoom-in-95 duration-300">
         <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 overflow-hidden">
            <div className="p-8 pb-6">
               <div className="flex flex-col items-center mb-8">
                  <div className="w-12 h-12 bg-neutral-950 rounded-xl flex items-center justify-center text-white mb-4 shadow-xl shadow-neutral-900/10 ring-4 ring-neutral-50">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-bold text-neutral-950 tracking-tight">LTS Admin</h1>
                  <p className="text-sm text-neutral-500 mt-2 font-medium">Sign in to manage your inventory</p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Email</label>
                    <div className="relative group">
                       <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
                       <input 
                         type="email" 
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all placeholder:text-neutral-400 font-medium text-neutral-900"
                         placeholder="admin@lts.com"
                         autoFocus
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                       <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider">Password</label>
                       <a href="#" className="text-[10px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors">Forgot password?</a>
                    </div>
                    <div className="relative group">
                       <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
                       <input 
                         type="password" 
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all placeholder:text-neutral-400 font-medium text-neutral-900"
                         placeholder="••••••••"
                       />
                    </div>
                  </div>
                  
                  {error && (
                    <div className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                      <div className="w-1 h-1 rounded-full bg-red-600"></div>
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2 h-10"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                  </button>
               </form>
            </div>
            <div className="bg-neutral-50/50 p-4 border-t border-neutral-100 text-center">
               <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">Secured by LTS Systems</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Login;
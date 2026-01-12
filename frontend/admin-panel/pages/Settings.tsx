import React, { useState } from 'react';
import { History, PlusCircle, Archive, RotateCcw, Monitor, FolderX, Globe, Package, Bell, X, Edit2, Check, AlertCircle, Save, Folder, Users, Lock, Trash2, Mail, Shield } from 'lucide-react';

interface Brand {
  id: number;
  name: string;
  slug: string;
  status: 'active' | 'archived';
}

interface Category {
  id: number;
  name: string;
  slug: string;
  status: 'active' | 'archived';
  parentId: number | null;
  count?: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  status: 'active' | 'inactive';
}

const INITIAL_BRANDS: Brand[] = [
  { id: 1, name: 'Acme Corp', slug: 'acme-corp', status: 'active' },
  { id: 2, name: 'Soylent Corp', slug: 'soylent-corp', status: 'archived' },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: 'Hardware', slug: 'hardware', status: 'active', parentId: null, count: 12 },
  { id: 2, name: 'Laptops', slug: 'laptops', status: 'active', parentId: 1 },
  { id: 3, name: 'Workstations', slug: 'workstations', status: 'active', parentId: 1 },
  { id: 4, name: 'Legacy Cables', slug: 'legacy-cables', status: 'archived', parentId: null },
];

const INITIAL_USERS: User[] = [
  { id: 1, name: 'Admin User', email: 'admin@lts.com', role: 'Admin', status: 'active' },
  { id: 2, name: 'John Doe', email: 'john@lts.com', role: 'Editor', status: 'active' },
  { id: 3, name: 'Sarah Connor', email: 'sarah@lts.com', role: 'Viewer', status: 'inactive' },
];

const SettingsView: React.FC = () => {
  // Brand State
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [brandFormData, setBrandFormData] = useState({ name: '', slug: '', status: 'active' as 'active' | 'archived' });

  // Category State
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', slug: '', status: 'active' as 'active' | 'archived', parentId: '' as string | number });

  // User State
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState({ name: '', email: '', role: 'Viewer' as 'Admin' | 'Editor' | 'Viewer', password: '', status: 'active' as 'active' | 'inactive' });


  // --- BRAND HANDLERS ---
  const handleOpenAddBrand = () => {
    setEditingBrandId(null);
    setBrandFormData({ name: '', slug: '', status: 'active' });
    setIsBrandModalOpen(true);
  };

  const handleOpenEditBrand = (brand: Brand) => {
    setEditingBrandId(brand.id);
    setBrandFormData({ name: brand.name, slug: brand.slug, status: brand.status });
    setIsBrandModalOpen(true);
  };

  const handleSaveBrand = () => {
    if (editingBrandId) {
      setBrands(brands.map(b => b.id === editingBrandId ? { ...b, ...brandFormData } : b));
    } else {
      const newBrand: Brand = {
        id: Math.max(...brands.map(b => b.id), 0) + 1,
        name: brandFormData.name,
        slug: brandFormData.slug || brandFormData.name.toLowerCase().replace(/\s+/g, '-'),
        status: brandFormData.status
      };
      setBrands([...brands, newBrand]);
    }
    setIsBrandModalOpen(false);
  };

  const handleBrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!editingBrandId) {
      setBrandFormData({ ...brandFormData, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') });
    } else {
      setBrandFormData({ ...brandFormData, name });
    }
  };

  const toggleBrandStatus = (id: number) => {
    setBrands(brands.map(b => b.id === id ? { ...b, status: b.status === 'active' ? 'archived' : 'active' } : b));
  };

  // --- CATEGORY HANDLERS ---
  const handleOpenAddCategory = () => {
    setEditingCategoryId(null);
    setCategoryFormData({ name: '', slug: '', status: 'active', parentId: '' });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryFormData({ name: cat.name, slug: cat.slug, status: cat.status, parentId: cat.parentId === null ? '' : cat.parentId });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = () => {
    const parentId = categoryFormData.parentId === '' ? null : Number(categoryFormData.parentId);

    if (editingCategoryId) {
      setCategories(categories.map(c => c.id === editingCategoryId ? { ...c, ...categoryFormData, parentId } : c));
    } else {
      const newCat: Category = {
        id: Math.max(...categories.map(c => c.id), 0) + 1,
        name: categoryFormData.name,
        slug: categoryFormData.slug || categoryFormData.name.toLowerCase().replace(/\s+/g, '-'),
        status: categoryFormData.status,
        parentId,
        count: 0
      };
      setCategories([...categories, newCat]);
    }
    setIsCategoryModalOpen(false);
  };

  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!editingCategoryId) {
      setCategoryFormData({ ...categoryFormData, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') });
    } else {
      setCategoryFormData({ ...categoryFormData, name });
    }
  };

  const toggleCategoryStatus = (id: number) => {
    setCategories(categories.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'archived' : 'active' } : c));
  };

  // --- USER HANDLERS ---
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserFormData({ name: '', email: '', role: 'Viewer', password: '', status: 'active' });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserFormData({ name: user.name, email: user.email, role: user.role, password: '', status: user.status });
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = (id: number) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const handleSaveUser = () => {
    if (editingUserId) {
      setUsers(users.map(u => u.id === editingUserId ? {
        ...u,
        name: userFormData.name,
        email: userFormData.email,
        role: userFormData.role,
        status: userFormData.status
      } : u));
    } else {
      const newUser: User = {
        id: Date.now(),
        name: userFormData.name,
        email: userFormData.email,
        role: userFormData.role,
        status: userFormData.status
      };
      setUsers([...users, newUser]);
    }
    setIsUserModalOpen(false);
  };

  // Helper to render categories
  const activeRoots = categories.filter(c => c.status === 'active' && c.parentId === null);
  const archivedCategories = categories.filter(c => c.status === 'archived');

  return (
      <div className="max-w-7xl mx-auto space-y-8 relative pb-10">

        {/* Brand Modal */}
        {isBrandModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{editingBrandId ? 'Edit Brand' : 'Add Brand'}</h3>
                  <button onClick={() => setIsBrandModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Brand Name</label>
                    <input
                        type="text"
                        value={brandFormData.name}
                        onChange={handleBrandNameChange}
                        placeholder="e.g. Acme Corp"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                        autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Slug</label>
                    <input
                        type="text"
                        value={brandFormData.slug}
                        onChange={(e) => setBrandFormData({...brandFormData, slug: e.target.value})}
                        placeholder="e.g. acme-corp"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400 font-mono text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-3">Status</label>
                    <div className="flex items-center gap-3">
                      <button
                          onClick={() => setBrandFormData({...brandFormData, status: brandFormData.status === 'active' ? 'archived' : 'active'})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${brandFormData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      >
                        <span className={`${brandFormData.status === 'active' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition shadow-sm`} />
                      </button>
                      <span className={`text-sm font-medium ${brandFormData.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {brandFormData.status === 'active' ? 'Active' : 'Inactive / Archived'}
                    </span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button onClick={() => setIsBrandModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  <button onClick={handleSaveBrand} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors">
                    {editingBrandId ? 'Save Changes' : 'Create Brand'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Category Modal */}
        {isCategoryModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{editingCategoryId ? 'Edit Category' : 'Add Category'}</h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Category Name</label>
                    <input
                        type="text"
                        value={categoryFormData.name}
                        onChange={handleCategoryNameChange}
                        placeholder="e.g. Hardware"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                        autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Slug</label>
                    <input
                        type="text"
                        value={categoryFormData.slug}
                        onChange={(e) => setCategoryFormData({...categoryFormData, slug: e.target.value})}
                        placeholder="e.g. hardware"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400 font-mono text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Parent Category</label>
                    <select
                        value={categoryFormData.parentId}
                        onChange={(e) => setCategoryFormData({...categoryFormData, parentId: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all text-slate-700 cursor-pointer"
                    >
                      <option value="">No Parent (Root Category)</option>
                      {categories.filter(c => c.parentId === null && c.id !== editingCategoryId && c.status === 'active').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-3">Status</label>
                    <div className="flex items-center gap-3">
                      <button
                          onClick={() => setCategoryFormData({...categoryFormData, status: categoryFormData.status === 'active' ? 'archived' : 'active'})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${categoryFormData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      >
                        <span className={`${categoryFormData.status === 'active' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition shadow-sm`} />
                      </button>
                      <span className={`text-sm font-medium ${categoryFormData.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {categoryFormData.status === 'active' ? 'Active' : 'Inactive / Archived'}
                    </span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  <button onClick={handleSaveCategory} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors">
                    {editingCategoryId ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* User Modal */}
        {isUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{editingUserId ? 'Edit User' : 'Create User'}</h3>
                  <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Full Name</label>
                    <input
                        type="text"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                        placeholder="Jane Doe"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                        autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                          type="email"
                          value={userFormData.email}
                          onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                          placeholder="jane@lts.com"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Role</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={userFormData.role}
                            onChange={(e) => setUserFormData({...userFormData, role: e.target.value as any})}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all cursor-pointer appearance-none"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Editor">Editor</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Status</label>
                      <select
                          value={userFormData.status}
                          onChange={(e) => setUserFormData({...userFormData, status: e.target.value as any})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all cursor-pointer appearance-none"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                          type="password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                          placeholder={editingUserId ? "Leave blank to keep current" : "••••••••"}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  <button onClick={handleSaveUser} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors">
                    {editingUserId ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 mt-1">Manage global configurations, brands, category hierarchies, and user access.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
            <History className="w-4 h-4" /> Audit Log
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* Brands Manager */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Brands Manager</h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage partner brands and visibility.</p>
              </div>
              <button onClick={handleOpenAddBrand} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
                <PlusCircle className="w-4 h-4" /> Add Brand
              </button>
            </div>
            <div className="p-0 flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                <tr><th className="px-6 py-3 font-medium">Brand</th><th className="px-6 py-3 font-medium">Slug</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold ${brand.status === 'active' ? 'text-slate-600' : 'text-slate-400'}`}>
                          {brand.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className={brand.status === 'archived' ? 'text-slate-500' : ''}>{brand.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{brand.slug}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${brand.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {brand.status === 'active' ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEditBrand(brand)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleBrandStatus(brand.id)} className="text-slate-400 hover:text-slate-900 transition-colors p-1" title={brand.status === 'active' ? 'Archive' : 'Restore'}>
                            {brand.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 text-xs text-slate-500 text-center">Brands are soft-deleted to maintain integrity.</div>
          </div>

          {/* Category Hierarchy */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div><h2 className="text-lg font-semibold text-slate-900">Category Hierarchy</h2><p className="text-sm text-slate-500 mt-0.5">Organize product structure.</p></div>
              <button onClick={handleOpenAddCategory} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
                <PlusCircle className="w-4 h-4" /> Add Category
              </button>
            </div>

            <div className="p-6 flex-1 space-y-2 overflow-y-auto">
              {/* Active Roots */}
              {activeRoots.length === 0 && archivedCategories.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-sm">No categories found. Add one to get started.</div>
              )}

              {activeRoots.map(root => (
                  <div key={root.id}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 group">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-slate-500" />
                        <span className="font-medium text-slate-900">{root.name}</span>
                        {root.count !== undefined && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{root.count}</span>}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEditCategory(root)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleCategoryStatus(root.id)} className="text-slate-400 hover:text-slate-900 transition-colors p-1" title="Archive">
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="pl-8 space-y-1 border-l border-slate-200 ml-3.5 mt-1">
                      {categories.filter(c => c.status === 'active' && c.parentId === root.id).map(child => (
                          <div key={child.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded text-sm text-slate-700 group">
                            <span>{child.name}</span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenEditCategory(child)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => toggleCategoryStatus(child.id)} className="text-slate-400 hover:text-slate-900 transition-colors p-1" title="Archive">
                                <Archive className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
              ))}

              {/* Archived Section */}
              {archivedCategories.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="text-xs font-semibold text-slate-400 uppercase mb-2 px-2">Archived</div>
                    {archivedCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded group">
                          <div className="flex items-center gap-3 text-slate-400">
                            <FolderX className="w-5 h-5" />
                            <span className="line-through text-sm">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEditCategory(cat)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => toggleCategoryStatus(cat.id)} className="text-slate-400 hover:text-emerald-600 transition-colors p-1" title="Restore">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
              <p className="text-sm text-slate-500 mt-0.5">Manage team access and roles.</p>
            </div>
            <button onClick={handleOpenAddUser} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
              <PlusCircle className="w-4 h-4" /> Create User
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                                    user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        user.role === 'Editor' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                    {user.role}
                                </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        <span className={`text-xs ${user.status === 'active' ? 'text-slate-700' : 'text-slate-500'}`}>{user.status === 'active' ? 'Active' : 'Inactive'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEditUser(user)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(user.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">No users found. Create one to get started.</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">General Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
              <div className="flex justify-between mb-2"><Globe className="w-5 h-5 text-slate-500" /><div className="w-8 h-4 bg-green-500 rounded-full flex justify-end px-0.5 items-center"><div className="w-3 h-3 bg-white rounded-full"></div></div></div>
              <h3 className="font-medium text-slate-900 text-sm">Public API Access</h3>
              <p className="text-xs text-slate-500">Enabled for all read-only endpoints.</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
              <div className="flex justify-between mb-2"><Package className="w-5 h-5 text-slate-500" /><div className="w-8 h-4 bg-slate-300 rounded-full flex justify-start px-0.5 items-center"><div className="w-3 h-3 bg-white rounded-full shadow-sm"></div></div></div>
              <h3 className="font-medium text-slate-900 text-sm">Strict Inventory Sync</h3>
              <p className="text-xs text-slate-500">Prevent overselling is currently disabled.</p>
            </div>
          </div>
        </div>
      </div>
  );
};

export default SettingsView;
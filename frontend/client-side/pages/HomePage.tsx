import React from 'react';
import { useNavigation } from '../src/NavigationContext.tsx';
import { PRODUCTS } from '../data.ts';

const HomePage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <>
      <section className="relative pt-16 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-100 rounded-full blur-[100px] opacity-70 mix-blend-multiply"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[40vw] h-[40vw] bg-blue-50 rounded-full blur-[80px] opacity-80 mix-blend-multiply"></div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col gap-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-600 w-fit shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
                New Gen 3 Hardware Available
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-gray-900 font-display">
                Secure.<br />
                Connect.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">Scale Up.</span>
              </h1>
              <p className="text-xl text-gray-500 max-w-lg leading-relaxed font-light">
                Enterprise-grade hardware solutions for modern businesses. Premium partner for <strong>Grandstream</strong>, <strong>UniFi</strong>, and <strong>Secure RFID</strong> systems.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => navigate('PRODUCTS')}
                  className="h-14 px-8 rounded-full bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-all shadow-xl hover:-translate-y-1 flex items-center gap-2 group"
                >
                  Explore Catalog
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <button className="h-14 px-8 rounded-full border border-gray-200 bg-white text-gray-900 font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all hover:-translate-y-1">
                  View Projects
                </button>
              </div>
            </div>

            <div className="relative group perspective-1000">
              <div className="absolute -inset-4 bg-gradient-to-tr from-blue-400/20 to-purple-400/20 rounded-[2rem] blur-3xl -z-10"></div>
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/20 bg-white border border-white/50 aspect-[4/3] rotate-1 hover:rotate-0 transition-all duration-700 ease-out transform">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCt-JZu_PUz6hP0hinSityUCrv0wSlye-kUjuxkZTj1TdYPnvlVMa--ho-MsDCn61ZC1D25IkxjS5aRFsYv33Hrq5bbbo3dqKwR_g5rz-jjW4ECvdvHHPSUqiFCE1f0mrfx0KcvBdk6NZk6fIza-0mk2iwpe5W3P7u3yKj7pU4B1mK7r73BTWqfltJPmjT877BKBKorgvc0Um3DepuRIpBImGoaMlLhtC8VJzh-3zb2W6QAeinXAY_7ZMQ05UQb9FxrXHDp5_s6vrU')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-card max-w-xs animate-float hidden md:block border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                      <span className="material-symbols-outlined">verified</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Authorized Retailer</p>
                      <p className="text-sm font-bold text-gray-900">Official Warranty</p>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-8 left-8 right-8 text-white">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-medium mb-2 border border-white/10">Featured System</span>
                  <h3 className="font-bold text-2xl font-display">UniFi Protect Ecosystem</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Mobile: 2x2 grid with clean borders (no divide-x bug)
        Desktop: 4 cols with vertical dividers */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-white/60">
            {[
              { icon: "local_shipping", title: "Fast Shipping", desc: "Global delivery available" },
              { icon: "verified_user", title: "Official Partner", desc: "Authorized reseller" },
              { icon: "support_agent", title: "Expert Support", desc: "24/7 Tech assistance" },
              { icon: "inventory_2", title: "Bulk Orders", desc: "Enterprise pricing" },
            ].map((feature, idx) => (
                <div
                    key={idx}
                    className="
            flex items-center justify-center gap-4 py-8 sm:py-10 px-4
            border-gray-100
            border-b md:border-b-0
            border-r
            [&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r
            [&:nth-child(4)]:border-r-0
            md:[&:nth-child(4)]:border-r-0
            md:border-r
            md:[&:nth-child(4)]:border-r-0
            group
          "
                >
                  <div className="p-3 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">{feature.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{feature.title}</h3>
                    <p className="text-xs text-gray-500">{feature.desc}</p>
                  </div>
                </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-bold tracking-tight text-gray-900 mb-4 font-display">Our Solutions</h2>
              <p className="text-lg text-gray-500 max-w-2xl">Discover specialized hardware tailored for your business infrastructure needs.</p>
            </div>
            <button
              onClick={() => navigate('PRODUCTS')}
              className="hidden sm:flex text-blue-600 font-semibold hover:text-blue-700 transition-colors items-center gap-2 group"
            >
              View All Categories
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Access Control', icon: 'badge', bg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDkma29YV2mEbYZvXFskhkEhmLZ1-KTbEA7s7AbGIdu8RGinz0YwmsQ3G4Ay8vsGK4ZwNgxzqBc0o4UVU1_wIq1dyY5fCZdHlmAi6ScJCA9hscfPaCZn9fNSl7P9f2qTKdP6K1y-0tngaQn2HO4ePbYmgXxycovuVtzuRB1sIj66t2mAZg-6hcYdoC0bQY5Htg_hPqtf9GDagGQFPJZGMRPy8bktgCPnpL6Iuf9xw2_LDMqHWzGFxWW8xzx2wRKRjxDHxVjJjWiZJ8' },
              { title: 'Communication', icon: 'call', bg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_hnhEWMWJisy59YvYbpVQVo_xMvXEOujtfOmFS2z_gJAMqEarQ7yH3ILrDckD0XIZPgzjE-mfIb15ZY1KRyEYNP7IXg9LyGSl2XUGphpvdgDJm6JJuRtAs27nk49Jc_W9_6eN1zAZV6FaJCOZTKEeCfNB1pa_9Ww3VSri2Fbq_83Nd61dOXVtIjsxNHo5NKirj-BGsS3CF2BT6pgKHor7krnV4IvtyfSnYrL5Pkn2ry1bn7u4p2A_etlYB--2nzL37hHuBGhKPB8' },
              { title: 'Surveillance', icon: 'videocam', bg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYHdynxTP_vdw3uhOJTx7p5s6vIH7Y4F0LSDFPdkXXH-aJemGkMZe6CFau0ny9Dwx6OIffE77OmyrMoFTsvB2GvMbPUc66dnirSbFeXVzeba4KQO-Ub0oRwq8FrQDm9lZqyoRC0kV7WLdidOH4BdWXyxVNY0XC6vb9fKD1V2gCJ0t0vpB6AbJiWEetWspEk6ZOBUy_heugbHltvW8gHQTK9HPOJeFgNDpwkbYFceHeAcclr0fTDpRTlNSFteyDSbh0ZBvJboi_CFY' },
            ].map((cat, idx) => (
              <div key={idx} onClick={() => navigate('PRODUCTS')} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer">
                <div className="aspect-[4/3] w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url('${cat.bg}')` }}></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                    <div className="mb-3 p-2.5 bg-white/20 backdrop-blur-md border border-white/10 rounded-xl w-fit text-white">
                      <span className="material-symbols-outlined">{cat.icon}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 font-display">{cat.title}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-white relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-50/50 skew-x-12 -z-10"></div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold tracking-wider uppercase text-sm">Best Sellers</span>
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 mt-2 font-display">Featured Hardware</h2>
          </div>
          {/*<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">*/}
          {/*  {PRODUCTS.slice(0, 4).map((product) => (*/}
          {/*    <div*/}
          {/*      key={product.id}*/}
          {/*      onClick={() => navigate('PRODUCT_DETAIL', { id: product.id })}*/}
          {/*      className="group flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden cursor-pointer"*/}
          {/*    >*/}
          {/*      <div className="relative aspect-square bg-gray-50 p-8 flex items-center justify-center group-hover:bg-blue-50/30 transition-colors">*/}
          {/*        <div className="relative w-full h-full">*/}
          {/*          <img alt={product.name} className="w-full h-full object-contain mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-500" src={product.image} />*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*      <div className="p-6 flex flex-col flex-grow">*/}
          {/*        <div className="text-xs text-blue-600 font-bold uppercase mb-2">{product.category}</div>*/}
          {/*        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors font-display">{product.name}</h3>*/}
          {/*        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">*/}
          {/*          <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>*/}
          {/*          <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">Add to Cart</button>*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*    </div>*/}
          {/*  ))}*/}
          {/*</div>*/}
        </div>
      </section>
    </>
  );
};

export default HomePage;

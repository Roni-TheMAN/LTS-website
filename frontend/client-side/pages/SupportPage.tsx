import React from 'react';
import { useNavigation } from '../src/NavigationContext.tsx';

const SupportPage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <section className="bg-blue-600 py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-500"></div>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 font-display">How can we help you?</h1>
          <div className="max-w-2xl mx-auto relative">
            <span className="material-symbols-outlined absolute left-4 top-3.5 text-gray-400">search</span>
            <input 
              type="text" 
              placeholder="Search for answers..." 
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-none focus:ring-4 focus:ring-blue-400/30 text-gray-900 shadow-xl"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10 pb-20">
        {/* Contact Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { icon: 'support_agent', title: 'Technical Support', desc: 'Troubleshooting & Setup', action: 'Chat Now' },
            { icon: 'shopping_bag', title: 'Orders & Returns', desc: 'Track, Return, or Exchange', action: 'View Orders' },
            { icon: 'mail', title: 'General Inquiry', desc: 'Product info & Partnership', action: 'Email Us' },
          ].map((card, idx) => (
            <div key={idx} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center text-center hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6">
                <span className="material-symbols-outlined text-3xl">{card.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-gray-500 mb-6">{card.desc}</p>
              <button className="text-blue-600 font-bold hover:underline">{card.action}</button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 font-display">Send us a message</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <input type="text" className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 focus:bg-white focus:border-blue-600 focus:ring-blue-600 transition-colors" placeholder="John" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <input type="text" className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 focus:bg-white focus:border-blue-600 focus:ring-blue-600 transition-colors" placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <input type="email" className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 focus:bg-white focus:border-blue-600 focus:ring-blue-600 transition-colors" placeholder="john@company.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Topic</label>
                <select className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 focus:bg-white focus:border-blue-600 focus:ring-blue-600 transition-colors">
                  <option>Product Support</option>
                  <option>Order Status</option>
                  <option>Returns & Refunds</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Message</label>
                <textarea rows={4} className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 focus:bg-white focus:border-blue-600 focus:ring-blue-600 transition-colors" placeholder="Describe your issue..."></textarea>
              </div>
              <button type="button" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                Send Message
              </button>
            </form>
          </div>

          {/* FAQs */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 font-display">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: "What is your return policy?", a: "We offer a 30-day money-back guarantee on all hardware products. Items must be in original condition with all packaging." },
                { q: "Do you offer technical installation?", a: "Yes, we have a network of certified partners who can assist with on-site installation for enterprise orders." },
                { q: "How do I track my order?", a: "Once your order ships, you will receive a tracking number via email. You can also track it in your account dashboard." },
                { q: "Is international shipping available?", a: "Yes, we ship to over 50 countries. Shipping rates and taxes are calculated at checkout." },
                { q: "What warranty comes with the products?", a: "Most products come with a standard 1-year manufacturer warranty. Extended warranty options are available for purchase." },
              ].map((faq, idx) => (
                <details key={idx} className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-gray-900 hover:text-blue-600 transition-colors">
                    {faq.q}
                    <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-gray-400">expand_more</span>
                  </summary>
                  <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-200/50 pt-4 mt-2 bg-white">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-gray-900 mb-2">Still need help?</h3>
              <p className="text-sm text-gray-600 mb-4">Our support team is available Mon-Fri, 9am - 6pm EST.</p>
              <div className="flex flex-col gap-2">
                <a href="#" className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                  <span className="material-symbols-outlined text-lg">call</span> +1 (800) 555-0123
                </a>
                <a href="#" className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                  <span className="material-symbols-outlined text-lg">mail</span> support@legacytech.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;

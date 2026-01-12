
import React from 'react';
import { useNavigation } from '../src/NavigationContext.tsx';

const TermsOfServicePage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-10 border-b border-gray-100 pb-10">
             <button onClick={() => navigate('HOME')} className="text-sm text-gray-500 hover:text-blue-600 mb-6 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Home
            </button>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 font-display">Terms of Service</h1>
            <p className="text-gray-500">Last updated: October 24, 2023</p>
          </div>

          <div className="prose prose-blue max-w-none text-gray-600 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Agreement to Terms</h2>
              <p>
                By accessing or using the Legacy Tech Solutions website and services, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our website or purchase our products. These terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Use of the Site</h2>
              <p className="mb-2">You may use our site only for lawful purposes and in accordance with these Terms. You agree not to use the site:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>In any way that violates any applicable federal, state, local, or international law or regulation.</li>
                <li>To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail," "chain letter," "spam," or any other similar solicitation.</li>
                <li>To impersonate or attempt to impersonate Legacy Tech Solutions, a Legacy Tech Solutions employee, another user, or any other person or entity.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Intellectual Property Rights</h2>
              <p>
                The Service and its original content, features, and functionality are and will remain the exclusive property of Legacy Tech Solutions and its licensors. Our intellectual property may not be used in connection with any product or service without the prior written consent of Legacy Tech Solutions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Purchase and Payment</h2>
              <p>
                If you wish to purchase any product made available through the Service, you may be asked to supply certain information relevant to your purchase including, without limitation, your credit card number, the expiration date of your credit card, your billing address, and your shipping information.
              </p>
              <p className="mt-2">
                We reserve the right to refuse or cancel your order at any time for reasons including but not limited to: product availability, errors in the description or price of the product, error in your order, or suspected fraud.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Limitation of Liability</h2>
              <p>
                In no event shall Legacy Tech Solutions, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Governing Law</h2>
              <p>
                These Terms shall be governed and construed in accordance with the laws of California, United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="font-bold text-gray-900">Legacy Tech Solutions</p>
                <p>123 Tech Park, Suite 100</p>
                <p>San Francisco, CA 94107</p>
                <p>Email: <a href="mailto:legal@legacytech.com" className="text-blue-600 hover:underline">legal@legacytech.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;

import React from 'react';
import { useNavigation } from '../src/NavigationContext.tsx';

const PrivacyPolicyPage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-10 border-b border-gray-100 pb-10">
             <button onClick={() => navigate('HOME')} className="text-sm text-gray-500 hover:text-blue-600 mb-6 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Home
            </button>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 font-display">Privacy Policy</h1>
            <p className="text-gray-500">Last updated: October 24, 2023</p>
          </div>

          <div className="prose prose-blue max-w-none text-gray-600 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                Legacy Tech Solutions ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, purchase our hardware products, or use our services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
              <p className="mb-2">We collect information that identifies, relates to, describes, references, is capable of being associated with, or could reasonably be linked, directly or indirectly, with a particular consumer or device.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Personal Identification Information:</strong> Name, email address, phone number, shipping address, and billing address.</li>
                <li><strong>Payment Information:</strong> Credit card numbers, billing information (processed securely by third-party payment processors).</li>
                <li><strong>Technical Data:</strong> IP address, browser type, operating system, access times, and referring website addresses.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p className="mb-2">We use the information we collect for various business purposes, including:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Processing and fulfilling your orders.</li>
                <li>Providing customer support and responding to inquiries.</li>
                <li>Sending you administrative information, such as order confirmations and policy updates.</li>
                <li>Improving our website and user experience.</li>
                <li>Detecting and preventing fraud.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Sharing Your Information</h2>
              <p>
                We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Service Providers:</strong> We may share your information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work (e.g., shipping partners, payment processors).</li>
                <li><strong>Legal Obligations:</strong> We may disclose your information where we are legally required to do so in order to comply with applicable law, governmental requests, a judicial proceeding, court order, or legal process.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Security</h2>
              <p>
                We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
              </p>
            </section>

             <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Privacy Rights</h2>
              <p>
                Depending on your location, you may have the right to request access to the personal information we collect from you, change that information, or delete it in some circumstances. To request to review, update, or delete your personal information, please contact us at support@legacytech.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Contact Us</h2>
              <p>
                If you have questions or comments about this Privacy Policy, please contact us at:
              </p>
              <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="font-bold text-gray-900">Legacy Tech Solutions</p>
                <p>123 Tech Park, Suite 100</p>
                <p>San Francisco, CA 94107</p>
                <p>Email: <a href="mailto:privacy@legacytech.com" className="text-blue-600 hover:underline">privacy@legacytech.com</a></p>
                <p>Phone: +1 (800) 555-0123</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;

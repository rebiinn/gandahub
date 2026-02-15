import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const TermsOfService = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8 font-medium"
      >
        <FaArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-2">
        Terms of Service
      </h1>
      <p className="text-gray-500 mb-10">Last updated: February 2025</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
          <p>
            By accessing or using Ganda Hub Cosmetics (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) website and services,
            you agree to be bound by these Terms of Service. If you do not agree, please do not use our site or services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Use of Our Services</h2>
          <p>
            You may use our website to browse products, place orders, create an account, and access customer features.
            You agree to provide accurate information and to use the service only for lawful purposes. You must not
            misuse our site (e.g., attempt to gain unauthorized access, distribute malware, or violate any applicable laws).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
          <p>
            When you create an account, you are responsible for keeping your login details secure. You are responsible
            for all activity under your account. Notify us immediately if you suspect unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Orders and Payment</h2>
          <p>
            All orders are subject to availability and acceptance. We reserve the right to refuse or cancel orders.
            Prices are in Philippine Peso (PHP) and are subject to change. Payment methods include Cash on Delivery (COD)
            and GCash. By placing an order, you agree to pay the total amount due at the time and method specified.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Shipping and Delivery</h2>
          <p>
            Delivery times and fees depend on your location. Risk of loss and title pass to you upon delivery. For
            more details, see our{' '}
            <Link to="/shipping-info" className="text-primary-600 hover:text-primary-700 underline">
              Shipping Info
            </Link>{' '}
            page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Returns and Refunds</h2>
          <p>
            Our return and exchange policy is described in our{' '}
            <Link to="/returns-exchanges" className="text-primary-600 hover:text-primary-700 underline">
              Returns & Exchanges
            </Link>{' '}
            page. By purchasing from us, you agree to that policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
          <p>
            All content on this site (text, images, logos, design) is owned by Ganda Hub or its licensors and is
            protected by copyright and trademark laws. You may not copy, modify, or use our content without written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Ganda Hub shall not be liable for any indirect, incidental, special,
            or consequential damages arising from your use of our site or products. Our total liability shall not exceed
            the amount you paid for the relevant order.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of our services after changes constitutes
            acceptance of the new Terms. We encourage you to review this page periodically.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
          <p>
            For questions about these Terms of Service, contact us at cosmeticsgandahub@gmail.com or visit our{' '}
            <Link to="/" className="text-primary-600 hover:text-primary-700 underline">Contact</Link> section on the homepage.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;

import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const PrivacyPolicy = () => {
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
        Privacy Policy
      </h1>
      <p className="text-gray-500 mb-10">Last updated: February 2025</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p>
            Ganda Hub Cosmetics (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy. This Privacy Policy explains
            how we collect, use, disclose, and safeguard your information when you use our website and services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <p className="mb-3">We may collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> name, email, phone, address when you register or place an order</li>
            <li><strong>Order information:</strong> items purchased, payment method, delivery details</li>
            <li><strong>Usage data:</strong> how you use our site (e.g., pages visited, device type) to improve our service</li>
            <li><strong>Communications:</strong> messages you send to us (e.g., support inquiries)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p>
            We use your information to process orders, fulfill deliveries, communicate with you, improve our website
            and products, send marketing (with your consent), prevent fraud, and comply with legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Sharing of Information</h2>
          <p>
            We may share your information with service providers who help us operate (e.g., payment processors,
            delivery partners). We do not sell your personal data. We may disclose information when required by law
            or to protect our rights and safety.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data. However, no
            method of transmission over the internet is 100% secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Rights</h2>
          <p>
            Depending on applicable law, you may have the right to access, correct, or delete your personal data, or to
            object to or restrict certain processing. To exercise these rights, contact us at cosmeticsgandahub@gmail.com.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to improve your experience, remember your preferences, and analyze
            site traffic. You can adjust your browser settings to refuse cookies, though some features may not work fully.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated policy on this page and
            update the &quot;Last updated&quot; date. We encourage you to review it periodically.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Us</h2>
          <p>
            For privacy-related questions or requests, contact us at cosmeticsgandahub@gmail.com or at our address listed in
            the footer of our website.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

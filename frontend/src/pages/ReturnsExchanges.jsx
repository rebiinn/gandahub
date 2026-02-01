import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const ReturnsExchanges = () => {
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
        Returns & Exchanges
      </h1>
      <p className="text-gray-500 mb-10">Last updated: February 2025</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Our Commitment</h2>
          <p>
            At Ganda Hub, we want you to love your purchase. If you are not satisfied, we offer returns and exchanges
            subject to the conditions below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Eligibility</h2>
          <p className="mb-3">To be eligible for a return or exchange:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Item must be unused, unopened, and in original packaging (with seals intact where applicable)</li>
            <li>Return or exchange must be requested within 7 days of delivery</li>
            <li>Proof of purchase (order number/email) is required</li>
          </ul>
          <p className="mt-3">
            For hygiene and safety reasons, we cannot accept returns on opened cosmetics, skincare, or personal care
            items unless the product is defective or incorrect.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Request a Return or Exchange</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Email us at cosmetics@gandahub.com with your order number and reason for return/exchange</li>
            <li>We will respond with instructions and, if approved, a return authorization</li>
            <li>Pack the item securely and ship it to the address we provide (customer is responsible for return shipping unless the item was defective or wrong)</li>
            <li>Once we receive and inspect the item, we will process your refund or ship the exchange</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Refunds</h2>
          <p>
            Refunds will be issued to the original payment method (or via GCash/bank if applicable) within 5–10 business
            days after we receive the returned item. You will receive an email when the refund is processed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Exchanges</h2>
          <p>
            If you want a different size, shade, or product, request an exchange when you contact us. Exchanges are
            subject to availability. We will ship the replacement once we receive your returned item.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Defective or Wrong Items</h2>
          <p>
            If you received a defective product or the wrong item, contact us immediately with your order number and
            photos if applicable. We will arrange a replacement or full refund at no extra cost to you, including
            return shipping if needed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions?</h2>
          <p>
            For any questions about returns or exchanges, email cosmetics@gandahub.com or call +63 964 988 7606. See
            also our{' '}
            <Link to="/shipping-info" className="text-primary-600 hover:text-primary-700 underline">
              Shipping Info
            </Link>{' '}
            for delivery details.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ReturnsExchanges;

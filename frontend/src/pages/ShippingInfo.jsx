import { Link } from 'react-router-dom';
import { FaArrowLeft, FaTruck, FaMapMarkerAlt, FaClock } from 'react-icons/fa';

const ShippingInfo = () => {
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
        Shipping Information
      </h1>
      <p className="text-gray-500 mb-10">Delivery across the Philippines</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FaTruck className="w-5 h-5 text-primary-600" />
            Coverage
          </h2>
          <p>
            We ship nationwide within the Philippines. Whether you are in Metro Manila, Butuan City, or elsewhere,
            we deliver to your door. Enter your address at checkout to see available options and delivery fees.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FaClock className="w-5 h-5 text-primary-600" />
            Delivery Time
          </h2>
          <p>
            Standard delivery typically takes 3–7 business days depending on your location. Metro Manila and nearby
            areas may receive orders sooner; provincial areas may take up to 7 business days. You will receive
            tracking information once your order is shipped.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Shipping Fees</h2>
          <p>
            Shipping cost is calculated at checkout based on your delivery address and order size. We occasionally
            offer free shipping promotions—check our homepage and newsletter for current deals.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Order Processing</h2>
          <p>
            Orders are processed on business days (Monday–Friday, excluding holidays). Orders placed after cut-off
            may be processed the next business day. You will receive an email confirmation when your order is
            placed and when it has been shipped.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Tracking Your Order</h2>
          <p>
            Use our{' '}
            <Link to="/track-order" className="text-primary-600 hover:text-primary-700 underline">
              Track Order
            </Link>{' '}
            page and enter your order ID and email to see the latest status. You can also view order history in your
            account if you are logged in.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FaMapMarkerAlt className="w-5 h-5 text-primary-600" />
            Delivery Address
          </h2>
          <p>
            Please ensure your shipping address is complete and accurate (street, barangay, city/municipality,
            province, and zip code). Incorrect addresses may delay delivery or result in failed delivery. Someone
            should be available to receive the package, or ensure a safe drop-off location is specified.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Cash on Delivery (COD)</h2>
          <p>
            If you choose COD, please have the exact amount ready when the courier arrives. Our delivery partner will
            collect payment upon delivery. Refusal to pay or inability to receive the package may result in
            return-to-sender and possible restocking fees.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions?</h2>
          <p>
            For shipping-related questions, contact us at cosmeticsgandahub@gmail.com or +63 964 988 7606. You can also
            check our{' '}
            <Link to="/faqs" className="text-primary-600 hover:text-primary-700 underline">
              FAQs
            </Link>{' '}
            or{' '}
            <Link to="/returns-exchanges" className="text-primary-600 hover:text-primary-700 underline">
              Returns & Exchanges
            </Link>{' '}
            for more information.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShippingInfo;

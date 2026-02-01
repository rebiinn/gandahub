import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const faqItems = [
  {
    question: 'How do I place an order?',
    answer: 'Browse our products, add items to your cart, and proceed to checkout. You can pay via Cash on Delivery (COD) or GCash. Once your order is confirmed, you will receive an email with order details.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept Cash on Delivery (COD) and GCash. More payment options may be added in the future. All prices are in Philippine Peso (PHP).',
  },
  {
    question: 'How can I track my order?',
    answer: 'Use our Track Order page and enter your order ID and email. You can also check your order status in your account under "Orders" if you are logged in.',
  },
  {
    question: 'Do you ship nationwide?',
    answer: 'Yes, we deliver across the Philippines. Delivery times and fees vary by location. See our Shipping Info page for details on coverage and estimated delivery times.',
  },
  {
    question: 'Can I return or exchange a product?',
    answer: 'Yes, subject to our Returns & Exchanges policy. Unopened, unused items in original packaging may be returned within a specified period. See our Returns & Exchanges page for full details.',
  },
  {
    question: 'Are your products authentic?',
    answer: 'Yes. Ganda Hub sources only authentic cosmetics and skincare. We work with authorized suppliers and stand behind the quality of every product we sell.',
  },
  {
    question: 'How do I contact customer support?',
    answer: 'Reach us at cosmetics@gandahub.com or call +63 964 988 7606. Our team typically responds within 24–48 hours on business days.',
  },
  {
    question: 'Do you offer discounts or promotions?',
    answer: 'We run seasonal sales and promotions. Subscribe to our newsletter and follow us on social media to stay updated on deals and new arrivals.',
  },
];

const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(null);

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
        Frequently Asked Questions
      </h1>
      <p className="text-gray-600 mb-10">
        Find answers to common questions about orders, shipping, returns, and more.
      </p>

      <div className="space-y-3">
        {faqItems.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>{item.question}</span>
              {openIndex === index ? (
                <FaChevronUp className="w-5 h-5 text-primary-600 flex-shrink-0 ml-2" />
              ) : (
                <FaChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
              )}
            </button>
            {openIndex === index && (
              <div className="px-5 pb-4 pt-0 text-gray-600 border-t border-gray-100">
                <p className="pt-3">{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-10 text-gray-600 text-center">
        Still have questions?{' '}
        <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
          Contact us
        </Link>{' '}
        — we&apos;re happy to help.
      </p>
    </div>
  );
};

export default FAQs;

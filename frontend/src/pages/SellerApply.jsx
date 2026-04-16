import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FaStore, FaEnvelope, FaPhone, FaMapMarkerAlt, FaLock, FaUser, FaFileUpload } from 'react-icons/fa';
import { useState } from 'react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { applicationDocumentsAPI, sellerApplicationsAPI } from '../services/api';

const STAFF_EMAIL_DOMAIN = 'gandahub.com';

const toStaffEmail = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
  return `${localPart}@${STAFF_EMAIL_DOMAIN}`;
};

const SellerApply = () => {
  const navigate = useNavigate();
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm();

  const onSubmit = async (values) => {
    try {
      await sellerApplicationsAPI.submit({
        ...values,
        email: toStaffEmail(values.email_id),
        document_path: uploadedDocument?.path || null,
        document_name: uploadedDocument?.filename || null,
      });
      toast.success('Seller application submitted. Admin will review your request.');
      reset();
      navigate('/login');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to submit application';
      toast.error(message);
    }
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(ext)) {
      toast.error('Allowed files: PDF, DOC, DOCX, JPG, PNG, WEBP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Document size must be 10MB or less.');
      return;
    }
    try {
      setUploadingDocument(true);
      const response = await applicationDocumentsAPI.upload(file);
      setUploadedDocument(response.data?.data || null);
      toast.success('Document uploaded.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploadingDocument(false);
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-100 to-cosmetic-champagne py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <FaStore className="text-primary-600 w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Apply as Seller</h1>
          <p className="text-gray-600 mt-2">
            Submit your seller application. Once approved by admin, your supplier account and store will be created.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Already approved? <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Log in here</Link>.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Store Name"
            icon={FaStore}
            error={errors.store_name?.message}
            {...register('store_name', { required: 'Store name is required' })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              icon={FaUser}
              error={errors.first_name?.message}
              {...register('first_name', { required: 'First name is required' })}
            />
            <Input
              label="Last Name"
              icon={FaUser}
              error={errors.last_name?.message}
              {...register('last_name', { required: 'Last name is required' })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email ID</label>
            <div className="flex items-center rounded-lg border border-gray-300 px-3 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200">
              <FaEnvelope className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="your.store"
                className="w-full py-3 outline-none bg-transparent"
                {...register('email_id', {
                  required: 'Email ID is required',
                  pattern: {
                    value: /^[A-Za-z0-9._%+-]+$/,
                    message: 'Use letters, numbers, dots, underscore, plus, or hyphen only',
                  },
                })}
              />
              <span className="text-sm text-gray-500 ml-2 whitespace-nowrap">@{STAFF_EMAIL_DOMAIN}</span>
            </div>
            {errors.email_id?.message && <p className="mt-1 text-sm text-red-500">{errors.email_id.message}</p>}
          </div>

          <Input
            label="Phone Number"
            icon={FaPhone}
            error={errors.phone?.message}
            {...register('phone', { required: 'Phone number is required' })}
          />

          <Input
            label="Address"
            icon={FaMapMarkerAlt}
            error={errors.address?.message}
            {...register('address', { required: 'Address is required' })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              error={errors.city?.message}
              {...register('city', { required: 'City is required' })}
            />
            <Input label="State/Province" {...register('state')} />
            <Input label="Zip Code" {...register('zip_code')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Why do you want to sell on the platform?</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
              placeholder="Optional short message"
              {...register('message')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supporting Document (Resume/Permit/ID)</label>
            <div className="flex items-center gap-3">
              <label className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 ${uploadingDocument ? 'opacity-60 pointer-events-none' : ''}`}>
                <FaFileUpload />
                {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleDocumentUpload}
                />
              </label>
              {uploadedDocument?.filename && (
                <span className="text-sm text-gray-600 truncate">{uploadedDocument.filename}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Accepted: PDF, DOC, DOCX, JPG, PNG, WEBP (max 10MB)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              icon={FaLock}
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
            />
            <Input
              label="Confirm Password"
              type="password"
              icon={FaLock}
              error={errors.password_confirmation?.message}
              {...register('password_confirmation', {
                required: 'Please confirm your password',
              })}
            />
          </div>

          <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
            Submit Seller Application
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SellerApply;


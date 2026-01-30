import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FaUser, FaLock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      zip_code: user?.zip_code || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch,
    formState: { errors: passwordErrors },
  } = useForm();

  const newPassword = watch('password');

  const onProfileSubmit = async (data) => {
    try {
      setLoading(true);
      await updateProfile(data);
      toast.success('Profile updated successfully');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      setLoading(true);
      await changePassword(data);
      toast.success('Password changed successfully');
      resetPassword();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FaUser },
    { id: 'security', label: 'Security', icon: FaLock },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-display font-bold text-gray-800 mb-8">My Profile</h1>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary-600">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {user?.first_name} {user?.last_name}
                    </h2>
                    <p className="text-gray-600">{user?.email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full capitalize">
                      {user?.role}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    error={profileErrors.first_name?.message}
                    {...registerProfile('first_name', {
                      required: 'First name is required',
                    })}
                  />
                  <Input
                    label="Last Name"
                    error={profileErrors.last_name?.message}
                    {...registerProfile('last_name', {
                      required: 'Last name is required',
                    })}
                  />
                </div>

                <Input
                  label="Phone Number"
                  error={profileErrors.phone?.message}
                  {...registerProfile('phone')}
                />

                <Input
                  label="Address"
                  error={profileErrors.address?.message}
                  {...registerProfile('address')}
                />

                <div className="grid md:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    error={profileErrors.city?.message}
                    {...registerProfile('city')}
                  />
                  <Input
                    label="State/Province"
                    error={profileErrors.state?.message}
                    {...registerProfile('state')}
                  />
                  <Input
                    label="ZIP Code"
                    error={profileErrors.zip_code?.message}
                    {...registerProfile('zip_code')}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="primary" loading={loading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-6 max-w-md">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h2>
                
                <Input
                  label="Current Password"
                  type="password"
                  error={passwordErrors.current_password?.message}
                  {...registerPassword('current_password', {
                    required: 'Current password is required',
                  })}
                />

                <Input
                  label="New Password"
                  type="password"
                  error={passwordErrors.password?.message}
                  {...registerPassword('password', {
                    required: 'New password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  error={passwordErrors.password_confirmation?.message}
                  {...registerPassword('password_confirmation', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === newPassword || 'Passwords do not match',
                  })}
                />

                <Button type="submit" variant="primary" loading={loading}>
                  Change Password
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

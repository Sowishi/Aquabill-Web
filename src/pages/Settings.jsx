import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MdSettings, MdSave, MdLock, MdPhotoCamera, MdPerson } from 'react-icons/md';
import { FaUser } from 'react-icons/fa';

function Settings() {
  const { user, updatePassword, updateProfilePicture } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || null);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.profilePicture || null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.profilePicture) {
      setProfilePicture(user.profilePicture);
      setPreviewUrl(user.profilePicture);
    }
  }, [user]);

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select an image file.');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Image size must be less than 5MB.');
        return;
      }

      setProfilePictureFile(file);
      setErrorMessage('');
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePictureUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    if (!profilePictureFile) {
      setErrorMessage('Please select an image to upload.');
      setLoading(false);
      return;
    }

    try {
      // Create a unique filename
      const fileName = `${user.role}_${user.email}_${Date.now()}.${profilePictureFile.name.split('.').pop()}`;
      const storageRef = ref(storage, `profile-pictures/${fileName}`);
      
      // Upload file
      await uploadBytes(storageRef, profilePictureFile);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update user profile picture
      await updateProfilePicture(downloadURL);
      
      setProfilePicture(downloadURL);
      setProfilePictureFile(null);
      setSuccessMessage('Profile picture updated successfully!');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorMessage('Failed to upload profile picture. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    // Validation
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    try {
      const result = await updatePassword(currentPassword, newPassword);
      
      if (result.success) {
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        setTimeout(() => {
          setPasswordSuccess('');
        }, 3000);
      } else {
        setPasswordError(result.error || 'Failed to change password.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred while changing password.');
    }
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center gap-3">
          <MdSettings className="text-[#006fba] text-3xl" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Settings</h1>
            <p className="text-sm md:text-base text-gray-600">Manage your account settings</p>
          </div>
        </div>
      </div>

      {/* Profile Picture Section */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <MdPhotoCamera className="text-[#006fba] text-xl" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Profile Picture</h2>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleProfilePictureUpload} className="space-y-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Profile Picture Preview */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full overflow-hidden border-4 border-gray-200 flex items-center justify-center bg-gray-100">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Profile" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-4xl md:text-5xl text-gray-400" />
                  )}
                </div>
                {profilePictureFile && (
                  <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2">
                    <MdPhotoCamera className="text-white text-lg" />
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Profile Picture
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
                >
                  Choose Image
                </button>
                {profilePictureFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {profilePictureFile.name}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: JPG, PNG, GIF. Max size: 5MB
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !profilePictureFile}
                className={`text-white font-semibold py-2.5 md:py-3 px-6 md:px-8 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 ${
                  loading || !profilePictureFile ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
                style={{ backgroundColor: '#006fba' }}
              >
                <MdSave className="text-lg" />
                {loading ? 'Uploading...' : 'Upload Profile Picture'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <MdLock className="text-[#006fba] text-xl" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Change Password</h2>
        </div>

        {/* Success/Error Messages */}
        {passwordSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-6">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent text-base"
              placeholder="Enter current password"
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent text-base"
              placeholder="Enter new password"
              required
              minLength={6}
            />
            <p className="mt-2 text-xs text-gray-500">
              Password must be at least 6 characters long.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent text-base"
              placeholder="Confirm new password"
              required
              minLength={6}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="text-white font-semibold py-2.5 md:py-3 px-6 md:px-8 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 hover:opacity-90"
              style={{ backgroundColor: '#006fba' }}
            >
              <MdLock className="text-lg" />
              Change Password
            </button>
          </div>
        </form>
      </div>

      {/* Account Information Section */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <MdPerson className="text-[#006fba] text-xl" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Account Information</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              type="text"
              value={user?.name || ''}
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-base text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-base text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <input
              type="text"
              value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-base text-gray-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;


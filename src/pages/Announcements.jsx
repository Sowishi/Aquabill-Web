import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdAnnouncement, MdSearch } from 'react-icons/md';

function Announcements() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    body: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Fetch announcements from Firestore
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredAnnouncements(announcements);
    } else {
      const filtered = announcements.filter(announcement => {
        const searchLower = searchTerm.toLowerCase();
        return (
          announcement.title?.toLowerCase().includes(searchLower) ||
          announcement.body?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredAnnouncements(filtered);
    }
  }, [searchTerm, announcements]);

  const fetchAnnouncements = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'announcements'));
      const announcementsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by creation date, newest first
      announcementsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAnnouncements(announcementsData);
      setFilteredAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    // Body validation
    if (!formData.body.trim()) {
      newErrors.body = 'Announcement body is required';
    } else if (formData.body.trim().length < 10) {
      newErrors.body = 'Body must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingAnnouncementId(null);
    setFormData({
      title: '',
      body: ''
    });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenEditModal = (announcement) => {
    setIsEditMode(true);
    setEditingAnnouncementId(announcement.id);
    setFormData({
      title: announcement.title,
      body: announcement.body
    });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenDeleteModal = (announcement) => {
    setAnnouncementToDelete(announcement);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'announcements', announcementToDelete.id));
      setSuccessMessage(`Announcement "${announcementToDelete.title}" has been deleted successfully.`);
      setShowSuccessModal(true);
      setShowDeleteModal(false);
      setAnnouncementToDelete(null);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setErrorMessage('Failed to delete announcement. ' + error.message);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        // UPDATE existing announcement
        const announcementRef = doc(db, 'announcements', editingAnnouncementId);
        await updateDoc(announcementRef, {
          title: formData.title.trim(),
          body: formData.body.trim(),
          updatedAt: new Date().toISOString()
        });

        setSuccessMessage('Announcement updated successfully!');
        setShowSuccessModal(true);

        // Reset form
        setFormData({
          title: '',
          body: ''
        });

        // Refresh announcements list
        fetchAnnouncements();

        // Close modal after showing success
        setShowModal(false);
        setIsEditMode(false);
        setEditingAnnouncementId(null);

      } else {
        // CREATE new announcement
        await addDoc(collection(db, 'announcements'), {
          title: formData.title.trim(),
          body: formData.body.trim(),
          createdAt: new Date().toISOString()
        });

        // Send SMS to all users with phone numbers
        try {
          const smsResult = await sendAnnouncementSMS(formData.title.trim(), formData.body.trim());
          if (smsResult.sent > 0) {
            setSuccessMessage(`Announcement created successfully! SMS sent to ${smsResult.sent} user(s).${smsResult.failed > 0 ? ` Failed to send to ${smsResult.failed} user(s).` : ''}`);
          } else {
            setSuccessMessage('Announcement created successfully! (No SMS sent - no users with phone numbers found)');
          }
          setShowSuccessModal(true);
        } catch (smsError) {
          console.error('Error sending SMS:', smsError);
          setSuccessMessage('Announcement created successfully! (SMS sending failed)');
          setShowSuccessModal(true);
        }

        // Reset form
        setFormData({
          title: '',
          body: ''
        });

        // Refresh announcements list
        fetchAnnouncements();

        // Close modal after showing success
        setShowModal(false);
      }

    } catch (error) {
      console.error('Error saving announcement:', error);
      let errorMsg = isEditMode ? 'Failed to update announcement. ' : 'Failed to create announcement. ';
      
      if (error.message) {
        errorMsg += error.message;
      }
      
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to format phone number
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return null;
    let formatted = phoneNumber.trim();
    if (!formatted.startsWith('+')) {
      // If it doesn't start with +, assume it's a local number
      // Remove leading 0 if present and add country code
      if (formatted.startsWith('0')) {
        formatted = '+63' + formatted.substring(1);
      } else if (formatted.length === 10) {
        formatted = '+63' + formatted;
      } else {
        formatted = '+63' + formatted;
      }
    }
    return formatted;
  };

  // Function to send SMS
  const sendSMS = async (phoneNumber, message) => {
    try {
      const smsApiUrl = 'https://sms.iprogtech.com/api/v1/sms_messages';
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      if (!formattedPhone) {
        throw new Error('Invalid phone number');
      }

      const requestBody = {
        api_token: '9d955a7153ec9346cf3027ba86ca3038277a6094',
        phone_number: formattedPhone,
        message: message,
      };

      const response = await fetch(smsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SMS API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  };

  // Function to send announcement via SMS to all users
  const sendAnnouncementSMS = async (title, body) => {
    try {
      // Fetch all users with contact numbers
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const usersWithPhone = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.contactNumber && userData.contactNumber.trim() !== '') {
          usersWithPhone.push({
            id: doc.id,
            fullName: userData.fullName || 'User',
            contactNumber: userData.contactNumber,
          });
        }
      });

      console.log(usersWithPhone);

      if (usersWithPhone.length === 0) {
        console.log('No users with phone numbers found');
        return { sent: 0, failed: 0 };
      }

      // Create SMS message
      const smsMessage = `AquaBill Announcement: ${title}\n\n${body}\n\n- AquaBill Team`;

      // Send SMS to all users
      let sentCount = 0;
      let failedCount = 0;

      for (const user of usersWithPhone) {
        try {
          await sendSMS(user.contactNumber, smsMessage);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send SMS to ${user.fullName} (${user.contactNumber}):`, error);
          failedCount++;
        }
      }

      return { sent: sentCount, failed: failedCount };
    } catch (error) {
      console.error('Error sending announcement SMS:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 mx-4 md:mx-6">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        {/* Success/Error Messages */}
        {successMessage && !showModal && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {successMessage}
          </div>
        )}
        {errorMessage && !showModal && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 text-sm md:text-base">
            {errorMessage}
          </div>
        )}

        {/* Search Bar and Add Button */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 md:px-4 py-2 md:py-3 pl-10 md:pl-12 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Add Button */}
          <button
            onClick={handleOpenCreateModal}
            className="text-white font-semibold py-2 md:py-3 px-4 md:px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 whitespace-nowrap hover:opacity-90"
            style={{ backgroundColor: '#006fba' }}
          >
            <span className="text-xl">+</span>
            <span className="hidden sm:inline">New Announcement</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">All Announcements</h2>
          <p className="text-xs md:text-sm text-gray-500">
            {filteredAnnouncements.length} {filteredAnnouncements.length === 1 ? 'announcement' : 'announcements'}
          </p>
        </div>
      

        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <MdAnnouncement className="text-6xl mb-4 mx-auto" />
            <p className="text-gray-500">No announcements yet</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 font-medium hover:opacity-80 transition"
              style={{ color: '#006fba' }}
            >
              Create your first announcement
            </button>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <MdSearch className="text-6xl mb-4 mx-auto" />
            <p className="text-gray-500">No announcements found matching your search</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 font-medium text-sm md:text-base hover:opacity-80 transition"
              style={{ color: '#006fba' }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
              <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-words">
                      {announcement.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500">
                      📅 {formatDate(announcement.createdAt)}
                      {announcement.updatedAt && announcement.updatedAt !== announcement.createdAt && (
                        <span className="ml-2">(Updated: {formatDate(announcement.updatedAt)})</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(announcement)}
                      disabled={loading}
                      className="hover:opacity-80 transition p-2"
                      style={{ color: '#006fba' }}
                      title="Edit"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(announcement)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-900 p-2"
                      title="Delete"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm md:prose max-w-none">
                  <p className="text-sm md:text-base text-gray-700 whitespace-pre-wrap break-words">
                    {announcement.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  {isEditMode ? 'Edit Announcement' : 'Create New Announcement'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setSuccessMessage('');
                    setErrorMessage('');
                    setIsEditMode(false);
                    setEditingAnnouncementId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  disabled={loading}
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm md:text-base">
                  {successMessage}
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm md:text-base">
                  {errorMessage}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter announcement title"
                  disabled={loading}
                />
                {errors.title && (
                  <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                )}
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="body"
                  value={formData.body}
                  onChange={handleInputChange}
                  rows="8"
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${
                    errors.body ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter announcement details..."
                  disabled={loading}
                />
                {errors.body && (
                  <p className="text-red-500 text-xs mt-1">{errors.body}</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 text-white font-semibold py-2.5 md:py-3 px-4 md:px-6 rounded-lg shadow-md transition-colors duration-200 text-sm md:text-base hover:opacity-90 ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{ backgroundColor: '#006fba' }}
                >
                  {loading 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update Announcement' : 'Create Announcement')
                  }
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setSuccessMessage('');
                    setErrorMessage('');
                    setIsEditMode(false);
                    setEditingAnnouncementId(null);
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 md:py-3 px-4 md:px-6 rounded-lg transition-colors duration-200 text-sm md:text-base"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 mx-auto bg-red-100 rounded-full mb-3 md:mb-4">
                <svg className="h-5 w-5 md:h-6 md:w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-900 text-center mb-2">
                Delete Announcement
              </h3>
              <p className="text-xs md:text-sm text-gray-500 text-center mb-4 md:mb-6">
                Are you sure you want to delete "<span className="font-semibold text-gray-900">{announcementToDelete?.title}</span>"? 
                This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAnnouncementToDelete(null);
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className={`flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
              <p className="text-gray-600 mb-6">{successMessage}</p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage('');
                }}
                className="w-full bg-[#006fba] text-white hover:bg-[#005a9a] font-semibold py-3 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorMessage('');
                }}
                className="w-full bg-red-600 text-white hover:bg-red-700 font-semibold py-3 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Announcements

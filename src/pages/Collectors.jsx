import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { MdPeople, MdSearch, MdFilterList } from 'react-icons/md';

function Collectors() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCollectorId, setEditingCollectorId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collectors, setCollectors] = useState([]);
  const [filteredCollectors, setFilteredCollectors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive, suspended
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    gender: '',
    age: ''
  });
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch collectors from Firestore
  useEffect(() => {
    fetchCollectors();
  }, []);

  // Search and Filter functionality
  useEffect(() => {
    let filtered = collectors;

    // Apply status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(collector => collector.status === 'active');
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(collector => collector.status === 'inactive');
    } else if (filterStatus === 'suspended') {
      filtered = filtered.filter(collector => collector.status === 'suspended');
    }
    // 'all' shows all collectors regardless of status

    // Apply search term
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(collector => {
        const searchLower = searchTerm.toLowerCase();
        return (
          collector.fullName?.toLowerCase().includes(searchLower) ||
          collector.email?.toLowerCase().includes(searchLower) ||
          collector.contactNumber?.includes(searchTerm) ||
          collector.gender?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredCollectors(filtered);
  }, [searchTerm, filterStatus, collectors]);

  const fetchCollectors = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'collector'));
      const querySnapshot = await getDocs(q);
      const collectorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCollectors(collectorsData);
      setFilteredCollectors(collectorsData);
    } catch (error) {
      console.error('Error fetching collectors:', error);
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

    // Full Name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    // Contact Number validation
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^[\d\s\-+()]{10,15}$/.test(formData.contactNumber.trim())) {
      newErrors.contactNumber = 'Invalid contact number';
    }

    // Gender validation
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }

    // Age validation
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (formData.age < 1 || formData.age > 120) {
      newErrors.age = 'Age must be between 1 and 120';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateTemporaryPassword = () => {
    // Generate a 6-digit numeric password (easy to remember and type)
    // Format: XXXXXX (e.g., 123456)
    const password = Math.floor(100000 + Math.random() * 900000).toString();
    return password;
  };

  const sendTemporaryPasswordEmail = async (email, fullName, tempPassword) => {
    try {
      const emailData = {
        to_email: email,
        to_name: fullName,
        temporary_password: tempPassword,
        subject: 'Your AquaBill Collector Account - Temporary Password',
        message: `Hello ${fullName},\n\nYour collector account has been created successfully!\n\nHere are your login credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password as soon as possible.\n\nBest regards,\nAquaBill Team`
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'document_management_syst',
          template_id: 'template_4vig146',
          user_id: 'CC6NDqZK6hJlZZd_X',
          template_params: emailData
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      console.log('Email sent with:', emailData);
      
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, profilePic: 'Please select an image file' }));
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, profilePic: 'Image size should be less than 5MB' }));
        return;
      }
      setProfilePicFile(file);
      setProfilePicPreview(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, profilePic: '' }));
    }
  };

  const uploadProfilePicture = async (file, collectorId) => {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `collector-pics/${collectorId}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  };

  const generateDefaultAvatar = (fullName, gender) => {
    // Use username-based avatar for personalization
    const formattedName = fullName.replace(/\s+/g, '+');
    return `https://avatar.iran.liara.run/username?username=${formattedName}`;
  };

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingCollectorId(null);
    setFormData({
      fullName: '',
      email: '',
      contactNumber: '',
      gender: '',
      age: ''
    });
    setProfilePicFile(null);
    setProfilePicPreview(null);
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenEditModal = (collector) => {
    setIsEditMode(true);
    setEditingCollectorId(collector.id);
    setFormData({
      fullName: collector.fullName,
      email: collector.email,
      contactNumber: collector.contactNumber,
      gender: collector.gender,
      age: collector.age.toString()
    });
    setProfilePicFile(null);
    setProfilePicPreview(collector.profilePicUrl || null);
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleToggleStatus = async (collector) => {
    if (!collector) return;

    setLoading(true);
    try {
      const newStatus = collector.status === 'active' ? 'suspended' : 'active';
      const collectorRef = doc(db, 'users', collector.id);
      await updateDoc(collectorRef, {
        status: newStatus,
        statusUpdatedAt: new Date().toISOString()
      });
      setSuccessMessage(`Collector "${collector.fullName}" status changed to ${newStatus}.`);
      fetchCollectors();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error changing collector status:', error);
      setErrorMessage('Failed to change status. ' + error.message);
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
        // UPDATE existing collector
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formData.email));
        const querySnapshot = await getDocs(q);
        
        // Check if email exists for a different collector
        if (!querySnapshot.empty) {
          const existingCollector = querySnapshot.docs[0];
          if (existingCollector.id !== editingCollectorId) {
            setErrorMessage('This email is already registered to another collector.');
            setLoading(false);
            return;
          }
        }

        // Handle profile picture
        let profilePicUrl = profilePicPreview; // Keep existing if no new upload
        if (profilePicFile) {
          profilePicUrl = await uploadProfilePicture(profilePicFile, editingCollectorId);
        }

        // Update collector data in Firestore
        const collectorRef = doc(db, 'users', editingCollectorId);
        const updateData = {
          fullName: formData.fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          updatedAt: new Date().toISOString()
        };

        if (profilePicUrl) {
          updateData.profilePicUrl = profilePicUrl;
        }

        await updateDoc(collectorRef, updateData);

        setSuccessMessage('Collector updated successfully!');

        // Reset form
        setFormData({
          fullName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: ''
        });
        setProfilePicFile(null);
        setProfilePicPreview(null);

        // Refresh collectors list
        fetchCollectors();

        // Close modal after 3 seconds
        setTimeout(() => {
          setShowModal(false);
          setSuccessMessage('');
          setIsEditMode(false);
          setEditingCollectorId(null);
        }, 3000);

      } else {
        // CREATE new collector
        const tempPassword = generateTemporaryPassword();

        // Check if email already exists in Firestore
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formData.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setErrorMessage('This email is already registered.');
          setLoading(false);
          return;
        }

        // Create collector document first to get the ID
        const newCollectorRef = await addDoc(collection(db, 'users'), {
          fullName: formData.fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          password: tempPassword,
          passwordChanged: false,
          role: 'collector',
          status: 'active',
          createdAt: new Date().toISOString()
        });

        // Handle profile picture
        let profilePicUrl;
        if (profilePicFile) {
          // Upload custom profile picture
          profilePicUrl = await uploadProfilePicture(profilePicFile, newCollectorRef.id);
        } else {
          // Use default avatar from API
          profilePicUrl = generateDefaultAvatar(formData.fullName, formData.gender);
        }

        // Update collector with profile picture URL
        await updateDoc(doc(db, 'users', newCollectorRef.id), {
          profilePicUrl: profilePicUrl
        });

        // Send email with temporary password
        try {
          await sendTemporaryPasswordEmail(
            formData.email,
            formData.fullName,
            tempPassword
          );
          setSuccessMessage(
            `Collector created successfully! An email with the temporary password has been sent to ${formData.email}.`
          );
        } catch (emailError) {
          // Collector created but email failed
          setSuccessMessage(
            `Collector created successfully! However, email sending failed. Please note the temporary password: ${tempPassword}`
          );
        }

        // Reset form
        setFormData({
          fullName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: ''
        });
        setProfilePicFile(null);
        setProfilePicPreview(null);

        // Refresh collectors list
        fetchCollectors();

        setShowModal(false);
        setSuccessMessage('');
      }

    } catch (error) {
      console.error('Error saving collector:', error);
      let errorMsg = isEditMode ? 'Failed to update collector. ' : 'Failed to create collector. ';
      
      if (error.message) {
        errorMsg += error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
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

        {/* Filter, Search Bar and Add Button */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Filter Dropdown */}
          <div className="relative inline-block">
            <div className="flex items-center gap-2">
              <MdFilterList className="text-xl text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 pr-8 rounded-lg text-sm md:text-base font-medium border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:border-transparent transition-colors appearance-none cursor-pointer"
                style={{ minWidth: '180px' }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search collectors..."
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
            <span className="hidden sm:inline">Create New Collector</span>
            <span className="sm:hidden">New Collector</span>
          </button>
        </div>
      </div>

      {/* Collectors List */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">Registered Collectors</h2>
        <p className="text-xs md:text-sm text-gray-500">
          Showing {filteredCollectors.length} of {collectors.length} collectors
        </p>
      </div>
        {collectors.length === 0 ? (
          <div className="text-center py-12">
            <MdPeople className="text-6xl mb-4 mx-auto" />
            <p className="text-gray-500">No collectors registered yet</p>
          </div>
        ) : filteredCollectors.length === 0 ? (
          <div className="text-center py-12">
            <MdSearch className="text-6xl mb-4 mx-auto" />
            <p className="text-gray-500">No collectors found matching your search</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 font-medium text-sm md:text-base hover:opacity-80 transition"
              style={{ color: '#006fba' }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-4">
              {filteredCollectors.map((collector) => (
                <div key={collector.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex gap-3 mb-3">
                    <img 
                      src={collector.profilePicUrl || generateDefaultAvatar(collector.fullName, collector.gender)} 
                      alt={collector.fullName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {collector.fullName}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 truncate">{collector.email}</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                          {collector.role || 'collector'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contact:</span>
                      <span className="text-gray-900">{collector.contactNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        collector.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : collector.status === 'inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {collector.status?.charAt(0).toUpperCase() + collector.status?.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <button
                      onClick={() => handleOpenEditModal(collector)}
                      disabled={loading}
                      className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {collector.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(collector)}
                        disabled={loading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:ring-offset-2 ${
                          collector.status === 'active' ? 'bg-[#006fba]' : 'bg-gray-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        role="switch"
                        aria-checked={collector.status === 'active'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            collector.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg">
              <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCollectors.map((collector) => (
                  <tr key={collector.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img 
                          src={collector.profilePicUrl || generateDefaultAvatar(collector.fullName, collector.gender)} 
                          alt={collector.fullName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {collector.fullName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {collector.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {collector.contactNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {collector.role || 'collector'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        collector.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : collector.status === 'inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {collector.status?.charAt(0).toUpperCase() + collector.status?.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleOpenEditModal(collector)}
                          disabled={loading}
                          className="hover:opacity-80 transition"
                          style={{ backgroundColor: '#006fba', color: 'white', padding: '6px', borderRadius: '6px' }}
                          title="Edit collector"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-2">
                          
                          <button
                            onClick={() => handleToggleStatus(collector)}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:ring-offset-2 ${
                              collector.status === 'active' ? 'bg-[#006fba]' : 'bg-gray-300'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            role="switch"
                            aria-checked={collector.status === 'active'}
                            title={collector.status === 'active' ? 'Click to suspend' : 'Click to activate'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                collector.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

      {/* Create/Edit Collector Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  {isEditMode ? 'Edit Collector' : 'Create New Collector'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setSuccessMessage('');
                    setErrorMessage('');
                    setIsEditMode(false);
                    setEditingCollectorId(null);
                    setProfilePicFile(null);
                    setProfilePicPreview(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  disabled={loading}
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-3 md:space-y-4">
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

              {/* Profile Picture */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  {profilePicPreview ? (
                    <div className="relative">
                      <img 
                        src={profilePicPreview} 
                        alt="Profile preview" 
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePicFile(null);
                          setProfilePicPreview(null);
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        disabled={loading}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <span className="inline-block bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        {profilePicPreview ? 'Change Photo' : 'Upload Photo'}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        className="hidden"
                        disabled={loading}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      {profilePicFile 
                        ? 'Custom photo will be uploaded' 
                        : isEditMode && profilePicPreview
                        ? 'Current profile picture'
                        : 'Default avatar will be used if not uploaded'}
                    </p>
                    {errors.profilePic && (
                      <p className="text-red-500 text-xs mt-1">{errors.profilePic}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.fullName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter full name"
                  disabled={loading}
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter email address"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter contact number"
                  disabled={loading}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
                )}
              </div>

              {/* Gender and Age Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.gender ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                  )}
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.age ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter age"
                    min="1"
                    max="120"
                    disabled={loading}
                  />
                  {errors.age && (
                    <p className="text-red-500 text-xs mt-1">{errors.age}</p>
                  )}
                </div>
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
                    : (isEditMode ? 'Update Collector' : 'Create Collector')
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
                    setEditingCollectorId(null);
                    setProfilePicFile(null);
                    setProfilePicPreview(null);
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

    </div>
  )
}

export default Collectors

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

function Household() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [userToArchive, setUserToArchive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid, archived
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    gender: '',
    age: '',
    meterNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch users from Firestore
  useEffect(() => {
    fetchUsers();
  }, []);

  // Search and Filter functionality
  useEffect(() => {
    let filtered = users;

    // Apply status filter
    if (filterStatus === 'paid') {
      filtered = filtered.filter(user => user.paymentStatus === 'paid');
    } else if (filterStatus === 'unpaid') {
      filtered = filtered.filter(user => user.paymentStatus === 'unpaid');
    } else if (filterStatus === 'archived') {
      filtered = filtered.filter(user => user.isArchived === true);
    } else if (filterStatus === 'all') {
      // Show only non-archived users
      filtered = filtered.filter(user => !user.isArchived);
    }

    // Apply search term
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        return (
          user.fullName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.contactNumber?.includes(searchTerm) ||
          user.meterNumber?.toLowerCase().includes(searchLower) ||
          user.gender?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredUsers(filtered);
  }, [searchTerm, filterStatus, users]);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
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

    // Meter Number validation
    if (!formData.meterNumber.trim()) {
      newErrors.meterNumber = 'Meter number is required';
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
        subject: 'Your AquaBill Account - Temporary Password',
        message: `Hello ${fullName},\n\nYour account has been created successfully!\n\nHere are your login credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password as soon as possible.\n\nBest regards,\nAquaBill Team`
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
      

     
      console.log('Email would be sent with:', emailData);
      

      
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setFormData({
      fullName: '',
      email: '',
      contactNumber: '',
      gender: '',
      age: '',
      meterNumber: ''
    });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenEditModal = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      contactNumber: user.contactNumber,
      gender: user.gender,
      age: user.age.toString(),
      meterNumber: user.meterNumber
    });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenArchiveModal = (user) => {
    setUserToArchive(user);
    setShowArchiveModal(true);
  };

  const handleArchive = async () => {
    if (!userToArchive) return;

    setLoading(true);
    try {
      const userRef = doc(db, 'users', userToArchive.id);
      await updateDoc(userRef, {
        isArchived: true,
        archivedAt: new Date().toISOString()
      });
      setSuccessMessage(`User "${userToArchive.fullName}" has been archived successfully.`);
      setShowArchiveModal(false);
      setUserToArchive(null);
      fetchUsers();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error archiving user:', error);
      setErrorMessage('Failed to archive user. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (user) => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        isArchived: false,
        restoredAt: new Date().toISOString()
      });
      setSuccessMessage(`User "${user.fullName}" has been restored successfully.`);
      fetchUsers();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error restoring user:', error);
      setErrorMessage('Failed to restore user. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentStatus = async (user) => {
    setLoading(true);
    try {
      const newStatus = user.paymentStatus === 'paid' ? 'unpaid' : 'paid';
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        paymentStatus: newStatus,
        paymentStatusUpdatedAt: new Date().toISOString()
      });
      setSuccessMessage(`Payment status updated to "${newStatus}" for ${user.fullName}.`);
      fetchUsers();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error updating payment status:', error);
      setErrorMessage('Failed to update payment status. ' + error.message);
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
        // UPDATE existing user
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formData.email));
        const querySnapshot = await getDocs(q);
        
        // Check if email exists for a different user
        if (!querySnapshot.empty) {
          const existingUser = querySnapshot.docs[0];
          if (existingUser.id !== editingUserId) {
            setErrorMessage('This email is already registered to another user.');
            setLoading(false);
            return;
          }
        }

        // Update user data in Firestore
        const userRef = doc(db, 'users', editingUserId);
        await updateDoc(userRef, {
          fullName: formData.fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          meterNumber: formData.meterNumber,
          updatedAt: new Date().toISOString()
        });

        setSuccessMessage('User updated successfully!');

        // Reset form
        setFormData({
          fullName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: '',
          meterNumber: ''
        });

        // Refresh users list
        fetchUsers();

        // Close modal after 3 seconds
        setTimeout(() => {
          setShowModal(false);
          setSuccessMessage('');
          setIsEditMode(false);
          setEditingUserId(null);
        }, 3000);

      } else {
        // CREATE new user
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

        // Save user data to Firestore
        await addDoc(collection(db, 'users'), {
          fullName: formData.fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          meterNumber: formData.meterNumber,
          temporaryPassword: tempPassword,
          passwordChanged: false,
          role: 'resident',
          paymentStatus: 'unpaid',
          isArchived: false,
          createdAt: new Date().toISOString(),
          status: 'active'
        });

        // Send email with temporary password
        try {
          await sendTemporaryPasswordEmail(
            formData.email,
            formData.fullName,
            tempPassword
          );
          setSuccessMessage(
            `User created successfully! An email with the temporary password has been sent to ${formData.email}. `
          );
        } catch (emailError) {
          // User created but email failed
          setSuccessMessage(
            `User created successfully! However, email sending failed.`
          );
        }

        // Reset form
        setFormData({
          fullName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: '',
          meterNumber: ''
        });

        // Refresh users list
        fetchUsers();

        // Close modal after 5 seconds
        setTimeout(() => {
          setShowModal(false);
          setSuccessMessage('');
        }, 5000);
      }

    } catch (error) {
      console.error('Error saving user:', error);
      let errorMsg = isEditMode ? 'Failed to update user. ' : 'Failed to create user. ';
      
      if (error.message) {
        errorMsg += error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">Household Management</h1>
            <p className="text-sm md:text-base text-gray-600">Manage all registered households and their information</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 md:px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-xl">+</span>
            <span className="hidden sm:inline">Create New User</span>
            <span className="sm:hidden">New User</span>
          </button>
        </div>

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

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Active
          </button>
          <button
            onClick={() => setFilterStatus('paid')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-colors ${
              filterStatus === 'paid'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => setFilterStatus('unpaid')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-colors ${
              filterStatus === 'unpaid'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setFilterStatus('archived')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-colors ${
              filterStatus === 'archived'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Archived
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
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
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">Registered Users</h2>
          <p className="text-xs md:text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
        {users.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏠</div>
            <p className="text-gray-500">No users registered yet</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500">No users found matching your search</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm md:text-base"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className={`border rounded-lg p-4 ${user.isArchived ? 'bg-gray-50' : 'bg-white'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base">
                        {user.fullName}
                        {user.isArchived && (
                          <span className="ml-2 text-xs text-gray-500">(Archived)</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {user.role || 'resident'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contact:</span>
                      <span className="text-gray-900">{user.contactNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Meter #:</span>
                      <span className="text-gray-900">{user.meterNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Payment:</span>
                      <button
                        onClick={() => handleTogglePaymentStatus(user)}
                        disabled={user.isArchived || loading}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        } ${user.isArchived ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {user.paymentStatus === 'paid' ? '✓ Paid' : '⊘ Unpaid'}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    {user.isArchived ? (
                      <button
                        onClick={() => handleRestore(user)}
                        disabled={loading}
                        className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          disabled={loading}
                          className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenArchiveModal(user)}
                          disabled={loading}
                          className="flex-1 bg-gray-50 text-gray-700 hover:bg-gray-100 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meter Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 ${user.isArchived ? 'bg-gray-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.fullName}
                      {user.isArchived && (
                        <span className="ml-2 text-xs text-gray-500">(Archived)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.contactNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.meterNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {user.role || 'resident'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleTogglePaymentStatus(user)}
                        disabled={user.isArchived || loading}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        } ${user.isArchived ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={user.isArchived ? 'Cannot change status for archived users' : 'Click to toggle payment status'}
                      >
                        {user.paymentStatus === 'paid' ? '✓ Paid' : '⊘ Unpaid'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user.isArchived ? (
                        <button
                          onClick={() => handleRestore(user)}
                          disabled={loading}
                          className="text-green-600 hover:text-green-900"
                          title="Restore user"
                        >
                          <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Edit user"
                          >
                            <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenArchiveModal(user)}
                            disabled={loading}
                            className="text-gray-600 hover:text-gray-900"
                            title="Archive user"
                          >
                            <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  {isEditMode ? 'Edit User' : 'Create New User'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setSuccessMessage('');
                    setErrorMessage('');
                    setIsEditMode(false);
                    setEditingUserId(null);
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

              {/* Meter Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="meterNumber"
                  value={formData.meterNumber}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.meterNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter meter number"
                  disabled={loading}
                />
                {errors.meterNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.meterNumber}</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 md:py-3 px-4 md:px-6 rounded-lg shadow-md transition-colors duration-200 text-sm md:text-base ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update User' : 'Create User')
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
                    setEditingUserId(null);
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

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 mx-auto bg-gray-100 rounded-full mb-3 md:mb-4">
                <svg className="h-5 w-5 md:h-6 md:w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-900 text-center mb-2">
                Archive User
              </h3>
              <p className="text-xs md:text-sm text-gray-500 text-center mb-4 md:mb-6">
                Are you sure you want to archive <span className="font-semibold text-gray-900">{userToArchive?.fullName}</span>? 
                You can restore this user later from the Archived filter.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowArchiveModal(false);
                    setUserToArchive(null);
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={loading}
                  className={`flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Household



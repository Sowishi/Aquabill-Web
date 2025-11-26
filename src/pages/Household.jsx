import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { MdHome, MdSearch, MdFilterList, MdReceipt, MdPayment, MdHistory } from 'react-icons/md';

function Household() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [userToArchive, setUserToArchive] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [userForQR, setUserForQR] = useState(null);
  const qrRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid, no billing, archived
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    gender: '',
    age: '',
    meterNumber: '',
    accountNumber: ''
  });
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewBillsDropdown, setViewBillsDropdown] = useState(null); // Track which user's dropdown is open
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedUserForPaymentHistory, setSelectedUserForPaymentHistory] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [paymentHistoryFilterMonth, setPaymentHistoryFilterMonth] = useState('');
  const [paymentHistoryFilterYear, setPaymentHistoryFilterYear] = useState('');
  
  const [showConsumedHistoryModal, setShowConsumedHistoryModal] = useState(false);
  const [selectedUserForConsumedHistory, setSelectedUserForConsumedHistory] = useState(null);
  const [consumedHistory, setConsumedHistory] = useState([]);
  const [loadingConsumedHistory, setLoadingConsumedHistory] = useState(false);
  const [consumedHistoryFilterMonth, setConsumedHistoryFilterMonth] = useState('');
  const [consumedHistoryFilterYear, setConsumedHistoryFilterYear] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside any dropdown
      if (!event.target.closest('.view-bills-dropdown')) {
        setViewBillsDropdown(null);
      }
    };

    if (viewBillsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [viewBillsDropdown]);

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
    } else if (filterStatus === 'no billing') {
      filtered = filtered.filter(user => user.paymentStatus === 'no billing');
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
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'resident'));
      const querySnapshot = await getDocs(q);
      
      // Fetch all billings
      const billingsRef = collection(db, 'billing');
      const billingsSnapshot = await getDocs(billingsRef);
      const allBillings = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Process users and determine payment status from billing
      const usersData = querySnapshot.docs.map(doc => {
        const userData = {
          id: doc.id,
          ...doc.data()
        };

        // Find billings for this user (by userId or meterNumber)
        const userBillings = allBillings.filter(billing => 
          billing.userId === doc.id || 
          billing.meterNumber === userData.meterNumber ||
          billing.householdId === doc.id
        );

        // Determine payment status based on billing
        if (userBillings.length === 0) {
          // No billing found
          userData.paymentStatus = 'no billing';
          userData.readingStatus = 'Not Yet Read';
        } else {
          // Check if there are any unpaid billings
          // Check multiple possible field names for payment status
          const hasUnpaid = userBillings.some(billing => {
            const status = billing.status || billing.paymentStatus || billing.paidStatus;
            const isPaid = billing.paid === true || billing.isPaid === true;
            
            // If status field exists, check it
            if (status) {
              return status.toLowerCase() === 'unpaid' || status.toLowerCase() === 'pending';
            }
            // If paid boolean exists, check if it's false
            if (typeof billing.paid === 'boolean' || typeof billing.isPaid === 'boolean') {
              return !isPaid;
            }
            // Default: if billing exists but no clear status, consider it unpaid
            return true;
          });
          userData.paymentStatus = hasUnpaid ? 'unpaid' : 'paid';
          userData.readingStatus = 'Read';
        }

        return userData;
      });

      // Sort users by createdAt (newest first)
      const sortedUsers = usersData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      setUsers(sortedUsers);
      setFilteredUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for middle name - convert to uppercase and limit to initials only
    if (name === 'middleName') {
      // Remove any non-letter characters and convert to uppercase
      const initialsOnly = value.replace(/[^A-Za-z]/g, '').toUpperCase();
      // Limit to 3 characters (for multiple initials like "J.M.")
      const limitedValue = initialsOnly.slice(0, 3);
      
      setFormData(prev => ({
        ...prev,
        [name]: limitedValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
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

    // First Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    // Last Name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    // Middle Name validation (initials only)
    if (formData.middleName.trim()) {
      const middleNamePattern = /^[A-Z]{1,3}$/;
      if (!middleNamePattern.test(formData.middleName.trim())) {
        newErrors.middleName = 'Middle name should be initials only (1-3 letters)';
      }
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

    // Account Number validation
    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
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

  const sendTemporaryPasswordEmail = async (email, fullName, tempPassword, accountNumber) => {
    try {
      const emailData = {
        to_email: email,
        to_name: fullName,
        temporary_password: tempPassword,
        account_number: accountNumber,
        subject: 'Your AquaBill Account - Temporary Password',
        message: `Hello ${fullName},\n\nYour account has been created successfully!\n\nHere are your login credentials:\nAccount Number: ${accountNumber}\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password as soon as possible.\n\nBest regards,\nAquaBill Team`
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'service_ves7ah7',
          template_id: 'template_cb4upvj',
          user_id: 'pQ5V0cJlxP7v7MH_s',
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

  const uploadProfilePicture = async (file, userId) => {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `profile-pics/${userId}-${Date.now()}.${fileExtension}`;
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

  const generateAccountNumber = async () => {
    try {
      // Get current year
      const currentYear = new Date().getFullYear();
      
      // Fetch all users to find the highest account number for current year
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'resident'));
      const querySnapshot = await getDocs(q);
      
      let maxNumber = 0;
      querySnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.accountNumber) {
          const accountNumber = userData.accountNumber.toString();
          
          // Check if it's in the new format: AB-YYYY-XXX
          const newFormatMatch = accountNumber.match(/^AB-(\d{4})-(\d+)$/);
          if (newFormatMatch) {
            const year = parseInt(newFormatMatch[1], 10);
            const num = parseInt(newFormatMatch[2], 10);
            // Only consider numbers from the current year
            if (year === currentYear && num > maxNumber) {
              maxNumber = num;
            }
          } else {
            // Handle old format: ACC-00001 or legacy formats
            // Extract any trailing number as fallback
            const legacyMatch = accountNumber.match(/(\d+)$/);
            if (legacyMatch) {
              const num = parseInt(legacyMatch[1], 10);
              // Only consider if it's a small number (likely old format)
              // This helps transition from old to new format
              if (num < 1000 && num > maxNumber) {
                maxNumber = num;
              }
            }
          }
        }
      });
      
      // Generate next account number in format: AB-YYYY-001
      const nextNumber = maxNumber + 1;
      return `AB-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating account number:', error);
      // Fallback: use current year with timestamp-based number
      const currentYear = new Date().getFullYear();
      const timestamp = Date.now();
      return `AB-${currentYear}-${String(timestamp).slice(-3)}`;
    }
  };

  const generateMeterNumber = async () => {
    try {
      // Fetch all users to find the highest meter number
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'resident'));
      const querySnapshot = await getDocs(q);
      
      let maxNumber = 0;
      querySnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.meterNumber) {
          // Extract number from meter number (format: M-001 or just number)
          const match = userData.meterNumber.toString().match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        }
      });
      
      // Generate next meter number
      const nextNumber = maxNumber + 1;
      return `M-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating meter number:', error);
      // Fallback: use timestamp-based number
      const timestamp = Date.now();
      return `M-${String(timestamp).slice(-3)}`;
    }
  };

  const handleOpenCreateModal = async () => {
    setIsEditMode(false);
    setEditingUserId(null);
    
    // Auto-generate account number and meter number
    const autoAccountNumber = await generateAccountNumber();
    const autoMeterNumber = await generateMeterNumber();
    
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      gender: '',
      age: '',
      meterNumber: autoMeterNumber,
      accountNumber: autoAccountNumber
    });
    setProfilePicFile(null);
    setProfilePicPreview(null);
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
    setShowModal(true);
  };

  const handleOpenEditModal = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    
    // Split fullName into firstName, middleName, lastName
    // Try to split intelligently - assume format: "FirstName MiddleName LastName" or "FirstName LastName"
    const nameParts = user.fullName ? user.fullName.trim().split(/\s+/) : [];
    let firstName = '';
    let middleName = '';
    let lastName = '';
    
    if (nameParts.length === 1) {
      firstName = nameParts[0];
    } else if (nameParts.length === 2) {
      firstName = nameParts[0];
      lastName = nameParts[1];
    } else if (nameParts.length >= 3) {
      firstName = nameParts[0];
      middleName = nameParts.slice(1, -1).join(' '); // All middle parts
      lastName = nameParts[nameParts.length - 1];
    }
    
    setFormData({
      firstName,
      middleName,
      lastName,
      email: user.email,
      contactNumber: user.contactNumber,
      gender: user.gender,
      age: user.age.toString(),
      meterNumber: user.meterNumber,
      accountNumber: user.accountNumber || ''
    });
    setProfilePicFile(null);
    setProfilePicPreview(user.profilePicUrl || null);
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

  const handleOpenQRModal = (user) => {
    setUserForQR(user);
    setShowQRModal(true);
  };

  const handlePrintQR = () => {
    if (!userForQR || !qrRef.current) return;
    
    const qrContent = qrRef.current.innerHTML;
    
    const printWindow = window.open("", "", "width=800,height=800");
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .account-number {
              margin-top: 20px;
              font-size: 18px;
              font-weight: bold;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${qrContent}
            <div class="account-number">${userForQR.accountNumber || 'N/A'}</div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const handleViewBillsClick = (userId, event) => {
    event.stopPropagation();
    setViewBillsDropdown(viewBillsDropdown === userId ? null : userId);
  };

  const handlePaymentHistory = async (user) => {
    setViewBillsDropdown(null);
    setSelectedUserForPaymentHistory(user);
    setShowPaymentHistoryModal(true);
    setLoadingPaymentHistory(true);
    
    try {
      // Fetch payment history from billing collection
      const billingsRef = collection(db, 'billing');
      const billingsSnapshot = await getDocs(billingsRef);
      const allBillings = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter billings for this user
      const userBillings = allBillings.filter(billing => 
        billing.userId === user.id || 
        billing.meterNumber === user.meterNumber ||
        billing.householdId === user.id
      );

      // Sort by date (newest first)
      const sortedBillings = userBillings.sort((a, b) => {
        const dateA = a.createdAt || a.date || a.billingDate || '';
        const dateB = b.createdAt || b.date || b.billingDate || '';
        return new Date(dateB) - new Date(dateA);
      });

      setPaymentHistory(sortedBillings);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setErrorMessage('Failed to fetch payment history. ' + error.message);
      setPaymentHistory([]);
    } finally {
      setLoadingPaymentHistory(false);
    }
  };

  const handleConsumedHistory = async (user) => {
    setViewBillsDropdown(null);
    setSelectedUserForConsumedHistory(user);
    setShowConsumedHistoryModal(true);
    setLoadingConsumedHistory(true);
    
    try {
      // Fetch consumed history from billing collection
      const billingsRef = collection(db, 'billing');
      const billingsSnapshot = await getDocs(billingsRef);
      const allBillings = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter billings for this user
      const userBillings = allBillings.filter(billing => 
        billing.userId === user.id || 
        billing.meterNumber === user.meterNumber ||
        billing.householdId === user.id
      );

      // Sort by date (newest first)
      const sortedBillings = userBillings.sort((a, b) => {
        const dateA = a.createdAt || a.date || a.billingDate || '';
        const dateB = b.createdAt || b.date || b.billingDate || '';
        return new Date(dateB) - new Date(dateA);
      });

      setConsumedHistory(sortedBillings);
    } catch (error) {
      console.error('Error fetching consumed history:', error);
      setErrorMessage('Failed to fetch consumed history. ' + error.message);
      setConsumedHistory([]);
    } finally {
      setLoadingConsumedHistory(false);
    }
  };

  // Filter payment history by month/year
  const getFilteredPaymentHistory = () => {
    let filtered = paymentHistory;
    
    if (paymentHistoryFilterYear) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
        if (!billingDate) return false;
        const year = new Date(billingDate).getFullYear();
        return year.toString() === paymentHistoryFilterYear;
      });
    }
    
    if (paymentHistoryFilterMonth) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
        if (!billingDate) return false;
        const month = (new Date(billingDate).getMonth() + 1).toString().padStart(2, '0');
        return month === paymentHistoryFilterMonth;
      });
    }
    
    return filtered;
  };

  // Filter consumed history by month/year
  const getFilteredConsumedHistory = () => {
    let filtered = consumedHistory;
    
    if (consumedHistoryFilterYear) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
        if (!billingDate) return false;
        const year = new Date(billingDate).getFullYear();
        return year.toString() === consumedHistoryFilterYear;
      });
    }
    
    if (consumedHistoryFilterMonth) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
        if (!billingDate) return false;
        const month = (new Date(billingDate).getMonth() + 1).toString().padStart(2, '0');
        return month === consumedHistoryFilterMonth;
      });
    }
    
    return filtered;
  };

  // Get unique years from history
  const getAvailableYears = (history) => {
    const years = new Set();
    
    // Populate years from 2025 down to 2020
    for (let year = 2025; year >= 2020; year--) {
      years.add(year.toString());
    }
    
    // Also add years from history data
    history.forEach(billing => {
      const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
      if (billingDate) {
        years.add(new Date(billingDate).getFullYear().toString());
      }
    });
    
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
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

        // Handle profile picture
        let profilePicUrl = profilePicPreview; // Keep existing if no new upload
        if (profilePicFile) {
          profilePicUrl = await uploadProfilePicture(profilePicFile, editingUserId);
        }

        // Concatenate name parts
        const fullName = [
          formData.firstName.trim(),
          formData.middleName.trim(),
          formData.lastName.trim()
        ].filter(part => part.length > 0).join(' ');

        // Update user data in Firestore
        const userRef = doc(db, 'users', editingUserId);
        const updateData = {
          fullName: fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          meterNumber: formData.meterNumber,
          accountNumber: formData.accountNumber,
          updatedAt: new Date().toISOString()
        };

        if (profilePicUrl) {
          updateData.profilePicUrl = profilePicUrl;
        }

        await updateDoc(userRef, updateData);

        setSuccessMessage('User updated successfully!');

        // Reset form
        setFormData({
          firstName: '',
          middleName: '',
          lastName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: '',
          meterNumber: '',
          accountNumber: ''
        });
        setProfilePicFile(null);
        setProfilePicPreview(null);

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

        // Concatenate name parts
        const fullName = [
          formData.firstName.trim(),
          formData.middleName.trim(),
          formData.lastName.trim()
        ].filter(part => part.length > 0).join(' ');

        // Create user document first to get the ID
        const newUserRef = await addDoc(collection(db, 'users'), {
          fullName: fullName,
          email: formData.email,
          contactNumber: formData.contactNumber,
          gender: formData.gender,
          age: parseInt(formData.age),
          meterNumber: formData.meterNumber,
          accountNumber: formData.accountNumber,
          password: tempPassword,
          passwordChanged: false,
          role: 'resident',
          paymentStatus: 'unpaid',
          isArchived: false,
          createdAt: new Date().toISOString(),
          status: 'active'
        });

        // Handle profile picture
        let profilePicUrl;
        if (profilePicFile) {
          // Upload custom profile picture
          profilePicUrl = await uploadProfilePicture(profilePicFile, newUserRef.id);
        } else {
          // Use default avatar from API
          profilePicUrl = generateDefaultAvatar(fullName, formData.gender);
        }

        // Update user with profile picture URL
        await updateDoc(doc(db, 'users', newUserRef.id), {
          profilePicUrl: profilePicUrl
        });

        // Send email with temporary password
        try {
          await sendTemporaryPasswordEmail(
            formData.email,
            fullName,
            tempPassword,
            formData.accountNumber
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
          firstName: '',
          middleName: '',
          lastName: '',
          email: '',
          contactNumber: '',
          gender: '',
          age: '',
          meterNumber: '',
          accountNumber: ''
        });
        setProfilePicFile(null);
        setProfilePicPreview(null);

        // Refresh users list
        fetchUsers();

        setShowModal(false);
        setSuccessMessage('');
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
                <option value="all">All Active</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="no billing">No Billing</option>
                <option value="archived">Archived</option>
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

          {/* Add Button */}
          <button
            onClick={handleOpenCreateModal}
            className="text-white font-semibold py-2 md:py-3 px-4 md:px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 whitespace-nowrap hover:opacity-90"
            style={{ backgroundColor: '#006fba' }}
          >
            <span className="text-xl">+</span>
            <span className="hidden sm:inline">Create New User</span>
            <span className="sm:hidden">New User</span>
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">Registered Accounts</h2>
          <p className="text-xs md:text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
      {users.length === 0 ? (
        <div className="text-center py-12">
          <MdHome className="text-6xl mb-4 mx-auto" />
          <p className="text-gray-500">No users registered yet</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <MdSearch className="text-6xl mb-4 mx-auto" />
          <p className="text-gray-500">No users found matching your search</p>
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
              {filteredUsers.map((user) => (
                <div key={user.id} className={`border rounded-lg p-4 ${user.isArchived ? 'bg-gray-50' : 'bg-white'}`}>
                  <div className="flex gap-3 mb-3">
                    <img 
                      src={user.profilePicUrl || generateDefaultAvatar(user.fullName, user.gender)} 
                      alt={user.fullName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {user.fullName}
                            {user.isArchived && (
                              <span className="ml-2 text-xs text-gray-500">(Archived)</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
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
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account #:</span>
                      <span className="text-gray-900">{user.accountNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Reading:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.readingStatus === 'Read'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.readingStatus || 'Not Yet Read'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Payment:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.paymentStatus === 'paid' ? '✓ Paid' : user.paymentStatus === 'unpaid' ? '⊘ Unpaid' : '⊘ No Billing'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    {user.isArchived ? (
                      <button
                        onClick={() => handleRestore(user)}
                        disabled={loading}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white hover:opacity-80"
                        style={{ backgroundColor: '#006fba' }}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </button>
                    ) : (
                      <>
                        <div className="relative view-bills-dropdown">
                          <button
                            onClick={(e) => handleViewBillsClick(user.id, e)}
                            disabled={loading}
                            className="p-2 rounded transition hover:opacity-80"
                            style={{ backgroundColor: '#006fba' }}
                            title="View Bills"
                          >
                            <MdReceipt className="h-5 w-5 text-white" />
                          </button>
                          {viewBillsDropdown === user.id && (
                            <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50 view-bills-dropdown">
                              <button
                                onClick={() => handlePaymentHistory(user)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <MdPayment className="text-lg" />
                                <span>Payment History</span>
                              </button>
                              <button
                                onClick={() => handleConsumedHistory(user)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <MdHistory className="text-lg" />
                                <span>Consumed History</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          disabled={loading}
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white hover:opacity-80"
                          style={{ backgroundColor: '#006fba' }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenQRModal(user)}
                          disabled={loading}
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white hover:opacity-80"
                          style={{ backgroundColor: '#006fba' }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          QR
                        </button>
                        <button
                          onClick={() => handleOpenArchiveModal(user)}
                          disabled={loading}
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white hover:opacity-80"
                          style={{ backgroundColor: '#006fba' }}
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
                    Meter Number
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Reading Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 ${user.isArchived ? 'bg-gray-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.profilePicUrl || generateDefaultAvatar(user.fullName, user.gender)} 
                          alt={user.fullName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.fullName}
                          </div>
                          {user.isArchived && (
                            <div className="text-xs text-gray-500">(Archived)</div>
                          )}
                        </div>
                      </div>
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
                      {user.accountNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        user.readingStatus === 'Read'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.readingStatus || 'Not Yet Read'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        user.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.paymentStatus === 'paid' ? '✓ Paid' : user.paymentStatus === 'unpaid' ? '⊘ Unpaid' : '⊘ No Billing'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {user.isArchived ? (
                          <button
                            onClick={() => handleRestore(user)}
                            disabled={loading}
                            className="p-2 rounded transition hover:opacity-80"
                            style={{ backgroundColor: '#006fba' }}
                            title="Restore user"
                          >
                            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        ) : (
                          <>
                            <div className="relative view-bills-dropdown">
                              <button
                                onClick={(e) => handleViewBillsClick(user.id, e)}
                                disabled={loading}
                                className="p-2 rounded transition hover:opacity-80"
                                style={{ backgroundColor: '#006fba' }}
                                title="View Bills"
                              >
                                <MdReceipt className="h-5 w-5 text-white" />
                              </button>
                              {viewBillsDropdown === user.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50 view-bills-dropdown">
                                  <button
                                    onClick={() => handlePaymentHistory(user)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <MdPayment className="text-lg" />
                                    <span>Payment History</span>
                                  </button>
                                  <button
                                    onClick={() => handleConsumedHistory(user)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <MdHistory className="text-lg" />
                                    <span>Consumed History</span>
                                  </button>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              disabled={loading}
                              className="p-2 rounded transition hover:opacity-80"
                              style={{ backgroundColor: '#006fba' }}
                              title="Edit user"
                            >
                              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleOpenQRModal(user)}
                              disabled={loading}
                              className="p-2 rounded transition hover:opacity-80"
                              style={{ backgroundColor: '#006fba' }}
                              title="View QR Code"
                            >
                              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleOpenArchiveModal(user)}
                              disabled={loading}
                              className="p-2 rounded transition hover:opacity-80"
                              style={{ backgroundColor: '#006fba' }}
                              title="Archive user"
                            >
                              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
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

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="First name"
                    disabled={loading}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>

                {/* Middle Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Name (Initials Only)
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    maxLength={3}
                    className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.middleName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., J or JM"
                    disabled={loading}
                    style={{ textTransform: 'uppercase' }}
                  />
                  {errors.middleName && (
                    <p className="text-red-500 text-xs mt-1">{errors.middleName}</p>
                  )}
                  {!errors.middleName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Enter initials only (1-3 letters)
                    </p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Last name"
                    disabled={loading}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
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
                  } ${isEditMode ? '' : 'bg-gray-50'}`}
                  placeholder="Enter meter number"
                  disabled={loading || !isEditMode}
                  readOnly={!isEditMode}
                />
                {!isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">
                    Meter number is automatically generated
                  </p>
                )}
                {errors.meterNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.meterNumber}</p>
                )}
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.accountNumber ? 'border-red-500' : 'border-gray-300'
                  } ${isEditMode ? '' : 'bg-gray-50'}`}
                  placeholder="Enter account number"
                  disabled={loading || !isEditMode}
                  readOnly={!isEditMode}
                />
                {!isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">
                    Account number is automatically generated
                  </p>
                )}
                {errors.accountNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>
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

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
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

      {/* Hidden QR Code for Printing */}
      {userForQR && (
        <div ref={qrRef} style={{ display: 'none' }}>
          <QRCodeSVG value={userForQR.id} size={200} />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && userForQR && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))] print:bg-white print:relative print:p-0">
          <div id="qr-printable-area" className="bg-white rounded-xl shadow-2xl max-w-lg w-full print:shadow-none print:max-w-full print:rounded-none">
            <div className="p-6 border-b border-gray-200 print:border-0 print:pb-2">
              <div className="flex justify-between items-center print:justify-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 print:text-center">
                  Household QR Code
                </h2>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setUserForQR(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl print:hidden"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 print:p-6">
              {/* User Info */}
              <div className="text-center mb-6 print:mb-8">
                <div className="flex justify-center mb-4 print:mb-6">
                  <img 
                    src={userForQR.profilePicUrl || generateDefaultAvatar(userForQR.fullName, userForQR.gender)} 
                    alt={userForQR.fullName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 print:w-24 print:h-24"
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1 print:text-2xl print:mb-2">
                  {userForQR.fullName}
                </h3>
                <p className="text-sm text-gray-600 mb-1 print:text-base print:mb-2">
                  Meter #: {userForQR.meterNumber}
                </p>
                <p className="text-xs text-gray-500 print:text-sm">
                  User ID: {userForQR.id}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-6 bg-white p-6 rounded-lg border-2 border-gray-200 print:mb-8 print:p-8 print:border-4">
                <QRCodeSVG 
                  value={userForQR.id}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 print:hidden">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This QR code contains the household ID and can be scanned for quick identification and billing purposes.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                <button
                  onClick={handlePrintQR}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print QR Code
                </button>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setUserForQR(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Close
                </button>
              </div>

              {/* Print-only footer */}
              <div className="hidden print:block text-center mt-8 pt-6 border-t-2 border-gray-300">
                <p className="text-base font-semibold text-gray-700 mb-2">
                  AquaBill Management System
                </p>
                <p className="text-sm text-gray-600">
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </p>
                <p className="text-xs text-gray-500 mt-2 italic">
                  Scan this QR code for household verification and billing
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistoryModal && selectedUserForPaymentHistory && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                    Payment History
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedUserForPaymentHistory.fullName} - Meter #: {selectedUserForPaymentHistory.meterNumber}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPaymentHistoryModal(false);
                    setSelectedUserForPaymentHistory(null);
                    setPaymentHistory([]);
                    setPaymentHistoryFilterMonth('');
                    setPaymentHistoryFilterYear('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Year:</label>
                  <select
                    value={paymentHistoryFilterYear}
                    onChange={(e) => setPaymentHistoryFilterYear(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006fba]"
                  >
                    <option value="">All Years</option>
                    {getAvailableYears(paymentHistory).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Month:</label>
                  <select
                    value={paymentHistoryFilterMonth}
                    onChange={(e) => setPaymentHistoryFilterMonth(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006fba]"
                  >
                    <option value="">All Months</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPaymentHistory ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-gray-500">Loading payment history...</div>
                </div>
              ) : getFilteredPaymentHistory().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MdPayment className="text-6xl text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No payment history found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {paymentHistory.length === 0 
                      ? 'This user has no billing records yet.'
                      : 'No records match the selected filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Billing Period
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Amount
                        </th>
                      
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                          Payment Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getFilteredPaymentHistory().map((billing) => {
                        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
                        const paymentDate = billing.paymentDate || billing.paidAt || '';
                        const status = billing.status || billing.paymentStatus || (billing.paid ? 'paid' : 'unpaid');
                        const amount = billing.amount || billing.totalAmount || billing.billAmount || '0';
                        const consumption = billing.consumption || billing.waterConsumption || billing.consumed || 'N/A';
                        const period = billing.period || billing.billingPeriod || billing.month || 'N/A';

                        return (
                          <tr key={billing.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {billingDate ? new Date(billingDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {period}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₱{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                status.toLowerCase() === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {status.toLowerCase() === 'paid' ? '✓ Paid' : '⊘ Unpaid'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {paymentDate ? new Date(paymentDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowPaymentHistoryModal(false);
                  setSelectedUserForPaymentHistory(null);
                  setPaymentHistory([]);
                  setPaymentHistoryFilterMonth('');
                  setPaymentHistoryFilterYear('');
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consumed History Modal */}
      {showConsumedHistoryModal && selectedUserForConsumedHistory && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                    Consumed History
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedUserForConsumedHistory.fullName} - Meter #: {selectedUserForConsumedHistory.meterNumber}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowConsumedHistoryModal(false);
                    setSelectedUserForConsumedHistory(null);
                    setConsumedHistory([]);
                    setConsumedHistoryFilterMonth('');
                    setConsumedHistoryFilterYear('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Year:</label>
                  <select
                    value={consumedHistoryFilterYear}
                    onChange={(e) => setConsumedHistoryFilterYear(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006fba]"
                  >
                    <option value="">All Years</option>
                    {getAvailableYears(consumedHistory).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Month:</label>
                  <select
                    value={consumedHistoryFilterMonth}
                    onChange={(e) => setConsumedHistoryFilterMonth(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006fba]"
                  >
                    <option value="">All Months</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingConsumedHistory ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-gray-500">Loading consumed history...</div>
                </div>
              ) : getFilteredConsumedHistory().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MdHistory className="text-6xl text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No consumed history found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {consumedHistory.length === 0 
                      ? 'This user has no consumption records yet.'
                      : 'No records match the selected filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Billing Period
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Previous Reading
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Current Reading
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                          Consumption
                        </th>
                       
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getFilteredConsumedHistory().map((billing) => {
                        const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
                        const consumption = billing.consumption || billing.waterConsumption || billing.consumed || '0';
                        const previousReading = billing.previousReading || billing.prevReading || billing.lastReading || 'N/A';
                        const currentReading = billing.currentReading || billing.currReading || billing.newReading || 'N/A';
                        const period = billing.period || billing.billingPeriod || billing.month || 'N/A';
                        const unit = billing.unit || 'cu.m';

                        return (
                          <tr key={billing.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {billingDate ? new Date(billingDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {period}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {previousReading}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {currentReading}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {consumption}
                            </td>
                            
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowConsumedHistoryModal(false);
                  setSelectedUserForConsumedHistory(null);
                  setConsumedHistory([]);
                  setConsumedHistoryFilterMonth('');
                  setConsumedHistoryFilterYear('');
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Household



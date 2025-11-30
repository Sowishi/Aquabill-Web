import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { MdAccountBalance, MdUpload, MdImage, MdSave } from 'react-icons/md';

function Deposit() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    depositDate: '',
    amount: '',
    bankName: '',
    receiptType: '',
    depositSlipFile: null
  });
  const [depositSlipPreview, setDepositSlipPreview] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [viewingImage, setViewingImage] = useState(null);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      setFetchLoading(true);
      const depositsRef = collection(db, 'deposits');
      const depositsQuery = query(depositsRef, orderBy('depositDate', 'desc'));
      const snapshot = await getDocs(depositsQuery);
      
      const depositsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = new Date(a.depositDate || a.createdAt || 0);
        const dateB = new Date(b.depositDate || b.createdAt || 0);
        return dateB - dateA;
      });
      
      setDeposits(depositsData);
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setErrorMessage('Failed to load deposit records.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, depositSlip: 'Please select an image file' }));
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, depositSlip: 'Image size should be less than 5MB' }));
        return;
      }
      setFormData(prev => ({
        ...prev,
        depositSlipFile: file
      }));
      setDepositSlipPreview(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, depositSlip: '' }));
    }
  };

  const uploadDepositSlip = async (file) => {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `deposit-slips/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading deposit slip:', error);
      throw error;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.depositDate) {
      newErrors.depositDate = 'Deposit date is required';
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }
    
    if (!formData.bankName.trim()) {
      newErrors.bankName = 'Bank name is required';
    }
    
    if (!formData.receiptType) {
      newErrors.receiptType = 'Receipt type is required';
    }
    
    if (!formData.depositSlipFile) {
      newErrors.depositSlip = 'Deposit slip image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Upload deposit slip image
      const depositSlipUrl = await uploadDepositSlip(formData.depositSlipFile);

      // Save deposit record to Firestore
      const depositDocRef = await addDoc(collection(db, 'deposits'), {
        depositDate: formData.depositDate,
        amount: parseFloat(formData.amount),
        bankName: formData.bankName,
        receiptType: formData.receiptType,
        depositSlipUrl: depositSlipUrl,
        createdAt: new Date().toISOString()
      });

      // Create admin notification
      const createdBy = user?.role || 'admin';
      const createdByName = user?.name || 'Admin';
      const createdByEmail = user?.email || 'admin@aquabill.com';
      
      await addDoc(collection(db, 'adminNotif'), {
        depositId: depositDocRef.id,
        createdAt: new Date().toISOString(),
        message: `New deposit of ₱${parseFloat(formData.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${formData.bankName} has been recorded${createdBy === 'treasurer' ? ' by Treasurer' : ''}.`,
        status: 'unread',
        title: 'New Deposit Recorded',
        type: 'deposit',
        amount: parseFloat(formData.amount),
        bankName: formData.bankName,
        depositDate: formData.depositDate,
        depositSlipUrl: depositSlipUrl,
        createdBy: createdBy,
        createdByName: createdByName,
        createdByEmail: createdByEmail
      });

      setSuccessMessage('Deposit record added successfully!');
      setShowSuccessModal(true);
      
      // Reset form
      setFormData({
        depositDate: '',
        amount: '',
        bankName: '',
        receiptType: '',
        depositSlipFile: null
      });
      setDepositSlipPreview(null);
      setErrors({});

      // Refresh deposits list
      fetchDeposits();

    } catch (error) {
      console.error('Error adding deposit:', error);
      setErrorMessage('Failed to add deposit record. ' + error.message);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Deposit</h1>
        <p className="text-sm md:text-base text-gray-600">Manage deposit records and upload deposit slips</p>
      </div>

      {/* Deposit Form */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Add New Deposit</h2>

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deposit Date */}
            <div>
              <label htmlFor="depositDate" className="block text-sm font-medium text-gray-700 mb-2">
                Deposit Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="depositDate"
                name="depositDate"
                value={formData.depositDate}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent ${
                  errors.depositDate ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.depositDate && (
                <p className="text-red-500 text-sm mt-1">{errors.depositDate}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  required
                />
              </div>
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Bank Name */}
            <div>
              <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="bankName"
                name="bankName"
                value={formData.bankName}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent ${
                  errors.bankName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter bank name"
                required
              />
              {errors.bankName && (
                <p className="text-red-500 text-sm mt-1">{errors.bankName}</p>
              )}
            </div>

            {/* Type of Receipts */}
            <div>
              <label htmlFor="receiptType" className="block text-sm font-medium text-gray-700 mb-2">
                Type of Receipts <span className="text-red-500">*</span>
              </label>
              <select
                id="receiptType"
                name="receiptType"
                value={formData.receiptType}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent ${
                  errors.receiptType ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select receipt type</option>
                <option value="Receipts from banks">Receipts from banks</option>
                <option value="Receipt from Utility">Receipt from Utility</option>
              </select>
              {errors.receiptType && (
                <p className="text-red-500 text-sm mt-1">{errors.receiptType}</p>
              )}
            </div>
          </div>

          {/* Upload Deposit Slip */}
          <div>
            <label htmlFor="depositSlip" className="block text-sm font-medium text-gray-700 mb-2">
              Upload Deposit Slip (Image) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label
                  htmlFor="depositSlip"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                  style={{ borderColor: errors.depositSlip ? '#ef4444' : '#d1d5db' }}
                >
                  <MdUpload className="text-lg" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    id="depositSlip"
                    name="depositSlip"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
                {formData.depositSlipFile && (
                  <span className="text-sm text-gray-600">{formData.depositSlipFile.name}</span>
                )}
              </div>
              {errors.depositSlip && (
                <p className="text-red-500 text-sm">{errors.depositSlip}</p>
              )}
              {depositSlipPreview && (
                <div className="mt-2">
                  <img
                    src={depositSlipPreview}
                    alt="Deposit slip preview"
                    className="max-w-xs max-h-48 rounded-lg border border-gray-300"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`text-white font-semibold py-2.5 md:py-3 px-6 md:px-8 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
              style={{ backgroundColor: '#006fba' }}
            >
              <MdSave className="text-lg" />
              {loading ? 'Saving...' : 'Save Deposit'}
            </button>
          </div>
        </form>
      </div>

      {/* Deposit Records Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Deposit Records</h2>

        {fetchLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading deposit records...</div>
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No deposit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left" style={{ backgroundColor: '#006fba' }}>
                  <th className="px-4 py-3 text-white font-semibold rounded-tl-lg">Deposit Date</th>
                  <th className="px-4 py-3 text-white font-semibold">Amount</th>
                  <th className="px-4 py-3 text-white font-semibold">Bank Name</th>
                  <th className="px-4 py-3 text-white font-semibold">Receipt Type</th>
                  <th className="px-4 py-3 text-white font-semibold rounded-tr-lg">Deposit Slip</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((deposit, index) => (
                  <tr
                    key={deposit.id}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-gray-700">{formatDate(deposit.depositDate)}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{formatCurrency(deposit.amount)}</td>
                    <td className="px-4 py-3 text-gray-700">{deposit.bankName}</td>
                    <td className="px-4 py-3 text-gray-700">{deposit.receiptType}</td>
                    <td className="px-4 py-3">
                      {deposit.depositSlipUrl ? (
                        <button
                          onClick={() => setViewingImage(deposit.depositSlipUrl)}
                          className="flex items-center gap-2 text-[#006fba] hover:underline"
                        >
                          <MdImage className="text-lg" />
                          <span>View Image</span>
                        </button>
                      ) : (
                        <span className="text-gray-400">No image</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image View Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]"
          onClick={() => setViewingImage(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Deposit Slip</h3>
              <button
                onClick={() => setViewingImage(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <img
                src={viewingImage}
                alt="Deposit slip"
                className="w-full h-auto rounded-lg border border-gray-200"
              />
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewingImage(null)}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                style={{ backgroundColor: '#006fba' }}
              >
                Close
              </button>
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
  );
}

export default Deposit;


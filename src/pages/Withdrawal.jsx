import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { MdRemoveCircle, MdUpload, MdImage, MdSave } from 'react-icons/md';

function Withdrawal() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    withdrawalDate: '',
    amount: '',
    bankName: '',
    receiptType: '',
    withdrawalSlipFile: null
  });
  const [withdrawalSlipPreview, setWithdrawalSlipPreview] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [viewingImage, setViewingImage] = useState(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setFetchLoading(true);
      const withdrawalsRef = collection(db, 'withdrawals');
      const withdrawalsQuery = query(withdrawalsRef, orderBy('withdrawalDate', 'desc'));
      const snapshot = await getDocs(withdrawalsQuery);
      
      const withdrawalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = new Date(a.withdrawalDate || a.createdAt || 0);
        const dateB = new Date(b.withdrawalDate || b.createdAt || 0);
        return dateB - dateA;
      });
      
      setWithdrawals(withdrawalsData);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      setErrorMessage('Failed to load withdrawal records.');
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
        setErrors(prev => ({ ...prev, withdrawalSlip: 'Please select an image file' }));
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, withdrawalSlip: 'Image size should be less than 5MB' }));
        return;
      }
      setFormData(prev => ({
        ...prev,
        withdrawalSlipFile: file
      }));
      setWithdrawalSlipPreview(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, withdrawalSlip: '' }));
    }
  };

  const uploadWithdrawalSlip = async (file) => {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `withdrawal-slips/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading withdrawal slip:', error);
      throw error;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.withdrawalDate) {
      newErrors.withdrawalDate = 'Withdrawal date is required';
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
    
    if (!formData.withdrawalSlipFile) {
      newErrors.withdrawalSlip = 'Withdrawal slip image is required';
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

      // Upload withdrawal slip image
      const withdrawalSlipUrl = await uploadWithdrawalSlip(formData.withdrawalSlipFile);

      // Save withdrawal record to Firestore
      const withdrawalDocRef = await addDoc(collection(db, 'withdrawals'), {
        withdrawalDate: formData.withdrawalDate,
        amount: parseFloat(formData.amount),
        bankName: formData.bankName,
        receiptType: formData.receiptType,
        withdrawalSlipUrl: withdrawalSlipUrl,
        createdAt: new Date().toISOString()
      });

      // Create admin notification
      const createdBy = user?.role || 'admin';
      const createdByName = user?.name || 'Admin';
      const createdByEmail = user?.email || 'admin@aquabill.com';
      
      await addDoc(collection(db, 'adminNotif'), {
        withdrawalId: withdrawalDocRef.id,
        createdAt: new Date().toISOString(),
        message: `New withdrawal of ₱${parseFloat(formData.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${formData.bankName} has been recorded${createdBy === 'treasurer' ? ' by Treasurer' : ''}.`,
        status: 'unread',
        title: 'New Withdrawal Recorded',
        type: 'withdrawal',
        amount: parseFloat(formData.amount),
        bankName: formData.bankName,
        withdrawalDate: formData.withdrawalDate,
        withdrawalSlipUrl: withdrawalSlipUrl,
        createdBy: createdBy,
        createdByName: createdByName,
        createdByEmail: createdByEmail
      });

      setSuccessMessage('Withdrawal record added successfully!');
      setShowSuccessModal(true);
      
      // Reset form
      setFormData({
        withdrawalDate: '',
        amount: '',
        bankName: '',
        receiptType: '',
        withdrawalSlipFile: null
      });
      setWithdrawalSlipPreview(null);
      setErrors({});

      // Refresh withdrawals list
      fetchWithdrawals();

    } catch (error) {
      console.error('Error adding withdrawal:', error);
      setErrorMessage('Failed to add withdrawal record. ' + error.message);
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Withdrawal</h1>
        <p className="text-sm md:text-base text-gray-600">Manage withdrawal records and upload withdrawal slips</p>
      </div>

      {/* Withdrawal Form */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Add New Withdrawal</h2>

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
            {/* Withdrawal Date */}
            <div>
              <label htmlFor="withdrawalDate" className="block text-sm font-medium text-gray-700 mb-2">
                Withdrawal Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="withdrawalDate"
                name="withdrawalDate"
                value={formData.withdrawalDate}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent ${
                  errors.withdrawalDate ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.withdrawalDate && (
                <p className="text-red-500 text-sm mt-1">{errors.withdrawalDate}</p>
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

          {/* Upload Withdrawal Slip */}
          <div>
            <label htmlFor="withdrawalSlip" className="block text-sm font-medium text-gray-700 mb-2">
              Upload Withdrawal Slip (Image) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label
                  htmlFor="withdrawalSlip"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                  style={{ borderColor: errors.withdrawalSlip ? '#ef4444' : '#d1d5db' }}
                >
                  <MdUpload className="text-lg" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    id="withdrawalSlip"
                    name="withdrawalSlip"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
                {formData.withdrawalSlipFile && (
                  <span className="text-sm text-gray-600">{formData.withdrawalSlipFile.name}</span>
                )}
              </div>
              {errors.withdrawalSlip && (
                <p className="text-red-500 text-sm">{errors.withdrawalSlip}</p>
              )}
              {withdrawalSlipPreview && (
                <div className="mt-2">
                  <img
                    src={withdrawalSlipPreview}
                    alt="Withdrawal slip preview"
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
              {loading ? 'Saving...' : 'Save Withdrawal'}
            </button>
          </div>
        </form>
      </div>

      {/* Withdrawal Records Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Withdrawal Records</h2>

        {fetchLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading withdrawal records...</div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No withdrawal records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left" style={{ backgroundColor: '#006fba' }}>
                  <th className="px-4 py-3 text-white font-semibold rounded-tl-lg">Withdrawal Date</th>
                  <th className="px-4 py-3 text-white font-semibold">Amount</th>
                  <th className="px-4 py-3 text-white font-semibold">Bank Name</th>
                  <th className="px-4 py-3 text-white font-semibold">Receipt Type</th>
                  <th className="px-4 py-3 text-white font-semibold rounded-tr-lg">Withdrawal Slip</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal, index) => (
                  <tr
                    key={withdrawal.id}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-gray-700">{formatDate(withdrawal.withdrawalDate)}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{formatCurrency(withdrawal.amount)}</td>
                    <td className="px-4 py-3 text-gray-700">{withdrawal.bankName}</td>
                    <td className="px-4 py-3 text-gray-700">{withdrawal.receiptType}</td>
                    <td className="px-4 py-3">
                      {withdrawal.withdrawalSlipUrl ? (
                        <button
                          onClick={() => setViewingImage(withdrawal.withdrawalSlipUrl)}
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
              <h3 className="text-xl font-bold text-gray-800">Withdrawal Slip</h3>
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
                alt="Withdrawal slip"
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

export default Withdrawal;


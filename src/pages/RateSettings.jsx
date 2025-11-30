import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdSettings, MdSave, MdHistory } from 'react-icons/md';

function RateSettings() {
  const [currentRate, setCurrentRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [settingsDocId, setSettingsDocId] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetchRateSettings();
    fetchRateHistory();
  }, []);

  const fetchRateSettings = async () => {
    setLoading(true);
    try {
      // Check if settings document exists
      const settingsRef = collection(db, 'settings');
      const settingsSnapshot = await getDocs(settingsRef);
      
      if (!settingsSnapshot.empty) {
        // Get the first settings document
        const settingsDoc = settingsSnapshot.docs[0];
        setSettingsDocId(settingsDoc.id);
        const data = settingsDoc.data();
        setCurrentRate(data.waterRate || data.currentWaterRate || '20.00');
      } else {
        // No settings document exists, use default
        setCurrentRate('20.00');
      }
    } catch (error) {
      console.error('Error fetching rate settings:', error);
      setErrorMessage('Failed to load rate settings. ' + error.message);
      setCurrentRate('20.00'); // Default value
    } finally {
      setLoading(false);
    }
  };

  const fetchRateHistory = async () => {
    setHistoryLoading(true);
    try {
      const historyRef = collection(db, 'rateHistory');
      const historyQuery = query(historyRef, orderBy('createdAt', 'desc'));
      const historySnapshot = await getDocs(historyQuery);
      
      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setRateHistory(history);
    } catch (error) {
      console.error('Error fetching rate history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const rateValue = parseFloat(currentRate);
      
      if (isNaN(rateValue) || rateValue < 0) {
        setErrorMessage('Please enter a valid water rate (must be a positive number).');
        setShowErrorModal(true);
        setSaving(false);
        return;
      }

      const previousRate = parseFloat(currentRate);
      const newRate = rateValue.toFixed(2);

      if (settingsDocId) {
        // Update existing settings document
        const settingsRef = doc(db, 'settings', settingsDocId);
        await updateDoc(settingsRef, {
          waterRate: newRate,
          currentWaterRate: newRate,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new settings document
        const settingsRef = collection(db, 'settings');
        const newDoc = await addDoc(settingsRef, {
          waterRate: newRate,
          currentWaterRate: newRate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setSettingsDocId(newDoc.id);
      }

      // Save to rate history
      const historyRef = collection(db, 'rateHistory');
      await addDoc(historyRef, {
        previousRate: previousRate.toFixed(2),
        newRate: newRate,
        createdAt: new Date().toISOString(),
        updatedBy: 'admin' // You can replace this with actual user info if available
      });

      // Refresh rate history
      await fetchRateHistory();

      setSuccessMessage('Water rate updated successfully!');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving rate settings:', error);
      setErrorMessage('Failed to save rate settings. ' + error.message);
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Rate Settings</h1>
        <p className="text-sm md:text-base text-gray-600">Manage water rate settings for billing calculations</p>
      </div>

      {/* Rate Settings Form */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
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

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading rate settings...</div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="waterRate" className="block text-sm font-medium text-gray-700 mb-2">
                Current Water Rate (per m³)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                <input
                  type="number"
                  id="waterRate"
                  value={currentRate}
                  onChange={(e) => setCurrentRate(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent text-base"
                  placeholder="Enter water rate"
                  required
                  disabled={saving}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                This rate will be used for calculating water bills. Enter the rate per cubic meter (m³).
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`text-white font-semibold py-2.5 md:py-3 px-6 md:px-8 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 ${
                  saving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
                style={{ backgroundColor: '#006fba' }}
              >
                <MdSave className="text-lg" />
                {saving ? 'Saving...' : 'Save Rate Settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Rate History Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <MdHistory className="text-[#006fba] text-xl" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Rate History</h2>
        </div>

        {historyLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading rate history...</div>
          </div>
        ) : rateHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No rate history available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left" style={{ backgroundColor: '#006fba' }}>
                  <th className="px-4 py-3 text-white font-semibold">Rate</th>
                  <th className="px-4 py-3 text-white font-semibold rounded-tr-lg">Updated Date</th>
                </tr>
              </thead>
              <tbody>
                {rateHistory.map((history, index) => {
                  const prevRate = parseFloat(history.previousRate || 0);
                  const newRate = parseFloat(history.newRate || 0);
                  const change = newRate - prevRate;
                  const changePercent = prevRate > 0 ? ((change / prevRate) * 100).toFixed(2) : 0;
                  
                  return (
                    <tr 
                      key={history.id} 
                      className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 text-gray-700 font-semibold">₱{newRate.toFixed(2)}</td>
                     
                      <td className="px-4 py-3 text-gray-600">
                        {history.createdAt 
                          ? new Date(history.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            

            
          </div>
        )}
      </div>

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

export default RateSettings;


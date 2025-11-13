import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdEmail, MdSearch, MdSend } from 'react-icons/md';

function BillReminders() {
  const [billings, setBillings] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredBillings, setFilteredBillings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingNotice, setSendingNotice] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterBillings();
  }, [billings, searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Fetch billings
      const billingsRef = collection(db, 'billing');
      const billingsSnapshot = await getDocs(billingsRef);
      const billingsData = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBillings(billingsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMessage('Failed to fetch data. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterBillings = () => {
    let filtered = [...billings];

    // Filter by search term (household name)
    if (searchTerm) {
      filtered = filtered.filter(billing => {
        const user = users.find(u => 
          u.id === billing.userId || 
          u.meterNumber === billing.meterNumber ||
          u.id === billing.householdId
        );
        if (user) {
          return user.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return false;
      });
    }

    setFilteredBillings(filtered);
  };

  const getUserInfo = (billing) => {
    const user = users.find(u => 
      u.id === billing.userId || 
      u.meterNumber === billing.meterNumber ||
      u.id === billing.householdId
    );
    return user || null;
  };

  const handleSendNotice = async (billing) => {
    setSendingNotice(billing.id);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const user = getUserInfo(billing);
      if (!user) {
        setErrorMessage('User information not found for this billing.');
        setSendingNotice(null);
        return;
      }

      // Update billing notice status
      const billingRef = doc(db, 'billing', billing.id);
      await updateDoc(billingRef, {
        noticeSent: true,
        noticeSentAt: new Date().toISOString()
      });

      // Create notification
      const amount = billing.amount || billing.totalAmount || billing.billAmount || 0;
      const period = billing.period || billing.billingPeriod || billing.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      
      const notificationData = {
        billId: billing.id,
        createdAt: new Date().toISOString(),
        message: `Your bill reminder for ₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${period} is due. Please make your payment.`,
        paymentId: billing.id, // Using billId as paymentId for bill reminders
        status: 'unread',
        title: 'Bill Reminder',
        type: 'bill_reminder',
        userEmail: user.email || '',
        userId: user.id || '',
        userName: user.fullName || ''
      };

      await addDoc(collection(db, 'notifications'), notificationData);

      // Update local state
      setBillings(prevBillings =>
        prevBillings.map(b =>
          b.id === billing.id
            ? { ...b, noticeSent: true, noticeSentAt: new Date().toISOString() }
            : b
        )
      );

      setSuccessMessage(`Notice sent successfully to ${user.fullName}.`);
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error sending notice:', error);
      setErrorMessage('Failed to send notice. ' + error.message);
    } finally {
      setSendingNotice(null);
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

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Header with Search and Send Notice Button */}
 
      {/* Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading bill reminders...</div>
          </div>
        ) : filteredBillings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MdEmail className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No billing records found</p>
            <p className="text-gray-400 text-sm mt-2">
              {billings.length === 0 
                ? 'No billing data available yet.'
                : 'No records match your search.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg">
              <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                    Household Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Reading Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Notice Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBillings.map((billing) => {
                  const user = getUserInfo(billing);
                  const readingDate = billing.readingDate || billing.createdAt || billing.date || billing.billingDate || '';
                  const dueDate = billing.dueDate || billing.paymentDueDate || '';
                  const noticeSent = billing.noticeSent || false;

                  return (
                    <tr key={billing.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user?.fullName || 'Unknown Household'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user?.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(readingDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          noticeSent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {noticeSent ? '✓ Sent' : '⊘ Not Sent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleSendNotice(billing)}
                          disabled={sendingNotice === billing.id || noticeSent}
                          className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                            noticeSent
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : sendingNotice === billing.id
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'text-white hover:opacity-90'
                          }`}
                          style={!noticeSent && sendingNotice !== billing.id ? { backgroundColor: '#006fba' } : {}}
                          title={noticeSent ? 'Notice already sent' : 'Send notice'}
                        >
                          <MdSend className="text-sm" />
                          {sendingNotice === billing.id ? 'Sending...' : noticeSent ? 'Sent' : 'Send Notice'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default BillReminders;


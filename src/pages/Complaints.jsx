import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdReportProblem } from 'react-icons/md';
import Pagination from '../components/Pagination';

function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch complaints and users from Firebase
  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      // Fetch users to get account details
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Fetch complaints
      const complaintsRef = collection(db, 'complaints');
      const complaintsSnapshot = await getDocs(complaintsRef);
      const complaintsData = await Promise.all(
        complaintsSnapshot.docs.map(async (complaintDoc) => {
          const data = complaintDoc.data();
          
          // Extract userId - handle both string and document reference
          let userId = '';
          if (data.userId) {
            // If userId is a document reference, extract the ID
            if (typeof data.userId === 'object' && data.userId.id) {
              userId = data.userId.id;
            } else if (typeof data.userId === 'string') {
              userId = data.userId;
            }
          }
          
          // Always fetch user document from users collection to get account number
          let user = null;
          
          // Try to find user by userId first
          if (userId) {
            try {
              // First try to find in pre-fetched users
              user = usersData.find(u => u.id === userId);
              
              // If not found, fetch directly from Firestore
              if (!user) {
                const userDocRef = doc(db, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  user = {
                    id: userDocSnap.id,
                    ...userDocSnap.data()
                  };
                }
              }
            } catch (error) {
              console.error(`Error fetching user ${userId} for complaint ${complaintDoc.id}:`, error);
            }
          }
          
          // Fallback: If user not found by userId, try to find by email
          if (!user && data.userEmail) {
            try {
              user = usersData.find(u => u.email === data.userEmail || u.email?.toLowerCase() === data.userEmail?.toLowerCase());
              
              // If still not found in pre-fetched, we could query by email, but for now just use pre-fetched
            } catch (error) {
              console.error(`Error finding user by email ${data.userEmail} for complaint ${complaintDoc.id}:`, error);
            }
          }
          
          // Generate complaint ID from document ID
          const complaintId = `DAM-${String(complaintDoc.id).substring(0, 8).toUpperCase()}`;
          
          return {
            id: complaintDoc.id,
            complaintId: complaintId,
            customerName: data.userName || user?.fullName || user?.name || 'Unknown',
            accountNumber: user?.accountNumber || 'N/A',
            meterNumber: user?.meterNumber || 'N/A',
            contactNumber: user?.contactNumber || data.userEmail || 'N/A',
            userEmail: data.userEmail || user?.email || '',
            userId: userId,
            complaintType: data.complaintType || 'General',
            description: data.description || '',
            imageUrl: data.imageUrl || data.image || data.photoUrl || null,
            submittedDate: data.createdAt || new Date().toISOString(),
            resolvedDate: data.resolvedDate || null,
            notes: data.notes || ''
          };
        })
      );

      // Sort by date (newest first)
      const sortedComplaints = complaintsData.sort((a, b) => {
        const dateA = new Date(a.submittedDate).getTime();
        const dateB = new Date(b.submittedDate).getTime();
        return dateB - dateA;
      });

      setComplaints(sortedComplaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentComplaints = complaints.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(complaints.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 md:space-y-6 mx-4 md:mx-6">
      {/* Complaints Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
            <MdReportProblem className="text-2xl" style={{ color: '#006fba' }} />
            Damage Reports
          </h2>
          <p className="text-xs md:text-sm text-gray-500">
            Total: {complaints.length} complaints
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading complaints...</div>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12">
            <MdReportProblem className="text-6xl text-gray-300 mb-4 mx-auto" />
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg">
              <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Date of Report
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                    Damage ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Account #
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Picture
                  </th>
                
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentComplaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.submittedDate ? new Date(complaint.submittedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {complaint.complaintId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{complaint.customerName}</div>
                      <div className="text-sm text-gray-500">{complaint.contactNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{complaint.accountNumber}</div>
                      <div className="text-xs text-gray-400">{complaint.meterNumber}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate" title={complaint.description}>
                        {complaint.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {complaint.imageUrl ? (
                        <div className="flex items-center">
                          <img 
                            src={complaint.imageUrl} 
                            alt="Problem picture" 
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => window.open(complaint.imageUrl, '_blank')}
                            title="Click to view full size"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No image</span>
                      )}
                    </td>
            
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedComplaint(complaint);
                          setShowModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#006fba' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {complaints.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                totalItems={complaints.length}
              />
            )}
          </div>
        )}
      </div>

      {/* Complaint Details Modal */}
      {showModal && selectedComplaint && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  Complaint Details
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedComplaint(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Full Screen Image */}
              {selectedComplaint.imageUrl ? (
                <div className="mb-6">
                  <img 
                    src={selectedComplaint.imageUrl} 
                    alt="Problem picture" 
                    className="w-full h-auto max-h-[500px] object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                </div>
              ) : (
                <div className="mb-6 bg-gray-100 rounded-lg border border-gray-200 p-12 text-center">
                  <MdReportProblem className="text-6xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No image available</p>
                </div>
              )}

              {/* Complaint Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Complaint ID
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.complaintId}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Submitted Date
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.submittedDate ? new Date(selectedComplaint.submittedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.customerName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.contactNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.accountNumber}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meter Number
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {selectedComplaint.meterNumber}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {selectedComplaint.userEmail || 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg min-h-[80px] whitespace-pre-wrap">
                    {selectedComplaint.description || 'No description provided'}
                  </p>
                </div>

                {selectedComplaint.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg min-h-[60px] whitespace-pre-wrap">
                      {selectedComplaint.notes}
                    </p>
                  </div>
                )}

                {selectedComplaint.resolvedDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resolved Date
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {new Date(selectedComplaint.resolvedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedComplaint(null);
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
  );
}

export default Complaints;


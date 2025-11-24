import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdReportProblem } from 'react-icons/md';

function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const complaintsData = complaintsSnapshot.docs.map(doc => {
        const data = doc.data();
        // Find user details
        const user = usersData.find(u => u.id === data.userId);
        
        // Generate complaint ID from document ID
        const complaintId = `COMP-${String(doc.id).substring(0, 8).toUpperCase()}`;
        
        return {
          id: doc.id,
          complaintId: complaintId,
          customerName: data.userName || 'Unknown',
          accountNumber: user?.accountNumber || 'N/A',
          meterNumber: user?.meterNumber || 'N/A',
          contactNumber: user?.contactNumber || data.userEmail || 'N/A',
          userEmail: data.userEmail || '',
          userId: data.userId || '',
          complaintType: data.complaintType || 'General',
          description: data.description || '',
          submittedDate: data.createdAt || new Date().toISOString(),
          resolvedDate: data.resolvedDate || null,
          notes: data.notes || ''
        };
      });

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


  return (
    <div className="space-y-4 md:space-y-6 mx-4 md:mx-6">
      {/* Complaints Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
            <MdReportProblem className="text-2xl" style={{ color: '#006fba' }} />
            Customer Complaints
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
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                    Complaint ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Account #
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.complaintType}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate" title={complaint.description}>
                        {complaint.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.submittedDate ? new Date(complaint.submittedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Complaints;


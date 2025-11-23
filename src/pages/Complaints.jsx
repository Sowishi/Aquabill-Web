import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdReportProblem, MdSearch, MdFilterList } from 'react-icons/md';

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
          status: data.status || 'pending',
          priority: data.priority || 'Medium',
          submittedDate: data.createdAt || new Date().toISOString(),
          resolvedDate: data.resolvedDate || null,
          assignedTo: data.assignedTo || 'Unassigned',
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

  const [filteredComplaints, setFilteredComplaints] = useState(complaints);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Filter complaints
  useEffect(() => {
    let filtered = complaints;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(complaint => {
        const complaintStatus = complaint.status.toLowerCase();
        const filterStatusLower = filterStatus.toLowerCase();
        // Map "pending" to "open" for filtering if needed
        if (filterStatusLower === 'open' && complaintStatus === 'pending') {
          return true;
        }
        return complaintStatus === filterStatusLower;
      });
    }

    // Apply priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(complaint => complaint.priority.toLowerCase() === filterPriority.toLowerCase());
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(complaint => {
        const complaintTypeLower = complaint.complaintType.toLowerCase().replace(/\s+/g, '');
        const filterTypeLower = filterType.toLowerCase().replace(/\s+/g, '');
        return complaintTypeLower === filterTypeLower;
      });
    }

    // Apply search term
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(complaint => {
        return (
          complaint.complaintId?.toLowerCase().includes(searchLower) ||
          complaint.customerName?.toLowerCase().includes(searchLower) ||
          complaint.accountNumber?.toLowerCase().includes(searchLower) ||
          complaint.meterNumber?.toLowerCase().includes(searchLower) ||
          complaint.contactNumber?.includes(searchTerm) ||
          complaint.complaintType?.toLowerCase().includes(searchLower) ||
          complaint.description?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredComplaints(filtered);
  }, [searchTerm, filterStatus, filterPriority, filterType, complaints]);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'open':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in progress':
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 mx-4 md:mx-6">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        {/* Filter, Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Status Filter */}
          <div className="relative inline-block">
            <div className="flex items-center gap-2">
              <MdFilterList className="text-xl text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 pr-8 rounded-lg text-sm md:text-base font-medium border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:border-transparent transition-colors appearance-none cursor-pointer"
                style={{ minWidth: '150px' }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="open">Open</option>
                <option value="in progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Priority Filter */}
          <div className="relative inline-block">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 pr-8 rounded-lg text-sm md:text-base font-medium border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:border-transparent transition-colors appearance-none cursor-pointer"
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative inline-block">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 pr-8 rounded-lg text-sm md:text-base font-medium border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006fba] focus:border-transparent transition-colors appearance-none cursor-pointer"
              style={{ minWidth: '180px' }}
            >
              <option value="all">All Types</option>
              <option value="billing issue">Billing Issue</option>
              <option value="water quality">Water Quality</option>
              <option value="service interruption">Service Interruption</option>
              <option value="meter reading">Meter Reading</option>
              <option value="payment issue">Payment Issue</option>
              <option value="water pressure">Water Pressure</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search complaints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 md:px-4 py-2 md:py-3 pl-10 md:pl-12 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent"
            />
            <MdSearch
              className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400"
            />
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
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
            <MdReportProblem className="text-2xl" style={{ color: '#006fba' }} />
            Customer Complaints
          </h2>
          <p className="text-xs md:text-sm text-gray-500">
            Showing {filteredComplaints.length} of {complaints.length} complaints
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading complaints...</div>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-12">
            <MdReportProblem className="text-6xl text-gray-300 mb-4 mx-auto" />
            <p className="text-gray-500">No complaints found matching your criteria</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
                setFilterPriority('all');
                setFilterType('all');
              }}
              className="mt-4 font-medium text-sm md:text-base hover:opacity-80 transition"
              style={{ color: '#006fba' }}
            >
              Clear filters
            </button>
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
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Assigned To
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredComplaints.map((complaint) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                        {complaint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(complaint.priority)}`}>
                        {complaint.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.submittedDate ? new Date(complaint.submittedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.assignedTo}
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


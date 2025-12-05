import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdAssessment, MdSearch, MdFilterList } from 'react-icons/md';
import Pagination from '../components/Pagination';

function Reports() {
  const [billings, setBillings] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredBillings, setFilteredBillings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterBillings();
    setCurrentPage(1); // Reset to first page when filters change
  }, [billings, searchTerm, filterYear, filterMonth]);

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
    } finally {
      setLoading(false);
    }
  };

  const filterBillings = () => {
    let filtered = [...billings];

    // Filter by search term (user name)
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

    // Filter by year
    if (filterYear) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
        if (billingDate) {
          const year = new Date(billingDate).getFullYear().toString();
          return year === filterYear;
        }
        return false;
      });
    }

    // Filter by month
    if (filterMonth) {
      filtered = filtered.filter(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
        if (billingDate) {
          const month = String(new Date(billingDate).getMonth() + 1).padStart(2, '0');
          return month === filterMonth;
        }
        return false;
      });
    }

    // Only show paid billings
    filtered = filtered.filter(billing => {
      const status = billing.status || billing.paymentStatus || (billing.paid ? 'paid' : 'unpaid');
      return status.toLowerCase() === 'paid';
    });

    setFilteredBillings(filtered);
  };

  const getTotalCollected = () => {
    return filteredBillings.reduce((total, billing) => {
      const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
      return total + amount;
    }, 0);
  };

  const getAvailableYears = () => {
    const years = new Set();
    
  
    
    // Also add years from billings data
    billings.forEach(billing => {
      const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
      if (billingDate) {
        const year = new Date(billingDate).getFullYear().toString();
        years.add(year);
      }
    });
    
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  };

  const getUserName = (billing) => {
    const user = users.find(u => 
      u.id === billing.userId || 
      u.meterNumber === billing.meterNumber ||
      u.id === billing.householdId
    );
    return user?.fullName || 'Unknown User';
  };

  const getUserMeterNumber = (billing) => {
    const user = users.find(u => 
      u.id === billing.userId || 
      u.meterNumber === billing.meterNumber ||
      u.id === billing.householdId
    );
    return user?.meterNumber || billing.meterNumber || 'N/A';
  };

  const getFilterPeriod = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (filterMonth && filterYear) {
      const monthIndex = parseInt(filterMonth) - 1;
      return `${monthNames[monthIndex]} ${filterYear}`;
    } else if (filterYear) {
      return filterYear;
    } else if (filterMonth) {
      const monthIndex = parseInt(filterMonth) - 1;
      return monthNames[monthIndex];
    }
    return null;
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBillings = filteredBillings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBillings.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Search and Filters Container */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6">Reports Summary</h1>
        
        {/* Search and Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search by User Name */}
          <div className="md:col-span-4">
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by user name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006fba]"
              />
            </div>
          </div>

          {/* Filter by Year */}
          <div className="md:col-span-4">
            <div className="relative">
              <MdFilterList className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006fba] appearance-none bg-white"
              >
                <option value="">All Years</option>
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter by Month */}
          <div className="md:col-span-4">
            <div className="relative">
              <MdFilterList className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006fba] appearance-none bg-white"
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
      </div>

      {/* Total Collected Overall Container */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="p-4 rounded-lg">
          <div className="flex items-center justify-center text-center">
            <div>
           
              <p className="text-black text-2xl md:text-3xl font-bold mt-1">
                ₱{getTotalCollected().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-black text-sm md:text-base opacity-90">
                Total Collected Overall{getFilterPeriod() ? ` (${getFilterPeriod()})` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading reports...</div>
          </div>
        ) : filteredBillings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MdAssessment className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No billing records found</p>
            <p className="text-gray-400 text-sm mt-2">
              {billings.length === 0 
                ? 'No billing data available yet.'
                : 'No records match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg">
              <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                   Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Meter Number
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Payment Mode
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                    Billing Period
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentBillings.map((billing) => {
                  const billingDate = billing.createdAt || billing.date || billing.billingDate || '';
                  const paymentDate = billing.paymentDate || billing.paidAt || billingDate;
                  const amount = billing.amount || billing.totalAmount || billing.billAmount || '0';
                  const period = billing.period || billing.billingPeriod || billing.month || 'N/A';
                  const paymentMode = billing.paymentMode || billing.mode || billing.paymentMethod || 'Cash';

                  return (
                    <tr key={billing.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getUserName(billing)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getUserMeterNumber(billing)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {paymentMode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₱{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {paymentDate ? new Date(paymentDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {period}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredBillings.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                totalItems={filteredBillings.length}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;

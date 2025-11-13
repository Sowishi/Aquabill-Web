import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdHome, MdPeople, MdAnnouncement, MdCheck, MdCancel, MdArchive, MdBlock } from 'react-icons/md';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalHouseholds: 0,
    paidHouseholds: 0,
    unpaidHouseholds: 0,
    archivedHouseholds: 0,
    totalCollectors: 0,
    activeCollectors: 0,
    inactiveCollectors: 0,
    suspendedCollectors: 0,
    totalAnnouncements: 0,
    totalCollected: 0,
    currentWaterRate: 20.00,
    totalBills: 0
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [monthlyCollections, setMonthlyCollections] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch users/households data (only residents, not collectors)
      const usersRef = collection(db, 'users');
      const householdsQuery = query(usersRef, where('role', '==', 'resident'));
      const usersSnapshot = await getDocs(householdsQuery);
      const users = usersSnapshot.docs.map(doc => doc.data());
      
      const totalHouseholds = users.length;
      const paidHouseholds = users.filter(u => u.paymentStatus === 'paid' && !u.isArchived).length;
      const unpaidHouseholds = users.filter(u => u.paymentStatus === 'unpaid' && !u.isArchived).length;
      const archivedHouseholds = users.filter(u => u.isArchived === true).length;

      // Fetch collectors data
      const collectorsRef = collection(db, 'users');
      const collectorsQuery = query(collectorsRef, where('role', '==', 'collector'));
      const collectorsSnapshot = await getDocs(collectorsQuery);
      const collectors = collectorsSnapshot.docs.map(doc => doc.data());
      
      const totalCollectors = collectors.length;
      const activeCollectors = collectors.filter(c => c.status === 'active').length;
      const inactiveCollectors = collectors.filter(c => c.status === 'inactive').length;
      const suspendedCollectors = collectors.filter(c => c.status === 'suspended').length;

      // Fetch announcements data
      const announcementsSnapshot = await getDocs(collection(db, 'announcements'));
      const announcements = announcementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort announcements by date, newest first, and get top 3
      const sortedAnnouncements = announcements
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);

      // Fetch billing data
      const billingsSnapshot = await getDocs(collection(db, 'billing'));
      const billings = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate total collected (only paid billings)
      const paidBillings = billings.filter(billing => {
        const status = billing.status || billing.paymentStatus || (billing.paid ? 'paid' : 'unpaid');
        return status.toLowerCase() === 'paid';
      });

      const totalCollected = paidBillings.reduce((total, billing) => {
        const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
        return total + amount;
      }, 0);

      // Calculate monthly collections
      const monthlyData = {};
      paidBillings.forEach(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
        if (billingDate) {
          const date = new Date(billingDate);
          const monthKey = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
        }
      });

      // Convert to array and sort by date
      const monthlyCollectionsArray = Object.entries(monthlyData)
        .map(([month, total]) => {
          // Parse month string like "November 2025" to Date
          const [monthName, year] = month.split(' ');
          const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
          const date = new Date(parseInt(year), monthIndex, 1);
          return {
            month,
            total,
            date
          };
        })
        .sort((a, b) => a.date - b.date)
        .map(({ month, total }) => ({ month, total }))
        .slice(-12); // Get last 12 months

      setStats({
        totalHouseholds,
        paidHouseholds,
        unpaidHouseholds,
        archivedHouseholds,
        totalCollectors,
        activeCollectors,
        inactiveCollectors,
        suspendedCollectors,
        totalAnnouncements: announcements.length,
        totalCollected,
        currentWaterRate: 20.00,
        totalBills: billings.length
      });

      setRecentAnnouncements(sortedAnnouncements);
      setMonthlyCollections(monthlyCollectionsArray);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeHouseholds = stats.totalHouseholds - stats.archivedHouseholds;

  // Prepare chart data - use last 3 months for display
  const displayData = monthlyCollections.slice(-3);
  const maxAmount = Math.max(...displayData.map(m => m.total), 1) || 450000;

  const chartData = {
    labels: displayData.map(item => item.month),
    datasets: [
      {
        label: 'Collection',
        data: displayData.map(item => item.total),
        borderColor: '#006fba',
        backgroundColor: 'rgba(0, 111, 186, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#006fba',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 12,
        },
        callbacks: {
          label: function(context) {
            return `₱${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: maxAmount,
        ticks: {
          callback: function(value) {
            return '₱' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
          },
          font: {
            size: 11,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        ticks: {
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Section - Summary Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Total Households */}
            <div className="bg-blue-100 rounded-xl p-3 shadow-md aspect-square flex flex-col justify-center">
              <p className="text-gray-600 text-xs mb-1">Total Households</p>
              <p className="text-xl font-bold text-gray-800">{stats.totalHouseholds}</p>
            </div>

            {/* Paid Accounts */}
            <div className="bg-blue-100 rounded-xl p-3 shadow-md aspect-square flex flex-col justify-center">
              <p className="text-gray-600 text-xs mb-1">Paid Accounts</p>
              <p className="text-xl font-bold text-gray-800">{stats.paidHouseholds}</p>
            </div>

            {/* Unpaid Accounts */}
            <div className="bg-blue-100 rounded-xl p-3 shadow-md aspect-square flex flex-col justify-center">
              <p className="text-gray-600 text-xs mb-1">Unpaid Accounts</p>
              <p className="text-xl font-bold text-gray-800">{stats.unpaidHouseholds}</p>
            </div>

            {/* Total Collected */}
            <div className="bg-[#006fba] rounded-xl p-3 shadow-md text-white aspect-square flex flex-col justify-center">
              <p className="text-white/80 text-xs mb-1">Total Collected</p>
              <p className="text-lg font-bold">₱{stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            {/* Current Water Rate */}
            <div className="bg-[#006fba] rounded-xl p-3 shadow-md text-white aspect-square flex flex-col justify-center">
              <p className="text-white/80 text-xs mb-1">Current Water Rate</p>
              <p className="text-lg font-bold">₱{stats.currentWaterRate.toFixed(2)} / m³</p>
            </div>

            {/* Bills */}
            <div className="bg-[#006fba] rounded-xl p-3 shadow-md text-white aspect-square flex flex-col justify-center">
              <p className="text-white/80 text-xs mb-1">Bills</p>
              <p className="text-lg font-bold">{stats.totalBills}</p>
            </div>
          </div>
        </div>

        {/* Right Section - Chart and Table */}
        <div className="lg:col-span-3 space-y-6">
          {/* Monthly Collection Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6">Monthly Collection Chart</h2>
            {displayData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-400">No collection data available</p>
              </div>
            ) : (
              <div className="h-64">
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </div>

          {/* Monthly Collection History Table */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Monthly Collection History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg">
                <thead style={{ backgroundColor: '#006fba' }} className="rounded-t-lg">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tl-lg">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-white uppercase tracking-wider rounded-tr-lg">
                      Total Collected
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthlyCollections.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-6 py-4 text-center text-gray-500">
                        No collection data available
                      </td>
                    </tr>
                  ) : (
                    monthlyCollections.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₱{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome

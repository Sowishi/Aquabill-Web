import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdHome, MdPeople, MdAnnouncement, MdTrendingUp, MdAccountBalance } from 'react-icons/md';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
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

      // Fetch current water rate from settings
      let currentWaterRate = 20.00; // Default value
      try {
        const settingsRef = collection(db, 'settings');
        const settingsSnapshot = await getDocs(settingsRef);
        if (!settingsSnapshot.empty) {
          const settingsDoc = settingsSnapshot.docs[0];
          const settingsData = settingsDoc.data();
          currentWaterRate = parseFloat(settingsData.waterRate || settingsData.currentWaterRate || 20.00);
        }
      } catch (error) {
        console.error('Error fetching water rate:', error);
      }

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
        currentWaterRate,
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
      <div className="space-y-6 mx-4 md:mx-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const displayData = monthlyCollections.slice(-6); // Last 6 months
  const maxAmount = Math.max(...displayData.map(m => m.total), 1) || 100000;

  const lineChartData = {
    labels: displayData.map(item => {
      const [month, year] = item.month.split(' ');
      return `${month.substring(0, 3)} ${year}`;
    }),
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

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
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
        ticks: {
          callback: function(value) {
            return '₱' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const paymentStatusData = {
    labels: ['Paid', 'Unpaid'],
    datasets: [
      {
        data: [stats.paidHouseholds, stats.unpaidHouseholds],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 2,
      },
    ],
  };

  const paymentStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
    },
  };

  const collectorStatusData = {
    labels: ['Active', 'Inactive', 'Suspended'],
    datasets: [
      {
        label: 'Collectors',
        data: [stats.activeCollectors, stats.inactiveCollectors, stats.suspendedCollectors],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(156, 163, 175, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(156, 163, 175)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 1
      }
    ]
  };

  const collectorStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${value}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Households */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Households</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-800">{stats.totalHouseholds}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.archivedHouseholds > 0 && `${stats.archivedHouseholds} archived`}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <MdHome className="text-3xl text-[#006fba]" />
            </div>
          </div>
        </div>

        {/* Total Collectors */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Collectors</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-800">{stats.totalCollectors}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.activeCollectors} active
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <MdPeople className="text-3xl text-[#006fba]" />
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Collected</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">
                ₱{stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <MdTrendingUp className="text-green-500" />
                All time
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <MdAccountBalance className="text-3xl text-[#006fba]" />
            </div>
          </div>
        </div>

        {/* Current Water Rate */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Water Rate</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">
                ₱{stats.currentWaterRate.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">per m³</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <MdTrendingUp className="text-3xl text-[#006fba]" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Collection Chart */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Monthly Collection Trend</h2>
            <MdTrendingUp className="text-2xl text-[#006fba]" />
          </div>
          {displayData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400">No collection data available</p>
            </div>
          ) : (
            <div className="h-64">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          )}
        </div>

        {/* Payment Status Chart */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Payment Status</h2>
            <MdAccountBalance className="text-2xl text-[#006fba]" />
          </div>
          {stats.paidHouseholds === 0 && stats.unpaidHouseholds === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400">No payment data available</p>
            </div>
          ) : (
            <div className="h-64">
              <Doughnut data={paymentStatusData} options={paymentStatusOptions} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collector Status Chart */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Collector Status</h2>
            <MdPeople className="text-2xl text-[#006fba]" />
          </div>
          {stats.totalCollectors === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400">No collectors data available</p>
            </div>
          ) : (
            <div className="h-64">
              <Bar data={collectorStatusData} options={collectorStatusOptions} />
            </div>
          )}
        </div>

        {/* Recent Announcements */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Recent Announcements</h2>
            <MdAnnouncement className="text-2xl text-[#006fba]" />
          </div>
          {recentAnnouncements.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No announcements yet</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {recentAnnouncements.map((announcement) => (
                <div key={announcement.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <h3 className="font-semibold text-gray-800 mb-1">{announcement.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{announcement.content}</p>
                  <p className="text-xs text-gray-400">{formatDate(announcement.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardHome

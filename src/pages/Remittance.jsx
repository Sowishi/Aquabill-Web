import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { MdPayment } from 'react-icons/md';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

function Remittance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [remittances, setRemittances] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [chartData, setChartData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [totalRemittance, setTotalRemittance] = useState(0);
  const [filteredRemittance, setFilteredRemittance] = useState(0);

  useEffect(() => {
    fetchRemittances();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      processChartData();
      calculateFilteredRemittance();
    }
  }, [selectedYear, selectedMonth, remittances]);

  const fetchRemittances = async () => {
    try {
      setLoading(true);

      // Fetch notifications to find deposits created by treasurer
      const notificationsRef = collection(db, 'adminNotif');
      const notificationsSnapshot = await getDocs(notificationsRef);
      
      const treasurerNotifications = notificationsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(notif => notif.type === 'deposit' && notif.createdBy === 'treasurer' && notif.depositId);

      // Get deposit IDs created by treasurer
      const treasurerDepositIds = treasurerNotifications.map(notif => notif.depositId);

      // Fetch all deposits
      const depositsRef = collection(db, 'deposits');
      const depositsSnapshot = await getDocs(depositsRef);
      
      const deposits = depositsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter deposits created by treasurer
      const treasurerDeposits = deposits.filter(deposit => 
        treasurerDepositIds.includes(deposit.id)
      );

      // Get available years from deposits
      const yearsSet = new Set();
      
      // Populate years from 2025 down to 2020
      for (let year = 2025; year >= 2020; year--) {
        yearsSet.add(year);
      }
      
      treasurerDeposits.forEach(deposit => {
        const depositDate = deposit.depositDate || deposit.createdAt || '';
        if (depositDate) {
          const date = new Date(depositDate);
          yearsSet.add(date.getFullYear());
        }
      });

      setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
      setRemittances(treasurerDeposits);

      // Calculate total remittance
      const total = treasurerDeposits.reduce((sum, deposit) => {
        return sum + parseFloat(deposit.amount || 0);
      }, 0);
      setTotalRemittance(total);

    } catch (error) {
      console.error('Error fetching remittances:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateFilteredRemittance = () => {
    const filtered = remittances.filter(deposit => {
      const depositDate = deposit.depositDate || deposit.createdAt || '';
      if (!depositDate) return false;
      
      const date = new Date(depositDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth() returns 0-11
      
      return year === selectedYear && month === selectedMonth;
    });

    const total = filtered.reduce((sum, deposit) => {
      return sum + parseFloat(deposit.amount || 0);
    }, 0);

    setFilteredRemittance(total);
  };

  const processChartData = () => {
    // Filter by selected year
    const filteredRemittances = remittances.filter(deposit => {
      const depositDate = deposit.depositDate || deposit.createdAt || '';
      if (!depositDate) return false;
      
      const date = new Date(depositDate);
      return date.getFullYear() === selectedYear;
    });

    // Group by month for the selected year
    const monthlyData = {};
    filteredRemittances.forEach(deposit => {
      const depositDate = deposit.depositDate || deposit.createdAt || '';
      if (depositDate) {
        const date = new Date(depositDate);
        const month = date.getMonth(); // 0-11
        const amount = parseFloat(deposit.amount || 0);
        monthlyData[month] = (monthlyData[month] || 0) + amount;
      }
    });

    // Create labels and data for all 12 months
    const labels = [];
    const data = [];

    for (let month = 0; month < 12; month++) {
      labels.push(months[month].label);
      data.push(monthlyData[month] || 0);
    }

    setChartData({
      labels,
      datasets: [
        {
          label: 'Remittance Amount',
          data: data,
          backgroundColor: '#006fba',
          borderColor: '#006fba',
          borderWidth: 1
        }
      ]
    });
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Remittance</h1>
            <p className="text-sm md:text-base text-gray-600">View your remittance records and statistics</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              Remittance for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
            <p className="text-2xl md:text-3xl font-bold text-gray-800">
              {loading ? 'Loading...' : formatCurrency(filteredRemittance)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Year
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent"
            >
              {availableYears.length > 0 ? (
                availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))
              ) : (
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              )}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Month
            </label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006fba] focus:border-transparent"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Showing remittance for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}: {formatCurrency(filteredRemittance)}
        </p>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
          Monthly Remittance Chart - {selectedYear}
        </h2>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading chart data...</div>
          </div>
        ) : chartData ? (
          <div className="h-64 md:h-96">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'top'
                  },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        return `₱${parseFloat(context.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '₱' + parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                      }
                    }
                  }
                }
              }}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No remittance data available for the selected year.
          </div>
        )}
      </div>

      {/* Remittance Records Table */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Remittance Records</h2>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading remittance records...</div>
          </div>
        ) : remittances.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MdPayment className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Remittance Records</h3>
            <p className="text-gray-500">You haven't created any remittances yet.</p>
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
                {remittances
                  .filter(deposit => {
                    const depositDate = deposit.depositDate || deposit.createdAt || '';
                    if (!depositDate) return false;
                    const date = new Date(depositDate);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1; // getMonth() returns 0-11
                    return year === selectedYear && month === selectedMonth;
                  })
                  .sort((a, b) => {
                    const dateA = new Date(a.depositDate || a.createdAt || 0);
                    const dateB = new Date(b.depositDate || b.createdAt || 0);
                    return dateB - dateA;
                  })
                  .map((deposit, index) => (
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
                          <a
                            href={deposit.depositSlipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#006fba] hover:underline"
                          >
                            View Image
                          </a>
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
    </div>
  );
}

export default Remittance;


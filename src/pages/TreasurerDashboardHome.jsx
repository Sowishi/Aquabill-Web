import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
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

function TreasurerDashboardHome() {
  const [loading, setLoading] = useState(true);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [totalThisYear, setTotalThisYear] = useState(0);
  const [totalOverall, setTotalOverall] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [chartData, setChartData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [allPaidBillings, setAllPaidBillings] = useState([]);

  useEffect(() => {
    fetchCollectionData();
  }, []);

  useEffect(() => {
    if (selectedYear && !loading) {
      updateChartData();
    }
  }, [selectedYear]);

  const calculateSelectedMonthTotal = useCallback((paidBillings = null) => {
    const billings = paidBillings || allPaidBillings;
    if (!billings || billings.length === 0) {
      setTotalThisMonth(0);
      return;
    }

    let selectedMonthTotal = 0;

    billings.forEach(billing => {
      const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
      if (billingDate) {
        try {
          const date = new Date(billingDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
          
          if (year === selectedYear && month === selectedMonth) {
            const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
            if (!isNaN(amount)) {
              selectedMonthTotal += amount;
            }
          }
        } catch (error) {
          console.error('Error parsing date:', billingDate, error);
        }
      }
    });

    setTotalThisMonth(selectedMonthTotal);
  }, [selectedYear, selectedMonth, allPaidBillings]);

  useEffect(() => {
    if (selectedYear && selectedMonth && allPaidBillings.length > 0) {
      calculateSelectedMonthTotal();
    }
  }, [selectedYear, selectedMonth, allPaidBillings.length, calculateSelectedMonthTotal]);

  const fetchCollectionData = async () => {
    try {
      setLoading(true);

      // Fetch billing data
      const billingsSnapshot = await getDocs(collection(db, 'billing'));
      const billings = billingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter only paid billings
      const paidBillings = billings.filter(billing => {
        const status = billing.status || billing.paymentStatus || (billing.paid ? 'paid' : 'unpaid');
        return status.toLowerCase() === 'paid';
      });

      // Calculate totals
      const now = new Date();
      const currentYear = now.getFullYear();

      let thisYearTotal = 0;
      let overallTotal = 0;
      const yearsSet = new Set();

      paidBillings.forEach(billing => {
        const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
        const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
        
        if (billingDate) {
          const date = new Date(billingDate);
          const year = date.getFullYear();
          
          yearsSet.add(year);
          
          overallTotal += amount;
          
          if (year === currentYear) {
            thisYearTotal += amount;
          }
        } else {
          overallTotal += amount;
        }
      });

      setTotalThisYear(thisYearTotal);
      setTotalOverall(overallTotal);
      setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
      setAllPaidBillings(paidBillings);

      // Calculate selected month total
      calculateSelectedMonthTotal(paidBillings);

      // Initialize chart data
      updateChartData(paidBillings);

    } catch (error) {
      console.error('Error fetching collection data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChartData = (paidBillings = null) => {
    if (!paidBillings) {
      // Re-fetch if not provided
      getDocs(collection(db, 'billing')).then(snapshot => {
        const billings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const paid = billings.filter(billing => {
          const status = billing.status || billing.paymentStatus || (billing.paid ? 'paid' : 'unpaid');
          return status.toLowerCase() === 'paid';
        });
        processChartData(paid);
      });
    } else {
      processChartData(paidBillings);
    }
  };


  const processChartData = (paidBillings) => {
    // Filter by selected year
    const filteredBillings = paidBillings.filter(billing => {
      const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
      if (!billingDate) return false;
      
      const date = new Date(billingDate);
      return date.getFullYear() === selectedYear;
    });

    // Group by month for the selected year
    const monthlyData = {};
    filteredBillings.forEach(billing => {
      const billingDate = billing.createdAt || billing.date || billing.billingDate || billing.paymentDate || '';
      if (billingDate) {
        const date = new Date(billingDate);
        const month = date.getMonth(); // 0-11
        const amount = parseFloat(billing.amount || billing.totalAmount || billing.billAmount || 0);
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
          label: 'Collection Amount',
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

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* This Month */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h3 className="text-sm md:text-base text-gray-600 mb-2">
            {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </h3>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <p className="text-2xl md:text-3xl font-bold text-gray-800">{formatCurrency(totalThisMonth)}</p>
          )}
        </div>

        {/* This Year */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h3 className="text-sm md:text-base text-gray-600 mb-2">This Year</h3>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <p className="text-2xl md:text-3xl font-bold text-gray-800">{formatCurrency(totalThisYear)}</p>
          )}
        </div>

        {/* Overall */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h3 className="text-sm md:text-base text-gray-600 mb-2">Overall</h3>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <p className="text-2xl md:text-3xl font-bold text-gray-800">{formatCurrency(totalOverall)}</p>
          )}
        </div>
      </div>

      {/* Filters */}
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
              Filter by Month (for "This Month" card)
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
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
          Monthly Collection Chart - {selectedYear}
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
            No data available for the selected period.
          </div>
        )}
      </div>
    </div>
  );
}

export default TreasurerDashboardHome;


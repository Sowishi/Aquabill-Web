import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdHome, MdPeople, MdAnnouncement, MdCheck, MdCancel, MdArchive, MdBlock } from 'react-icons/md';

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
    totalAnnouncements: 0
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);

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

      setStats({
        totalHouseholds,
        paidHouseholds,
        unpaidHouseholds,
        archivedHouseholds,
        totalCollectors,
        activeCollectors,
        inactiveCollectors,
        suspendedCollectors,
        totalAnnouncements: announcements.length
      });

      setRecentAnnouncements(sortedAnnouncements);

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

  return (
    <div className="space-y-4 md:space-y-6 mx-4 md:mx-6">
      {/* Stats Grid - Households */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 px-1">Households Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="text-white rounded-xl p-4 md:p-6 shadow-lg" style={{ backgroundColor: '#006fba' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs md:text-sm">Total Households</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.totalHouseholds}</p>
                <p className="text-white/80 text-xs mt-1">{activeHouseholds} active</p>
              </div>
              <MdHome className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs md:text-sm">Paid</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.paidHouseholds}</p>
                {activeHouseholds > 0 && (
                  <p className="text-green-100 text-xs mt-1">
                    {Math.round((stats.paidHouseholds / activeHouseholds) * 100)}% of active
                  </p>
                )}
              </div>
              <MdCheck className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-xs md:text-sm">Unpaid</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.unpaidHouseholds}</p>
                {activeHouseholds > 0 && (
                  <p className="text-yellow-100 text-xs mt-1">
                    {Math.round((stats.unpaidHouseholds / activeHouseholds) * 100)}% of active
                  </p>
                )}
              </div>
              <MdCancel className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-xs md:text-sm">Archived</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.archivedHouseholds}</p>
                {stats.totalHouseholds > 0 && (
                  <p className="text-gray-100 text-xs mt-1">
                    {Math.round((stats.archivedHouseholds / stats.totalHouseholds) * 100)}% of total
                  </p>
                )}
              </div>
              <MdArchive className="text-3xl md:text-4xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Collectors */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 px-1">Collectors Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 text-xs md:text-sm">Total Collectors</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.totalCollectors}</p>
              </div>
              <MdPeople className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs md:text-sm">Active</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.activeCollectors}</p>
                {stats.totalCollectors > 0 && (
                  <p className="text-green-100 text-xs mt-1">
                    {Math.round((stats.activeCollectors / stats.totalCollectors) * 100)}% of total
                  </p>
                )}
              </div>
              <MdCheck className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-xs md:text-sm">Inactive</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.inactiveCollectors}</p>
                {stats.totalCollectors > 0 && (
                  <p className="text-gray-100 text-xs mt-1">
                    {Math.round((stats.inactiveCollectors / stats.totalCollectors) * 100)}% of total
                  </p>
                )}
              </div>
              <MdCancel className="text-3xl md:text-4xl" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs md:text-sm">Suspended</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.suspendedCollectors}</p>
                {stats.totalCollectors > 0 && (
                  <p className="text-red-100 text-xs mt-1">
                    {Math.round((stats.suspendedCollectors / stats.totalCollectors) * 100)}% of total
                  </p>
                )}
              </div>
              <MdBlock className="text-3xl md:text-4xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Announcements */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">Recent Announcements</h2>
          <span className="text-xs md:text-sm text-gray-500">{stats.totalAnnouncements} total</span>
        </div>
        
        {recentAnnouncements.length === 0 ? (
          <div className="text-center py-8">
            <MdAnnouncement className="text-4xl md:text-5xl mb-3 mx-auto" />
            <p className="text-sm md:text-base text-gray-500">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAnnouncements.map((announcement) => (
              <div key={announcement.id} className="flex items-start justify-between py-3 border-b last:border-b-0 gap-4">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MdAnnouncement />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-gray-800 truncate">{announcement.title}</p>
                    <p className="text-xs md:text-sm text-gray-500 line-clamp-2 mt-1">{announcement.body}</p>
                  </div>
                </div>
                <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatDate(announcement.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4">Payment Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-gray-600">Paid Households</span>
              <div className="flex items-center gap-2">
                <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${activeHouseholds > 0 ? (stats.paidHouseholds / activeHouseholds) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm md:text-base font-semibold text-gray-800 w-12 text-right">
                  {activeHouseholds > 0 ? Math.round((stats.paidHouseholds / activeHouseholds) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-gray-600">Unpaid Households</span>
              <div className="flex items-center gap-2">
                <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${activeHouseholds > 0 ? (stats.unpaidHouseholds / activeHouseholds) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm md:text-base font-semibold text-gray-800 w-12 text-right">
                  {activeHouseholds > 0 ? Math.round((stats.unpaidHouseholds / activeHouseholds) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4">Collector Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-gray-600">Active Collectors</span>
              <div className="flex items-center gap-2">
                <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.totalCollectors > 0 ? (stats.activeCollectors / stats.totalCollectors) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm md:text-base font-semibold text-gray-800 w-12 text-right">
                  {stats.totalCollectors > 0 ? Math.round((stats.activeCollectors / stats.totalCollectors) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-gray-600">Inactive/Suspended</span>
              <div className="flex items-center gap-2">
                <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.totalCollectors > 0 ? ((stats.inactiveCollectors + stats.suspendedCollectors) / stats.totalCollectors) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm md:text-base font-semibold text-gray-800 w-12 text-right">
                  {stats.totalCollectors > 0 ? Math.round(((stats.inactiveCollectors + stats.suspendedCollectors) / stats.totalCollectors) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome

import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import aquabillLogo from '../assets/aquabill-logo.png'
import { MdDashboard, MdHome, MdPeople, MdAnnouncement, MdAssessment, MdNotifications, MdPayment, MdChevronLeft, MdChevronRight, MdMenu, MdLogout, MdEmail } from 'react-icons/md'
import { FaUser } from 'react-icons/fa'

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false)
      }
    }

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserDropdown])

  const handleLogoutClick = () => {
    setShowUserDropdown(false)
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = () => {
    logout()
    navigate('/login')
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: MdDashboard },
    { name: 'Household', path: '/dashboard/household', icon: MdHome },
    { name: 'Bill Reminders', path: '/dashboard/bill-reminders', icon: MdEmail },
    { name: 'Collectors', path: '/dashboard/collectors', icon: MdPeople },
    { name: 'Announcements', path: '/dashboard/announcements', icon: MdAnnouncement },
    { name: 'Reports', path: '/dashboard/reports', icon: MdAssessment },
    { name: 'Notifications', path: '/dashboard/notifications', icon: MdNotifications },
    { name: 'Payment', path: '/dashboard/payment', icon: MdPayment }
  ]

  // Get current route name based on pathname
  const getCurrentRouteName = () => {
    const currentPath = location.pathname
    const currentRoute = navItems.find(item => item.path === currentPath)
    return currentRoute ? currentRoute.name : 'Dashboard'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } text-white transition-all duration-300 flex flex-col shadow-xl`}
        style={{ backgroundColor: '#006fba' }}
      >
        {/* Logo Section */}
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3">
            <img 
              src={aquabillLogo} 
              alt="AquaBill" 
              className="h-10 w-10 rounded-lg"
            />
            {isSidebarOpen && (
              <span className="font-bold text-xl">AquaBill</span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-white/10 rounded transition"
          >
            {isSidebarOpen ? <MdChevronLeft className="text-xl" /> : <MdChevronRight className="text-xl" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white/20 shadow-md'
                    : 'hover:bg-white/10'
                }`
              }
            >
              {item.icon && <item.icon className="text-2xl" />}
              {isSidebarOpen && (
                <span className="font-medium">{item.name}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
              <FaUser className="text-lg" />
            </div>
            {isSidebarOpen && (
              <div className="flex-1">
                <p className="font-medium text-sm">{user?.name || 'Admin User'}</p>
                <p className="text-xs text-white/70">{user?.email || 'admin@aquabill.com'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shadow-sm px-8 py-4 flex items-center justify-between" style={{ backgroundColor: '#006fba' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded transition"
            >
              <MdMenu className="text-2xl text-white" />
            </button>
            <h2 className="text-2xl font-bold text-white">{getCurrentRouteName()}</h2>
          </div>
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition cursor-pointer"
              title="User Menu"
            >
              <FaUser className="text-lg text-white" />
            </button>
            
            {/* User Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-800">{user?.name || 'Admin User'}</p>
                  <p className="text-xs text-gray-500">{user?.email || 'admin@aquabill.com'}</p>
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <MdLogout className="text-lg" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Logout</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleLogoutCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="px-4 py-2 text-white rounded-lg transition"
                  style={{ backgroundColor: '#006fba' }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Dashboard












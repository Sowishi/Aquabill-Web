import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import aquabillLogo from '../assets/aquabill-logo.png'

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Household', path: '/dashboard/household', icon: '🏠' },
    { name: 'Collectors', path: '/dashboard/collectors', icon: '👥' },
    { name: 'Announcements', path: '/dashboard/announcements', icon: '📢' },
    { name: 'Reports', path: '/dashboard/reports', icon: '📈' },
    { name: 'Notifications', path: '/dashboard/notifications', icon: '🔔' },
    { name: 'Payment', path: '/dashboard/payment', icon: '💳' }
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-blue-600 to-cyan-500 text-white transition-all duration-300 flex flex-col shadow-xl`}
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
            {isSidebarOpen ? '←' : '→'}
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
              <span className="text-2xl">{item.icon}</span>
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
              <span className="text-lg">👤</span>
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
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Welcome to AquaBill</h2>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
          >
            Logout
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Dashboard












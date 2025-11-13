import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import TreasurerDashboardHome from './pages/TreasurerDashboardHome'
import Household from './pages/Household'
import Collectors from './pages/Collectors'
import Announcements from './pages/Announcements'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import BillReminders from './pages/BillReminders'
import RateSettings from './pages/RateSettings'
import Deposit from './pages/Deposit'
import { useAuth } from './context/AuthContext'

// Component to conditionally render dashboard home based on role
function DashboardHomeWrapper() {
  const { user } = useAuth()
  const userRole = user?.role || 'admin'
  
  if (userRole === 'treasurer') {
    return <TreasurerDashboardHome />
  }
  
  return <DashboardHome />
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHomeWrapper />} />
          <Route path="deposit" element={<Deposit />} />
          <Route path="household" element={<Household />} />
          <Route path="bill-reminders" element={<BillReminders />} />
          <Route path="collectors" element={<Collectors />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="rate-settings" element={<RateSettings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

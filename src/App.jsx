import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import Household from './pages/Household'
import Collectors from './pages/Collectors'
import Announcements from './pages/Announcements'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import Payment from './pages/Payment'
import BillReminders from './pages/BillReminders'
import RateSettings from './pages/RateSettings'

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
          <Route index element={<DashboardHome />} />
          <Route path="household" element={<Household />} />
          <Route path="bill-reminders" element={<BillReminders />} />
          <Route path="collectors" element={<Collectors />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="rate-settings" element={<RateSettings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="payment" element={<Payment />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

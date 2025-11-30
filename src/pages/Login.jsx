import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import aquabillLogo from '../assets/aquabill-logo.png'
import bgImage from '../assets/bg.jpg'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = login(email, password)
    
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Invalid credentials')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative">
      {/* Blurred Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(8px)',
          transform: 'scale(1.1)'
        }}
      />
      {/* Content */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl flex overflow-hidden relative z-10">
        {/* Left side - Logo */}
        <div className="w-1/2 bg-white flex items-center justify-center p-12">
          <div className="text-center">
            <img 
              src={aquabillLogo} 
              alt="AquaBill Logo" 
              className="h-32 w-auto mx-auto mb-6"
            />
            <p className="text-gray-700 text-sm leading-relaxed max-w-md mx-auto font-bold">
              <span className="font-bold text-2xl text-gray-900">AQUA-BILL:Developing a Water Billing Management System for Magahis III WEST Water System. </span> 
              <br /><br />
              Ensure your home or community enjoys efficient and sustainable water services! Our advanced water management system offers monitoring, billing automation, leak detection, and consumption tracking. All designed to save you time, money, and resources.
            </p>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-1/2 p-12 flex flex-col justify-center" style={{ backgroundColor: '#006fba' }}>
          <h1 className="text-3xl font-bold text-white mb-2">
            Admin Login
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-white text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-white mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-white/30 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition bg-white/10 text-white placeholder-white/70"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-white mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-white/30 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition bg-white/10 text-white placeholder-white/70"
                placeholder="Enter your password"
                required
              />
            </div>


            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-[#006fba] hover:bg-white/90 font-semibold py-3 rounded-lg transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center">
              <Link 
                to="/forgot-password" 
                className="text-white/80 hover:text-white text-sm underline"
              >
                Forgot Password?
              </Link>
            </div>
          </form>
        </div>
      </div>
      
      {/* Copyright */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm z-10">
        © 2025 aquabill
      </div>
    </div>
  )
}

export default Login


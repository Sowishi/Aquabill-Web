import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import aquabillLogo from '../assets/aquabill-logo.png'
import bgImage from '../assets/bg.jpg'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Helper function to get stored password from localStorage
  const getStoredPassword = (email) => {
    const storedPassword = localStorage.getItem(`password_${email}`)
    return storedPassword || 'admin123' // Default password
  }

  const sendPasswordEmail = async (email, password, userName) => {
    try {
      const emailData = {
        to_email: email,
        to_name: userName,
        password: password,
        subject: 'Your AquaBill Password Recovery',
        message: `Hello ${userName},\n\nYou requested to recover your password.\n\nYour password is: ${password}\n\nPlease keep this information secure.\n\nBest regards,\nAquaBill Team`
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'service_ves7ah7',
          template_id: 'template_a5qr2af',
          user_id: 'pQ5V0cJlxP7v7MH_s',
          template_params: emailData
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      let password = null
      let userName = null

      // Check if it's admin or treasurer (stored in localStorage)
      if (email === 'admin@aquabill.com') {
        password = getStoredPassword(email)
        userName = 'Admin User'
      } else if (email === 'treasurer@aquabill.com') {
        password = getStoredPassword(email)
        userName = 'Treasurer User'
      } else {
        // Check Firestore for residents
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', email))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0]
          const userData = userDoc.data()
          password = userData.password
          userName = userData.fullName || 'User'
        } else {
          setError('Email not found. Please check your email address.')
          setLoading(false)
          return
        }
      }

      if (password) {
        // Send password via email
        await sendPasswordEmail(email, password, userName)
        setSuccess('Password has been sent to your email address!')
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } else {
        setError('Unable to retrieve password. Please contact support.')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to send password email. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 relative">
      {/* Blurred Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(5px)',
          transform: 'scale(1.1)'
        }}
      />
      {/* Content */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Left side - Logo */}
        <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 md:p-12">
          <div className="text-center">
            <img 
              src={aquabillLogo} 
              alt="AquaBill Logo" 
              className="h-46 w-auto mx-auto mb-1"  // Increased logo size
            />
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed max-w-md mx-auto font-bold">
              <span className="font-bold text-lg sm:text-xl md:text-2xl text-[#006fba]">Simplifying Water Management, One Drop at a Time</span> 
              <br /><br />
              <span className="text-[#006fba]">Ensure your home and community enjoy efficient and sustainable water services! We provide safe and reliable clean water for every household. Together, we promote sustainability and ensure the well-being of every neighborhood we serve.</span>
              <div className="mt-10 text-center text-gray-500 text-sm">
                <span>Copyright © Aqua-Bill 2025</span>
              </div>
            </p>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 md:p-12 flex flex-col justify-center" style={{ backgroundColor: '#006fba' }}>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Forgot Password
          </h1>
          <p className="text-white/80 mb-4 sm:mb-6 text-sm sm:text-base">
            Enter your email address and we'll send you your password.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-white text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-white text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                className="w-full px-4 py-2.5 sm:py-3 border border-white/30 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition bg-white/10 text-white placeholder-white/70 text-sm sm:text-base"
                placeholder="Enter your email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-[#006fba] hover:bg-white/90 font-semibold py-2.5 sm:py-3 rounded-lg transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? 'Sending...' : 'Send Password'}
            </button>

            <div className="text-center">
              <Link 
                to="/login" 
                className="text-white/80 hover:text-white text-sm underline"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword

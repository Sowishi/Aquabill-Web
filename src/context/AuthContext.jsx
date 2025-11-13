import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Helper functions to get/set passwords from localStorage
const getStoredPassword = (email) => {
  const storedPassword = localStorage.getItem(`password_${email}`)
  return storedPassword || 'admin123' // Default password
}

const setStoredPassword = (email, password) => {
  localStorage.setItem(`password_${email}`, password)
}

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in from localStorage
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedUser = localStorage.getItem('user')
    
    if (storedAuth === 'true' && storedUser) {
      const userData = JSON.parse(storedUser)
      setIsAuthenticated(true)
      setUser(userData)
    }
    setLoading(false)
  }, [])

  const login = (email, password) => {
    // Get stored password for the email
    const storedPassword = getStoredPassword(email)
    
    // Check admin credentials
    if (email === 'admin@aquabill.com' && password === storedPassword) {
      const userData = {
        email: email,
        name: 'Admin User',
        role: 'admin',
        profilePicture: localStorage.getItem(`profilePicture_${email}`) || null
      }
      setIsAuthenticated(true)
      setUser(userData)
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('user', JSON.stringify(userData))
      return { success: true }
    } 
    // Check treasurer credentials
    else if (email === 'treasurer@aquabill.com' && password === storedPassword) {
      const userData = {
        email: email,
        name: 'Treasurer User',
        role: 'treasurer',
        profilePicture: localStorage.getItem(`profilePicture_${email}`) || null
      }
      setIsAuthenticated(true)
      setUser(userData)
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('user', JSON.stringify(userData))
      return { success: true }
    } 
    else {
      return { success: false, error: 'Invalid email or password' }
    }
  }

  const updatePassword = async (currentPassword, newPassword) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const storedPassword = getStoredPassword(user.email)
    
    // Verify current password
    if (currentPassword !== storedPassword) {
      return { success: false, error: 'Current password is incorrect' }
    }

    // Update password
    setStoredPassword(user.email, newPassword)
    
    return { success: true }
  }

  const updateProfilePicture = async (profilePictureUrl) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Update profile picture in localStorage
    localStorage.setItem(`profilePicture_${user.email}`, profilePictureUrl)
    
    // Update user state
    const updatedUser = {
      ...user,
      profilePicture: profilePictureUrl
    }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
    
    return { success: true }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, updatePassword, updateProfilePicture }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


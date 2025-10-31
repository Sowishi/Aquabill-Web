function DashboardHome() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to your AquaBill dashboard overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Households</p>
              <p className="text-3xl font-bold mt-2">1,234</p>
            </div>
            <div className="text-4xl">🏠</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm">Active Collectors</p>
              <p className="text-3xl font-bold mt-2">45</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Payments</p>
              <p className="text-3xl font-bold mt-2">$45,890</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Pending Bills</p>
              <p className="text-3xl font-bold mt-2">234</p>
            </div>
            <div className="text-4xl">📋</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span>💳</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Payment received</p>
                <p className="text-sm text-gray-500">Household #1234 - $45.00</p>
              </div>
            </div>
            <span className="text-sm text-gray-400">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <span>✅</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">New household registered</p>
                <p className="text-sm text-gray-500">John Doe - Unit 456</p>
              </div>
            </div>
            <span className="text-sm text-gray-400">5 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                <span>📢</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Announcement posted</p>
                <p className="text-sm text-gray-500">Water service maintenance scheduled</p>
              </div>
            </div>
            <span className="text-sm text-gray-400">1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome



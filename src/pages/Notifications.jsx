import { MdNotifications } from 'react-icons/md';

function Notifications() {
  return (
    <div className="space-y-6 mx-4 md:mx-6">
      <div className="bg-white rounded-xl shadow-md p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <MdNotifications className="text-6xl mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Notifications Section</h2>
          <p className="text-gray-500">Content coming soon...</p>
        </div>
      </div>
    </div>
  )
}

export default Notifications












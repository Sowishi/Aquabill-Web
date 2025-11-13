import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MdNotifications, MdCheckCircle, MdCircle, MdImage, MdVisibility } from 'react-icons/md';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const notificationsRef = collection(db, 'adminNotif');
      const notificationsQuery = query(notificationsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(notificationsQuery);
      
      const notificationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'adminNotif', notificationId);
      await updateDoc(notificationRef, {
        status: 'read'
      });
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif =>
          notif.id === notificationId
            ? { ...notif, status: 'read' }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => n.status === 'unread');
      const updatePromises = unreadNotifications.map(notif => {
        const notificationRef = doc(db, 'adminNotif', notif.id);
        return updateDoc(notificationRef, { status: 'read' });
      });
      
      await Promise.all(updatePromises);
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, status: 'read' }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {
      return 'N/A';
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="space-y-6 mx-4 md:mx-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Notifications</h1>
            <p className="text-sm md:text-base text-gray-600">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: '#006fba' }}
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <MdNotifications className="text-6xl text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Notifications</h2>
            <p className="text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition ${
                  notification.status === 'unread'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {notification.status === 'unread' ? (
                      <MdCircle className="text-[#006fba] text-lg" />
                    ) : (
                      <MdCheckCircle className="text-gray-400 text-lg" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800">
                            {notification.title || 'Notification'}
                          </h3>
                          {notification.createdBy === 'treasurer' && (
                            <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#006fba' }}>
                              Treasurer
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-1">
                          {notification.message}
                        </p>
                        {notification.createdByName && (
                          <p className="text-xs text-gray-500 mb-1">
                            Created by: {notification.createdByName}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {notification.status === 'unread' && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-[#006fba] hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                        {notification.type === 'deposit' && notification.depositSlipUrl && (
                          <button
                            onClick={() => setViewingReceipt(notification.depositSlipUrl)}
                            className="flex items-center gap-1 text-xs text-white px-3 py-1 rounded hover:opacity-90 transition"
                            style={{ backgroundColor: '#006fba' }}
                          >
                            <MdVisibility className="text-sm" />
                            <span>View Receipt</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt View Modal */}
      {viewingReceipt && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-[linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.5))]"
          onClick={() => setViewingReceipt(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Deposit Receipt</h3>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <img
                src={viewingReceipt}
                alt="Deposit receipt"
                className="w-full h-auto rounded-lg border border-gray-200"
              />
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                style={{ backgroundColor: '#006fba' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;












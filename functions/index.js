/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Scheduled SMS Function
// You can configure the schedule in Firebase Console or update the schedule property
export const sendScheduledSMS = onSchedule(
  {
    schedule: "0 14 * * *",
    timeZone: "Asia/Manila", // Adjust to your timezone
  },
  async () => {
    try {
      const smsApiUrl = "https://sms.iprogtech.com/api/v1/sms_messages";
      const apiToken = "9d955a7153ec9346cf3027ba86ca3038277a6094";

      // Calculate date range: today to 3 days from now (inclusive)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      // Set end of day for 3 days from now (23:59:59)
      threeDaysFromNow.setHours(23, 59, 59, 999);
      
      logger.info("Checking for bills due within next 3 days", {
        today: today.toISOString().split("T")[0],
        threeDaysFromNow: threeDaysFromNow.toISOString().split("T")[0],
        range: "Today to 3 days from now (inclusive)",
      });

      // Query billing collection for unpaid bills
      const billingRef = db.collection("billing");
      const billingSnapshot = await billingRef
        .where("status", "==", "unpaid")
        .get();

      const billsToRemind = [];
      
      for (const doc of billingSnapshot.docs) {
        const bill = doc.data();
        
        // Parse the dueDate timestamp (handles format like 2025-11-23T17:30:02.310718Z)
        const billDueDate = new Date(bill.dueDate);
        
        // Check if due date is within the range (today to 3 days from now, inclusive)
        // Compare dates only (ignore time)
        const billDueDateOnly = new Date(
          billDueDate.getFullYear(),
          billDueDate.getMonth(),
          billDueDate.getDate()
        );
        
        if (billDueDateOnly >= today && billDueDateOnly <= threeDaysFromNow) {
          const daysUntilDue = Math.ceil(
            (billDueDateOnly - today) / (1000 * 60 * 60 * 24)
          );
          
          billsToRemind.push({
            id: doc.id,
            ...bill,
            daysUntilDue: daysUntilDue,
          });
          
          logger.info(`Found bill to remind: ${bill.accountNumber}`, {
            dueDate: billDueDate.toISOString().split("T")[0],
            daysUntilDue: daysUntilDue,
            userId: bill.userId,
          });
        }
      }

      logger.info(`Found ${billsToRemind.length} bills due in 3 days`);

      // Send SMS for each bill
      const results = [];
      for (const bill of billsToRemind) {
        try {
          // Get user's contact number from users collection using userId from billing
          logger.info(`Fetching user contact for userId: ${bill.userId}`, {
            billId: bill.id,
            accountNumber: bill.accountNumber,
          });
          
          const userDoc = await db.collection("users").doc(bill.userId).get();
          
          if (!userDoc.exists) {
            logger.warn(`User not found for bill ${bill.id}`, {
              userId: bill.userId,
              accountNumber: bill.accountNumber,
            });
            continue;
          }

          const userData = userDoc.data();
          const contactNumber = userData.contactNumber;

          if (!contactNumber || contactNumber.trim() === "") {
            logger.warn(`No contact number found for user ${bill.userId}`, {
              userId: bill.userId,
              userName: bill.userName,
              accountNumber: bill.accountNumber,
            });
            continue;
          }

          logger.info(`Found contact number for user ${bill.userId}`, {
            contactNumber: contactNumber,
            userName: bill.userName,
          });

          // Format phone number (ensure it starts with country code or is 11 digits)
          let phoneNumber = contactNumber.trim();
          if (!phoneNumber.startsWith("+")) {
            // If it doesn't start with +, assume it's a local number
            // Remove leading 0 if present and add country code
            if (phoneNumber.startsWith("0")) {
              phoneNumber = "+63" + phoneNumber.substring(1);
            } else if (phoneNumber.length === 10) {
              phoneNumber = "+63" + phoneNumber;
            } else {
              phoneNumber = "+63" + phoneNumber;
            }
          }

          // Format due date for display
          const dueDate = new Date(bill.dueDate);
          const formattedDueDate = dueDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          // Create message based on days until due
          let daysMessage = "";
          if (bill.daysUntilDue === 0) {
            daysMessage = "TODAY";
          } else if (bill.daysUntilDue === 1) {
            daysMessage = "TOMORROW";
          } else {
            daysMessage = `in ${bill.daysUntilDue} days`;
          }

          // Create short but detailed SMS message
          const smsMessage = `AquaBill Reminder: Hi ${bill.userName}, your water bill (Acct: ${bill.accountNumber}) of ₱${bill.totalAmount} is due ${daysMessage} (${formattedDueDate}). Consumption: ${bill.consumption} cu.m. Please pay on time.`;

          const requestBody = {
            api_token: apiToken,
            phone_number: phoneNumber,
            message: smsMessage,
          };

          logger.info("Sending SMS reminder", {
            phoneNumber: phoneNumber,
            accountNumber: bill.accountNumber,
            userName: bill.userName,
          });

          const response = await fetch(smsApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SMS API error: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          results.push({
            success: true,
            billId: bill.id,
            accountNumber: bill.accountNumber,
            phoneNumber: phoneNumber,
            result: result,
          });

          logger.info("SMS sent successfully", {
            billId: bill.id,
            accountNumber: bill.accountNumber,
          });
        } catch (error) {
          logger.error(`Error sending SMS for bill ${bill.id}`, {
            error: error.message,
            accountNumber: bill.accountNumber,
          });
          results.push({
            success: false,
            billId: bill.id,
            accountNumber: bill.accountNumber,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        billsProcessed: billsToRemind.length,
        results: results,
      };
    } catch (error) {
      logger.error("Error in scheduled SMS function", {error: error.message});
      throw error;
    }
  }
);

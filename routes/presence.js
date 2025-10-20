const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
let serverTimestamp = null;
let Timestamp = null;

if (admin.apps.length > 0) {
  db = admin.firestore();
  serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
  Timestamp = admin.firestore.Timestamp;
} else {
  console.log('⚠️ Firebase Firestore not available in presence route - using in-memory storage');
}

// Presence states
const PRESENCE_STATES = {
  ONLINE: 'online',
  AWAY: 'away',
  OFFLINE: 'offline'
};

// Update user presence
router.post('/update', async (req, res) => {
  try {
    const { userId, status = PRESENCE_STATES.ONLINE } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!Object.values(PRESENCE_STATES).includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid presence status'
      });
    }

    const userRef = db.collection('users').doc(userId);
    
    await userRef.update({
      'presence.status': status,
      'presence.lastSeen': serverTimestamp ? serverTimestamp() : new Date(),
      'presence.updatedAt': serverTimestamp ? serverTimestamp() : new Date()
    });

    res.json({
      success: true,
      message: 'Presence updated successfully'
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update presence'
    });
  }
});

// Get user presence
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();
    const presence = userData.presence || { 
      status: PRESENCE_STATES.OFFLINE,
      lastSeen: null 
    };

    // Convert timestamp to ISO string if it exists
    if (presence.lastSeen && presence.lastSeen.toDate) {
      presence.lastSeen = presence.lastSeen.toDate().toISOString();
    }

    res.json({
      success: true,
      presence
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch presence'
    });
  }
});

// Get multiple users' presence
router.post('/batch', async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array is required'
      });
    }

    const presenceData = {};
    
    // Firestore has a limit of 10 documents per batch get
    const batches = [];
    for (let i = 0; i < userIds.length; i += 10) {
      batches.push(userIds.slice(i, i + 10));
    }

    for (const batch of batches) {
      const promises = batch.map(userId => 
        db.collection('users').doc(userId).get()
      );
      
      const docs = await Promise.all(promises);
      
      docs.forEach((doc, index) => {
        const userId = batch[index];
        if (doc.exists) {
          const userData = doc.data();
          let presence = userData.presence || { 
            status: PRESENCE_STATES.OFFLINE,
            lastSeen: null 
          };

          // Convert timestamp to ISO string if it exists
          if (presence.lastSeen && presence.lastSeen.toDate) {
            presence.lastSeen = presence.lastSeen.toDate().toISOString();
          }

          presenceData[userId] = presence;
        } else {
          presenceData[userId] = { 
            status: PRESENCE_STATES.OFFLINE,
            lastSeen: null 
          };
        }
      });
    }

    res.json({
      success: true,
      presenceData
    });
  } catch (error) {
    console.error('Error fetching batch presence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch presence data'
    });
  }
});

// Set user online
router.post('/:userId/online', async (req, res) => {
  try {
    const { userId } = req.params;

    const userRef = db.collection('users').doc(userId);
    
    await userRef.update({
      'presence.status': PRESENCE_STATES.ONLINE,
      'presence.lastSeen': serverTimestamp ? serverTimestamp() : new Date(),
      'presence.updatedAt': serverTimestamp ? serverTimestamp() : new Date()
    });

    res.json({
      success: true,
      message: 'User set to online'
    });
  } catch (error) {
    console.error('Error setting user online:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user online'
    });
  }
});

// Set user away
router.post('/:userId/away', async (req, res) => {
  try {
    const { userId } = req.params;

    const userRef = db.collection('users').doc(userId);
    
    await userRef.update({
      'presence.status': PRESENCE_STATES.AWAY,
      'presence.lastSeen': serverTimestamp ? serverTimestamp() : new Date(),
      'presence.updatedAt': serverTimestamp ? serverTimestamp() : new Date()
    });

    res.json({
      success: true,
      message: 'User set to away'
    });
  } catch (error) {
    console.error('Error setting user away:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user away'
    });
  }
});

// Set user offline
router.post('/:userId/offline', async (req, res) => {
  try {
    const { userId } = req.params;

    const userRef = db.collection('users').doc(userId);
    
    await userRef.update({
      'presence.status': PRESENCE_STATES.OFFLINE,
      'presence.lastSeen': serverTimestamp ? serverTimestamp() : new Date(),
      'presence.updatedAt': serverTimestamp ? serverTimestamp() : new Date()
    });

    res.json({
      success: true,
      message: 'User set to offline'
    });
  } catch (error) {
    console.error('Error setting user offline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user offline'
    });
  }
});

// Cleanup inactive users (set them offline)
router.post('/cleanup', async (req, res) => {
  try {
    const { inactiveThresholdMinutes = 30 } = req.body;
    
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - inactiveThresholdMinutes);

    const usersRef = db.collection('users');
    const query = usersRef
      .where('presence.status', 'in', [PRESENCE_STATES.ONLINE, PRESENCE_STATES.AWAY])
      .where('presence.updatedAt', '<', Timestamp ? Timestamp.fromDate(thresholdTime) : thresholdTime);

    const snapshot = await query.get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        'presence.status': PRESENCE_STATES.OFFLINE,
        'presence.updatedAt': serverTimestamp ? serverTimestamp() : new Date()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: `Set ${snapshot.size} inactive users to offline`
    });
  } catch (error) {
    console.error('Error cleaning up inactive users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup inactive users'
    });
  }
});

module.exports = router;
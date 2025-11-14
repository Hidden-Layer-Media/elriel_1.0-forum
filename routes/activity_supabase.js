// Elriel - Activity Routes (Supabase Version)
// Handles activity logging and retrieval for Bleedstream

const express = require('express');
const router = express.Router();
const supabase = require('../services/db');
const websocketService = require('../services/websocket');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  next();
};

// Get activity log (paginated)
router.get('/log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.query.userId || null;

    // Build query
    let query = supabase
      .from('activity_log')
      .select(`
        *,
        users:user_id (username)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add user filter if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Execute query
    const { data: activities, error } = await query;

    if (error) {
      throw error;
    }

    // Format activities for response
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      userId: activity.user_id,
      username: activity.users.username,
      type: activity.activity_type,
      data: typeof activity.activity_data === 'string'
        ? JSON.parse(activity.activity_data || '{}')
        : activity.activity_data || {},
      createdAt: activity.created_at
    }));

    res.json({
      success: true,
      activities: formattedActivities,
      pagination: {
        limit,
        offset,
        hasMore: formattedActivities.length === limit
      }
    });
  } catch (err) {
    console.error('Error fetching activity log:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to fetch activity log'
    });
  }
});

// Log a new activity
router.post('/log', isAuthenticated, async (req, res) => {
  try {
    const { activity_type, activity_data } = req.body;
    const userId = req.session.user.id;

    // Validate input
    if (!activity_type) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Activity type is required'
      });
    }

    // Insert activity
    const { data: activity, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        activity_type: activity_type,
        activity_data: activity_data ? JSON.stringify(activity_data) : null
      })
      .select(`
        *,
        users:user_id (username)
      `)
      .single();

    if (error) {
      throw error;
    }

    // Format for WebSocket broadcast
    const formattedActivity = {
      id: activity.id,
      userId,
      username: req.session.user.username,
      type: activity_type,
      data: activity_data || {},
      createdAt: activity.created_at
    };

    // Broadcast to WebSocket clients
    try {
      websocketService.broadcast({
        type: 'activity',
        data: formattedActivity
      });
    } catch (wsError) {
      console.warn('WebSocket broadcast failed:', wsError.message);
      // Don't fail the request if WebSocket fails
    }

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      activity: formattedActivity
    });
  } catch (err) {
    console.error('Error logging activity:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to log activity'
    });
  }
});

// Get personalized activity feed for current user
router.get('/feed', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get user interests
    const { data: userInterests, error: interestsError } = await supabase
      .from('user_interests')
      .select('tag, district_id, glyph_id')
      .eq('user_id', userId);

    if (interestsError) {
      throw interestsError;
    }

    // For now, just get all activities sorted by recency
    // In a more sophisticated implementation, we'd use the interests for filtering
    const { data: activities, error } = await supabase
      .from('activity_log')
      .select(`
        *,
        users:user_id (username)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Format activities for response
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      userId: activity.user_id,
      username: activity.users.username,
      type: activity.activity_type,
      data: typeof activity.activity_data === 'string'
        ? JSON.parse(activity.activity_data || '{}')
        : activity.activity_data || {},
      createdAt: activity.created_at
    }));

    res.json({
      success: true,
      activities: formattedActivities,
      pagination: {
        limit,
        offset,
        hasMore: formattedActivities.length === limit
      }
    });
  } catch (err) {
    console.error('Error fetching personalized feed:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to fetch personalized feed'
    });
  }
});

// Hook for auto-logging of system events
async function logActivity(userId, activityType, activityData) {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        activity_type: activityType,
        activity_data: activityData ? JSON.stringify(activityData) : null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  } catch (err) {
    console.error('Error auto-logging activity:', err);
    return null;
  }
}

// Export router and utility functions
module.exports = router;
module.exports.logActivity = logActivity;

// Elriel - API Routes (Supabase Version)
// Handles API endpoints for the application

const express = require('express');
const router = express.Router();
const supabase = require('../services/db');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

// Get user activity
router.get('/activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Get activities
    const { data: activities, error } = await supabase
      .from('activity_log')
      .select('activity_type, activity_data, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Format activities
    const formattedActivities = activities.map(activity => ({
      activity_type: activity.activity_type,
      description: activity.activity_data,
      created_at: activity.created_at,
      metadata: activity.activity_data
    }));

    res.json({
      success: true,
      activities: formattedActivities
    });
  } catch (err) {
    console.error('Error fetching activity:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity data'
    });
  }
});

// Get user reputation
router.get('/reputation/:userId', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if viewing own reputation or is admin
    if (req.session.user.id !== parseInt(userId) && !req.session.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get reputation from profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('reputation, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      reputation: {
        reputation_points: profile?.reputation || 0,
        reputation_level: Math.floor((profile?.reputation || 0) / 100) + 1,
        last_updated: profile?.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching reputation:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reputation data'
    });
  }
});

// Get user rewards
router.get('/rewards/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get rewards/unlocks for this user
    const { data: rewards, error } = await supabase
      .from('reward_unlocks')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      rewards: rewards || []
    });
  } catch (err) {
    console.error('Error fetching rewards:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards data'
    });
  }
});

// Get user stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get post count
    const { count: postCount, error: postError } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (postError) {
      throw postError;
    }

    // Get comment count
    const { count: commentCount, error: commentError } = await supabase
      .from('forum_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (commentError) {
      throw commentError;
    }

    // Get glyph count
    const { count: glyphCount, error: glyphError } = await supabase
      .from('glyphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (glyphError) {
      throw glyphError;
    }

    // Get user profile for reputation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('reputation, created_at')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    res.json({
      success: true,
      stats: {
        posts: postCount || 0,
        comments: commentCount || 0,
        glyphs: glyphCount || 0,
        reputation: profile?.reputation || 0,
        member_since: profile?.created_at
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats data'
    });
  }
});

// Search users
router.get('/users/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search users by username
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, created_at')
      .ilike('username', `%${q}%`)
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      users: users || []
    });
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

// Elriel - Admin Routes
// Handles administrative functions and moderation

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const supabase = require('../services/db');

// Authentication and admin middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
};

// Serve admin dashboard
router.get('/dashboard', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Get site statistics
    const stats = await getSiteStats();

    const data = {
      user: req.session.user,
      stats
    };

    let html = fs.readFileSync(path.join(__dirname, '../views/admin/dashboard.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Get site statistics
async function getSiteStats() {
  try {
    // Get user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get post count
    const { count: postCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    // Get whisper count
    const { count: whisperCount } = await supabase
      .from('whispers')
      .select('*', { count: 'exact', head: true });

    // Get forum topic count
    const { count: topicCount } = await supabase
      .from('forum_topics')
      .select('*', { count: 'exact', head: true });

    // Get recent registrations (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    return {
      totalUsers: userCount || 0,
      totalPosts: postCount || 0,
      totalWhispers: whisperCount || 0,
      totalTopics: topicCount || 0,
      recentUsers: recentUsers || 0
    };
  } catch (error) {
    console.error('Error getting site stats:', error);
    return {
      totalUsers: 0,
      totalPosts: 0,
      totalWhispers: 0,
      totalTopics: 0,
      recentUsers: 0
    };
  }
}

// Get all users (paginated)
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search = '' } = req.query;

    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        is_admin,
        created_at,
        profiles:profiles!user_id (
          reputation,
          status
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (search) {
      query = query.ilike('username', `%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      users: users || []
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Ban/unban a user
router.post('/users/:userId/ban', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned = true, reason = '' } = req.body;

    // Update user ban status
    const { error } = await supabase
      .from('users')
      .update({
        is_banned: banned,
        ban_reason: reason,
        banned_at: banned ? new Date().toISOString() : null
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: banned ? 'User banned successfully' : 'User unbanned successfully'
    });
  } catch (err) {
    console.error('Error banning user:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

// Delete a post
router.delete('/posts/:postId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { postId } = req.params;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post'
    });
  }
});

// Delete a whisper
router.delete('/whispers/:whisperId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { whisperId } = req.params;

    const { error } = await supabase
      .from('whispers')
      .delete()
      .eq('id', whisperId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Whisper deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting whisper:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete whisper'
    });
  }
});

// Get recent activity log
router.get('/activity', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const { data: activities, error } = await supabase
      .from('activity_log')
      .select(`
        *,
        users:user_id (username)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      activities: activities || []
    });
  } catch (err) {
    console.error('Error fetching activity:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log'
    });
  }
});

// Get site statistics API
router.get('/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const stats = await getSiteStats();

    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Make user admin
router.post('/users/:userId/make-admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'User promoted to admin'
    });
  } catch (err) {
    console.error('Error making user admin:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to promote user'
    });
  }
});

// Create system announcement
router.post('/announcements', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, content, type = 'info' } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        type,
        created_by: req.session.user.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Announcement created successfully',
      announcement: data
    });
  } catch (err) {
    console.error('Error creating announcement:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
});

module.exports = router;

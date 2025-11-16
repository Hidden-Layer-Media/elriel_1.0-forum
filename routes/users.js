// Elriel - User Directory Routes
// Handles user discovery and directory

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const supabase = require('../services/db');

// Serve user directory page
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'recent' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query based on sort option
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        created_at,
        profiles:profiles!user_id (
          status,
          reputation,
          glyph_id,
          glyphs:glyph_id (svg_data)
        )
      `)
      .range(offset, offset + parseInt(limit) - 1);

    // Apply sorting
    if (sort === 'reputation') {
      // Note: This is a simplified sort. In production, you'd want to join profiles and sort by reputation
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'alphabetical') {
      query = query.order('username', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: users, error } = await query;

    if (error) {
      throw error;
    }

    const data = {
      users: users || [],
      currentPage: parseInt(page),
      limit: parseInt(limit),
      sort,
      user: req.session.user || null
    };

    let html = fs.readFileSync(path.join(__dirname, '../views/users/directory.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading user directory:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Get user directory API (for AJAX loading)
router.get('/api/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'recent', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        created_at,
        profiles:profiles!user_id (
          status,
          reputation,
          glyph_id,
          glyphs:glyph_id (svg_data)
        )
      `, { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1);

    // Apply search filter
    if (search) {
      query = query.ilike('username', `%${search}%`);
    }

    // Apply sorting
    if (sort === 'alphabetical') {
      query = query.order('username', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      users: users || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        hasMore: count > (offset + parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching user directory:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user directory'
    });
  }
});

// Get user profile (public view)
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Get user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        created_at,
        profiles:profiles!user_id (
          status,
          reputation,
          background_image,
          glyph_id,
          district_id,
          glyphs:glyph_id (svg_data, audio_data)
        )
      `)
      .eq('username', username)
      .single();

    if (userError || !user) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    // Get user's posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_encrypted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's glyphs
    const { data: glyphs, error: glyphsError } = await supabase
      .from('glyphs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get user stats
    const { count: postCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: commentCount } = await supabase
      .from('forum_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const data = {
      profileUser: user,
      posts: posts || [],
      glyphs: glyphs || [],
      stats: {
        posts: postCount || 0,
        comments: commentCount || 0,
        reputation: user.profiles?.reputation || 0
      },
      user: req.session.user || null,
      isOwnProfile: req.session.user && req.session.user.id === user.id
    };

    let html = fs.readFileSync(path.join(__dirname, '../views/profile/view.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading user profile:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Get user statistics API
router.get('/api/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get post count
    const { count: postCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get comment count
    const { count: commentCount } = await supabase
      .from('forum_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get glyph count
    const { count: glyphCount } = await supabase
      .from('glyphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get whisper count
    const { count: whisperCount } = await supabase
      .from('whispers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get profile reputation
    const { data: profile } = await supabase
      .from('profiles')
      .select('reputation')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      stats: {
        posts: postCount || 0,
        comments: commentCount || 0,
        glyphs: glyphCount || 0,
        whispers: whisperCount || 0,
        reputation: profile?.reputation || 0
      }
    });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

module.exports = router;

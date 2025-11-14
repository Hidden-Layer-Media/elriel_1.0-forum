// Elriel - Search Routes
// Handles global search functionality across posts, users, whispers, and forum topics

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const supabase = require('../services/db');

// Serve search page
router.get('/', (req, res) => {
  try {
    const data = {
      user: req.session.user || null
    };

    let html = fs.readFileSync(path.join(__dirname, '../views/search/index.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading search page:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Global search API endpoint
router.get('/api', async (req, res) => {
  try {
    const { q, type = 'all', limit = 20, offset = 0 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = q.trim();
    const searchLimit = parseInt(limit);
    const searchOffset = parseInt(offset);

    const results = {
      query: searchTerm,
      users: [],
      posts: [],
      whispers: [],
      forumTopics: [],
      glyphs: []
    };

    // Search users
    if (type === 'all' || type === 'users') {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username, created_at')
        .ilike('username', `%${searchTerm}%`)
        .limit(searchLimit)
        .range(searchOffset, searchOffset + searchLimit - 1);

      if (!usersError) {
        results.users = users || [];
      }
    }

    // Search posts
    if (type === 'all' || type === 'posts') {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          is_encrypted,
          users:user_id (username)
        `)
        .eq('is_encrypted', false)
        .or(`content.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`)
        .limit(searchLimit)
        .range(searchOffset, searchOffset + searchLimit - 1)
        .order('created_at', { ascending: false });

      if (!postsError) {
        results.posts = (posts || []).map(post => ({
          id: post.id,
          content: post.content,
          author: post.users?.username || 'Unknown',
          createdAt: post.created_at
        }));
      }
    }

    // Search whispers
    if (type === 'all' || type === 'whispers') {
      const { data: whispers, error: whispersError } = await supabase
        .from('whispers')
        .select('id, content, created_at')
        .eq('is_encrypted', false)
        .ilike('content', `%${searchTerm}%`)
        .limit(searchLimit)
        .range(searchOffset, searchOffset + searchLimit - 1)
        .order('created_at', { ascending: false });

      if (!whispersError) {
        results.whispers = whispers || [];
      }
    }

    // Search forum topics
    if (type === 'all' || type === 'forum') {
      const { data: topics, error: topicsError } = await supabase
        .from('forum_topics')
        .select(`
          id,
          title,
          description,
          created_at,
          users:user_id (username)
        `)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(searchLimit)
        .range(searchOffset, searchOffset + searchLimit - 1)
        .order('created_at', { ascending: false });

      if (!topicsError) {
        results.forumTopics = (topics || []).map(topic => ({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          author: topic.users?.username || 'Unknown',
          createdAt: topic.created_at
        }));
      }
    }

    // Calculate total results
    const totalResults =
      results.users.length +
      results.posts.length +
      results.whispers.length +
      results.forumTopics.length;

    res.json({
      success: true,
      query: searchTerm,
      totalResults,
      results
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      message: 'Search failed. Terminal error occurred.'
    });
  }
});

// Search users specifically
router.get('/users', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        users: []
      });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        created_at,
        profiles:profiles!user_id (
          status,
          reputation
        )
      `)
      .ilike('username', `%${q.trim()}%`)
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      users: users || []
    });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({
      success: false,
      message: 'User search failed'
    });
  }
});

// Search posts by tags
router.get('/tags/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (username),
        glyphs:glyph_id (svg_data)
      `)
      .eq('is_encrypted', false)
      .ilike('tags', `%${tag}%`)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      tag,
      posts: posts || []
    });
  } catch (err) {
    console.error('Tag search error:', err);
    res.status(500).json({
      success: false,
      message: 'Tag search failed'
    });
  }
});

// Get popular tags
router.get('/tags/popular/list', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get all posts with tags
    const { data: posts, error } = await supabase
      .from('posts')
      .select('tags')
      .not('tags', 'is', null)
      .not('tags', 'eq', '');

    if (error) {
      throw error;
    }

    // Count tag occurrences
    const tagCounts = {};
    posts.forEach(post => {
      if (post.tags) {
        const tags = post.tags.split(',').map(t => t.trim());
        tags.forEach(tag => {
          if (tag) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        });
      }
    });

    // Sort by count and return top tags
    const popularTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      tags: popularTags
    });
  } catch (err) {
    console.error('Popular tags error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular tags'
    });
  }
});

module.exports = router;

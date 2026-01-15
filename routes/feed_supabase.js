// Elriel - Feed Routes (Supabase Version)
// Handles the Bleedstream (global feed) and post management

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabase = require('../services/db');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  next();
};

// Serve Bleedstream page
router.get('/bleedstream', async (req, res) => {
  try {
    // Get tag filter if provided
    const { tag } = req.query;
    
    // Base query
    let query = supabase
      .from('posts')
      .select(`
        *,
        users:user_id (username),
        glyphs:glyph_id (svg_data),
        profiles:user_id (
          district_id,
          districts:district_id (name)
        )
      `)
      .eq('is_encrypted', 0)
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Add tag filter if provided
    if (tag) {
      query = query.ilike('tags', `%${tag}%`);
    }
    
    // Execute query
    const { data: posts, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Format the posts to match the expected structure
    const formattedPosts = posts.map(post => ({
      ...post,
      username: post.users.username,
      glyph_svg: post.glyphs?.svg_data || null,
      district_name: post.profiles?.districts?.name || null
    }));
    
    // Get all tags for filter dropdown
    const { data: tagsResult, error: tagsError } = await supabase
      .from('posts')
      .select('tags')
      .not('tags', 'is', null)
      .not('tags', 'eq', '');
    
    if (tagsError) {
      throw tagsError;
    }
    
    // Extract unique tags
    const allTags = new Set();
    tagsResult.forEach(result => {
      if (result.tags) {
        result.tags.split(',').forEach(tag => {
          allTags.add(tag.trim());
        });
      }
    });
    
    // Pass data to the frontend
    const data = {
      posts: formattedPosts,
      tags: Array.from(allTags),
      currentTag: tag || null,
      user: req.session.user || null
    };
    
    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/feed/bleedstream.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));
    
    res.send(html);
  } catch (err) {
    console.error('Error loading Bleedstream:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Serve new post page
router.get('/new', isAuthenticated, async (req, res) => {
  try {
    // Get user's glyphs
    const { data: glyphs, error } = await supabase
      .from('glyphs')
      .select('*')
      .eq('user_id', req.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // Pass data to the frontend
    const data = {
      glyphs,
      user: req.session.user
    };
    
    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/feed/new-post.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));
    
    res.send(html);
  } catch (err) {
    console.error('Error loading new post page:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Create a new post
router.post('/create', isAuthenticated, async (req, res) => {
  try {
    const { title, content, tags, glyphId, isEncrypted } = req.body;
    
    // Validate input
    if (!title || !content) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Title and content are required.'
      });
    }

    console.log('Validated input for post creation. User ID:', req.session.user.id, 'Title length:', title.length, 'Content length:', content.length);
    
    // Generate encryption key if post is encrypted
    let encryptionKey = null;
    if (isEncrypted === '1' || isEncrypted === true) {
      encryptionKey = crypto.randomBytes(16).toString('hex');
    }
    
    // Insert post
    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        user_id: req.session.user.id,
        title,
        content,
        tags: tags || null,
        is_encrypted: isEncrypted === '1' || isEncrypted === true ? 1 : 0,
        encryption_key: encryptionKey,
        glyph_id: glyphId || null
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }

    console.log('Post inserted successfully. Post ID:', newPost.id, 'Is encrypted:', !!encryptionKey);

    // Return success with post ID and encryption key if applicable
    const response = {
      success: true,
      message: 'Post successfully transmitted to the Bleedstream',
      postId: newPost.id
    };
    
    if (encryptionKey) {
      response.encryptionKey = encryptionKey;
      response.message += '. Save your encryption key to access this post later.';
    }
    
    res.status(201).json(response);
  } catch (err) {
    console.error('Post creation error details:', err.message, err.code, err.details);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// View a specific post
router.get('/post/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { key } = req.query; // Encryption key for encrypted posts
    
    // Get post
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (username),
        glyphs:glyph_id (svg_data)
      `)
      .eq('id', id)
      .single();
    
    if (error || !post) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }
    
    // Format the post to match the expected structure
    const formattedPost = {
      ...post,
      username: post.users.username,
      glyph_svg: post.glyphs?.svg_data || null
    };
    
    // Check if post is encrypted and key is provided
    if (post.is_encrypted === 1 && post.encryption_key !== key) {
      // Serve the encrypted post view that prompts for key
      let html = fs.readFileSync(path.join(__dirname, '../views/feed/encrypted-post.html'), 'utf8');
      html = html.replace('__POST_ID__', id);
      return res.send(html);
    }
    
    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        districts:district_id (name)
      `)
      .eq('user_id', post.user_id)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    // Format the profile to match the expected structure
    const profile = {
      ...profileData,
      district_name: profileData.districts?.name || null
    };
    
    // Get comments
    const { data: comments, error: commentsError } = await supabase
      .from('post_comments')
      .select(`
        *,
        users:user_id (username)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      throw commentsError;
    }

    const formattedComments = comments.map(comment => ({
      ...comment,
      username: comment.users.username
    }));

    // Get likes count
    const { data: likes, error: likesError } = await supabase
      .from('post_likes')
      .select('type')
      .eq('post_id', id);

    if (likesError) {
      throw likesError;
    }

    const likeCount = likes.filter(l => l.type === 'like').length;
    const dislikeCount = likes.filter(l => l.type === 'dislike').length;

    // Check if current user liked
    let userLike = null;
    if (req.session.user) {
      const { data: userLikeData } = await supabase
        .from('post_likes')
        .select('type')
        .eq('post_id', id)
        .eq('user_id', req.session.user.id)
        .single();

      userLike = userLikeData?.type || null;
    }

    // Pass data to the frontend
    const data = {
      post: formattedPost,
      profile,
      comments: formattedComments,
      likes: likeCount,
      dislikes: dislikeCount,
      userLike,
      user: req.session.user || null,
      isOwner: req.session.user && req.session.user.id === post.user_id
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/feed/view-post.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error viewing post:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Delete a post
router.delete('/post/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if post exists and belongs to user
    const { data: post, error: getError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.session.user.id)
      .single();
    
    if (getError || !post) {
      return res.status(404).json({ 
        error: 'Post not found', 
        message: 'The requested post does not exist or does not belong to you.' 
      });
    }
    
    // Delete post
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    res.json({ 
      success: true, 
      message: 'Post successfully erased from the Bleedstream' 
    });
  } catch (err) {
    console.error('Post delete error:', err);
    res.status(500).json({ 
      error: 'System error', 
      message: 'Terminal connection unstable. Try again later.' 
    });
  }
});

// Check encryption key for encrypted post
router.post('/check-key/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Encryption key is required.'
      });
    }

    // Check if key is valid
    const { data: post, error } = await supabase
      .from('posts')
      .select('encryption_key')
      .eq('id', id)
      .eq('is_encrypted', 1)
      .single();

    if (error || !post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist or is not encrypted.'
      });
    }

    if (post.encryption_key !== key) {
      return res.status(401).json({
        error: 'Invalid key',
        message: 'The provided encryption key is invalid.'
      });
    }

    // Key is valid, redirect to post with key
    res.json({
      success: true,
      redirectUrl: `/feed/post/${id}?key=${key}`
    });
  } catch (err) {
    console.error('Check encryption key error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Get comments for a post
router.get('/post/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        users:user_id (username)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const formattedComments = comments.map(comment => ({
      ...comment,
      username: comment.users.username
    }));

    res.json({ comments: formattedComments });
  } catch (err) {
    console.error('Error getting comments:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Add comment to a post
router.post('/post/:id/comments', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Comment content is required.'
      });
    }

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist.'
      });
    }

    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: id,
        user_id: req.session.user.id,
        content: content.trim()
      })
      .select(`
        *,
        users:user_id (username)
      `)
      .single();

    if (error) {
      throw error;
    }

    const formattedComment = {
      ...comment,
      username: comment.users.username
    };

    res.status(201).json({
      success: true,
      comment: formattedComment
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Delete comment
router.delete('/post/:postId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    // Check if comment exists and belongs to user
    const { data: comment, error: getError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('id', commentId)
      .eq('user_id', req.session.user.id)
      .single();

    if (getError || !comment) {
      return res.status(404).json({
        error: 'Comment not found',
        message: 'The requested comment does not exist or does not belong to you.'
      });
    }

    // Delete comment
    const { error: deleteError } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Like or dislike a post
router.post('/post/:id/like', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'like' or 'dislike'

    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Type must be like or dislike.'
      });
    }

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist.'
      });
    }

    // Check if user already liked/disliked
    const { data: existingLike, error: likeError } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', id)
      .eq('user_id', req.session.user.id)
      .single();

    if (likeError && likeError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw likeError;
    }

    if (existingLike) {
      if (existingLike.type === type) {
        // Remove the like/dislike
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) {
          throw deleteError;
        }

        res.json({
          success: true,
          action: 'removed',
          type
        });
      } else {
        // Update to new type
        const { error: updateError } = await supabase
          .from('post_likes')
          .update({ type })
          .eq('id', existingLike.id);

        if (updateError) {
          throw updateError;
        }

        res.json({
          success: true,
          action: 'updated',
          type
        });
      }
    } else {
      // Add new like/dislike
      const { error: insertError } = await supabase
        .from('post_likes')
        .insert({
          post_id: id,
          user_id: req.session.user.id,
          type
        });

      if (insertError) {
        throw insertError;
      }

      res.json({
        success: true,
        action: 'added',
        type
      });
    }
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Get likes count for a post
router.get('/post/:id/likes', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: likes, error } = await supabase
      .from('post_likes')
      .select('type')
      .eq('post_id', id);

    if (error) {
      throw error;
    }

    const likeCount = likes.filter(l => l.type === 'like').length;
    const dislikeCount = likes.filter(l => l.type === 'dislike').length;

    // Check if current user liked
    let userLike = null;
    if (req.session.user) {
      const { data: userLikeData } = await supabase
        .from('post_likes')
        .select('type')
        .eq('post_id', id)
        .eq('user_id', req.session.user.id)
        .single();

      userLike = userLikeData?.type || null;
    }

    res.json({
      likes: likeCount,
      dislikes: dislikeCount,
      userLike
    });
  } catch (err) {
    console.error('Error getting likes:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

module.exports = router;
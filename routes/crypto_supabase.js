// Elriel - Crypto Routes (Supabase Version)
// Handles encryption and decryption of messages

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabase = require('../services/db');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to use encryption features.'
    });
  }
  next();
};

// Generate a random key for encryption
const generateKey = (length = 16) => {
  return crypto.randomBytes(length).toString('hex');
};

// Encrypt a message using AES-256-GCM
const encryptMessage = (message, key) => {
  try {
    // Create a unique initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      iv
    );

    // Encrypt the message
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the auth tag
    const authTag = cipher.getAuthTag().toString('hex');

    // Return the encrypted data, iv, and auth tag
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};

// Decrypt a message using AES-256-GCM
const decryptMessage = (encrypted, iv, authTag, key) => {
  try {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex')
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message. Incorrect key or corrupted data.');
  }
};

// Serve crypto exchange page
router.get('/', (req, res) => {
  try {
    const data = {
      user: req.session.user || null
    };

    let html = fs.readFileSync(path.join(__dirname, '../views/crypto/index.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading crypto exchange:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Encrypt a message
router.post('/encrypt', isAuthenticated, async (req, res) => {
  try {
    const { message, recipientId, publicHint } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Message is required'
      });
    }

    // Generate encryption key
    const encryptionKey = generateKey();

    // Encrypt the message
    const encryptedData = encryptMessage(message, encryptionKey);

    // Store encrypted message in database
    const { data: encryptedPost, error } = await supabase
      .from('posts')
      .insert({
        user_id: req.session.user.id,
        content: encryptedData.encrypted,
        encryption_key: encryptedData.iv,
        encryption_auth_tag: encryptedData.authTag,
        is_encrypted: true,
        recipient_id: recipientId || null,
        public_hint: publicHint || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Message encrypted successfully',
      postId: encryptedPost.id,
      encryptionKey: encryptionKey,
      encryptedData: {
        encrypted: encryptedData.encrypted,
        iv: encryptedData.iv,
        authTag: encryptedData.authTag
      }
    });
  } catch (err) {
    console.error('Encryption error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Encryption failed. Try again later.'
    });
  }
});

// Decrypt a message
router.post('/decrypt', isAuthenticated, async (req, res) => {
  try {
    const { postId, encryptionKey } = req.body;

    if (!postId || !encryptionKey) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Post ID and encryption key are required'
      });
    }

    // Get encrypted post
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('is_encrypted', true)
      .single();

    if (error || !post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'Encrypted post not found'
      });
    }

    // Check if user has permission to decrypt
    // Allow if: owner, recipient, or admin
    const hasPermission =
      post.user_id === req.session.user.id ||
      post.recipient_id === req.session.user.id ||
      req.session.user.is_admin;

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to decrypt this message'
      });
    }

    // Decrypt the message
    const decrypted = decryptMessage(
      post.content,
      post.encryption_key,
      post.encryption_auth_tag,
      encryptionKey
    );

    res.json({
      success: true,
      message: 'Message decrypted successfully',
      decryptedContent: decrypted,
      publicHint: post.public_hint
    });
  } catch (err) {
    console.error('Decryption error:', err);
    res.status(500).json({
      error: 'Decryption failed',
      message: err.message || 'Could not decrypt message. Check your key.'
    });
  }
});

// Generate a new encryption key
router.get('/generate-key', isAuthenticated, (req, res) => {
  try {
    const key = generateKey();
    res.json({
      success: true,
      key: key
    });
  } catch (err) {
    console.error('Key generation error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to generate key'
    });
  }
});

// Get user's encrypted messages
router.get('/messages', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get encrypted posts where user is sender or recipient
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (username)
      `)
      .eq('is_encrypted', true)
      .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Format posts
    const formattedPosts = posts.map(post => ({
      id: post.id,
      sender: post.users.username,
      senderId: post.user_id,
      recipientId: post.recipient_id,
      publicHint: post.public_hint,
      createdAt: post.created_at,
      isSender: post.user_id === userId
    }));

    res.json({
      success: true,
      messages: formattedPosts
    });
  } catch (err) {
    console.error('Error fetching encrypted messages:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to fetch encrypted messages'
    });
  }
});

module.exports = router;

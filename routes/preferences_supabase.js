// Elriel - User Preferences Routes (Supabase Version)
// Handles user customization preferences for Bleedstream

const express = require('express');
const router = express.Router();
const supabase = require('../services/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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

// Configure background image upload (memory for Supabase storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG and GIF images are allowed'), false);
    }
    cb(null, true);
  }
});

// Get user preferences
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get user preferences
    const { data: user, error } = await supabase
      .from('users')
      .select('username, theme, background_image, font_size, font_color')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User preferences not found'
      });
    }

    // Format preferences for response
    const preferences = {
      username: user.username,
      theme: user.theme || 'default',
      backgroundImage: user.background_image || null,
      fontSize: user.font_size || 'medium',
      fontColor: user.font_color || 'black'
    };

    // Get available themes
    const availableThemes = [
      { id: 'default', name: 'Default Terminal', description: 'The standard Elriel terminal theme' },
      { id: 'cyberpunk', name: 'Cyberpunk Neon', description: 'High contrast neon colors on dark background' },
      { id: 'win98', name: 'Windows 98', description: 'Retro computing aesthetic' },
      { id: 'glitch', name: 'Glitch', description: 'Distorted digital artifacts with scan lines' },
      { id: 'vaporwave', name: 'Vaporwave', description: 'Pastel colors with 90s internet vibes' }
    ];

    // Get font size options
    const fontSizeOptions = [
      { id: 'small', name: 'Small' },
      { id: 'medium', name: 'Medium' },
      { id: 'large', name: 'Large' },
      { id: 'x-large', name: 'Extra Large' }
    ];

    res.json({
      success: true,
      preferences,
      availableThemes,
      fontSizeOptions
    });
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to fetch preferences'
    });
  }
});

// Update user preferences
router.put('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { theme, fontSize, fontColor } = req.body;

    // Validate inputs
    const validThemes = ['default', 'cyberpunk', 'win98', 'glitch', 'vaporwave'];
    const validFontSizes = ['small', 'medium', 'large', 'x-large'];

    const updates = {};

    if (theme && validThemes.includes(theme)) {
      updates.theme = theme;
    }

    if (fontSize && validFontSizes.includes(fontSize)) {
      updates.font_size = fontSize;
    }

    if (fontColor) {
      // Basic hex color validation
      if (/^#[0-9A-F]{6}$/i.test(fontColor)) {
        updates.font_color = fontColor;
      }
    }

    // Update user preferences
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      updates
    });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to update preferences'
    });
  }
});

// Upload background image
router.post('/background', isAuthenticated, upload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a background image'
      });
    }

    const userId = req.session.user.id;
    const timestamp = Date.now();
    const extension = path.extname(req.file.originalname);
    const fileName = `backgrounds/bg-${timestamp}-${userId}${extension}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(fileName);

    // Update user's background image URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ background_image: urlData.publicUrl })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      message: 'Background image uploaded successfully',
      backgroundUrl: urlData.publicUrl
    });
  } catch (err) {
    console.error('Error uploading background:', err);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload background image'
    });
  }
});

// Delete background image
router.delete('/background', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get current background URL
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('background_image')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Remove background image reference
    const { error: updateError } = await supabase
      .from('users')
      .update({ background_image: null })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Optionally delete from storage (extract filename from URL)
    if (user.background_image) {
      try {
        const urlParts = user.background_image.split('/');
        const fileName = urlParts.slice(-2).join('/'); // backgrounds/bg-...
        await supabase.storage
          .from('user-uploads')
          .remove([fileName]);
      } catch (storageError) {
        console.warn('Failed to delete from storage:', storageError);
        // Don't fail the request if storage deletion fails
      }
    }

    res.json({
      success: true,
      message: 'Background image removed successfully'
    });
  } catch (err) {
    console.error('Error removing background:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to remove background image'
    });
  }
});

// Add user interest
router.post('/interests', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { tag, districtId, glyphId } = req.body;

    if (!tag && !districtId && !glyphId) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'At least one interest type is required'
      });
    }

    // Insert user interest
    const { data, error } = await supabase
      .from('user_interests')
      .insert({
        user_id: userId,
        tag: tag || null,
        district_id: districtId || null,
        glyph_id: glyphId || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Interest added successfully',
      interest: data
    });
  } catch (err) {
    console.error('Error adding interest:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to add interest'
    });
  }
});

// Get user interests
router.get('/interests', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { data: interests, error } = await supabase
      .from('user_interests')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      interests: interests || []
    });
  } catch (err) {
    console.error('Error fetching interests:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to fetch interests'
    });
  }
});

// Delete user interest
router.delete('/interests/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    // Delete interest (only if it belongs to user)
    const { error } = await supabase
      .from('user_interests')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Interest removed successfully'
    });
  } catch (err) {
    console.error('Error removing interest:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to remove interest'
    });
  }
});

module.exports = router;

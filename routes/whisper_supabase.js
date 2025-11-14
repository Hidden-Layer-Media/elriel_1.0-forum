// Elriel - Whisper Routes (Supabase Version)
// Handles the Whisperboard for anonymous messages

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabase = require('../services/db');

// Serve Whisperboard page
router.get('/board', async (req, res) => {
  try {
    // Get recent whispers with glyph data
    const { data: whispers, error } = await supabase
      .from('whispers')
      .select(`
        *,
        glyphs:glyph_id (svg_data)
      `)
      .eq('is_encrypted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Format whispers to match expected structure
    const formattedWhispers = whispers.map(w => ({
      ...w,
      glyph_svg: w.glyphs?.svg_data || null
    }));

    // Pass data to the frontend
    const data = {
      whispers: formattedWhispers,
      user: req.session.user || null
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/whisper/board.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading Whisperboard:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Serve new whisper page
router.get('/new', async (req, res) => {
  try {
    // Get user's glyphs if logged in
    let glyphs = [];
    if (req.session.user) {
      const { data, error } = await supabase
        .from('glyphs')
        .select('*')
        .eq('user_id', req.session.user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        glyphs = data || [];
      }
    }

    // Pass data to the frontend
    const data = {
      glyphs,
      user: req.session.user || null
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/whisper/new.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading new whisper page:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Create a new whisper
router.post('/create', async (req, res) => {
  try {
    const { content, glyphId, isEncrypted } = req.body;

    // Validate input
    if (!content) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Whisper content is required.'
      });
    }

    // Check if glyph belongs to user if provided
    if (glyphId && req.session.user) {
      const { data: glyph, error } = await supabase
        .from('glyphs')
        .select('*')
        .eq('id', glyphId)
        .eq('user_id', req.session.user.id)
        .single();

      if (error || !glyph) {
        return res.status(404).json({
          error: 'Glyph not found',
          message: 'The requested glyph does not exist or does not belong to you.'
        });
      }
    } else if (glyphId && !req.session.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to attach a glyph to your whisper.'
      });
    }

    // Create whisper
    const whisperData = {
      content,
      glyph_id: glyphId || null,
      is_encrypted: isEncrypted === 'true' || isEncrypted === true,
      user_id: req.session.user ? req.session.user.id : null
    };

    const { data: whisper, error } = await supabase
      .from('whispers')
      .insert(whisperData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Whisper echoed into the void',
      whisperId: whisper.id
    });
  } catch (err) {
    console.error('Whisper creation error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Whisperboard malfunction. Try again later.'
    });
  }
});

// View a specific whisper
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get whisper with glyph data
    const { data: whisper, error } = await supabase
      .from('whispers')
      .select(`
        *,
        glyphs:glyph_id (svg_data, audio_data)
      `)
      .eq('id', id)
      .single();

    if (error || !whisper) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    // Format whisper
    const formattedWhisper = {
      ...whisper,
      glyph_svg: whisper.glyphs?.svg_data || null,
      glyph_audio: whisper.glyphs?.audio_data || null
    };

    // Check if user is the owner
    const isOwner = req.session.user && whisper.user_id && req.session.user.id === whisper.user_id;

    // Pass data to the frontend
    const data = {
      whisper: formattedWhisper,
      user: req.session.user || null,
      isOwner
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/whisper/view.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error viewing whisper:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Delete a whisper (only if user owns it)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    // Check if whisper exists and belongs to user
    const { data: whisper, error: fetchError } = await supabase
      .from('whispers')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.session.user.id)
      .single();

    if (fetchError || !whisper) {
      return res.status(404).json({
        error: 'Whisper not found',
        message: 'The requested whisper does not exist or does not belong to you.'
      });
    }

    // Delete whisper
    const { error: deleteError } = await supabase
      .from('whispers')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Whisper faded from the void'
    });
  } catch (err) {
    console.error('Whisper delete error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Whisperboard malfunction. Try again later.'
    });
  }
});

module.exports = router;

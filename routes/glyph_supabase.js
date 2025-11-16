// Elriel - Glyph Routes (Supabase Version)
// Handles the Glyph Crucible for procedural sigil generation

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

// Serve Glyph Crucible page
router.get('/crucible', async (req, res) => {
  try {
    // Get user's saved glyphs if logged in
    let userGlyphs = [];
    if (req.session.user) {
      const { data, error } = await supabase
        .from('glyphs')
        .select('*')
        .eq('user_id', req.session.user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        userGlyphs = data || [];
      }
    }

    // Pass data to the frontend
    const data = {
      user: req.session.user || null,
      userGlyphs
    };

    // Check what mode is requested
    const mode = req.query.mode || 'normal';

    // Choose template based on mode parameter
    let templatePath;
    if (mode === 'extreme') {
      templatePath = '../views/glyph/crucible-extreme.html';
    } else if (mode === 'enhanced' || req.query.enhanced === '1' || req.query.enhanced === 'true') {
      templatePath = '../views/glyph/crucible-enhanced.html';
    } else {
      templatePath = '../views/glyph/crucible.html';
    }

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, templatePath), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading Glyph Crucible:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Serve Enhanced Glyph Crucible page
router.get('/crucible-3d', async (req, res) => {
  try {
    // Get user's saved glyphs if logged in
    let userGlyphs = [];
    if (req.session.user) {
      const { data, error } = await supabase
        .from('glyphs')
        .select('*')
        .eq('user_id', req.session.user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        userGlyphs = data || [];
      }
    }

    // Pass data to the frontend
    const data = {
      user: req.session.user || null,
      userGlyphs
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/glyph/crucible-enhanced.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading Enhanced Glyph Crucible:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Test endpoint to check if the server is responding
router.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ success: true, message: 'Glyph test endpoint is working' });
});

// Generate a new glyph - Database-independent endpoint
router.post('/generate', (req, res) => {
  console.log('Received glyph generation request:', req.body);
  try {
    const { seed, complexity } = req.body;
    console.log('Processing with seed:', seed, 'and complexity:', complexity);

    // Generate a random seed if not provided
    const glyphSeed = seed || crypto.randomBytes(16).toString('hex');
    console.log('Using seed:', glyphSeed);

    // Generate SVG data based on the seed
    console.log('Generating SVG data...');
    const svgData = generateGlyphSVG(glyphSeed, complexity || 'medium');
    console.log('SVG data generated successfully');

    // Generate audio data based on the seed
    console.log('Generating audio data...');
    const audioData = generateGlyphAudio(glyphSeed, complexity || 'medium');
    console.log('Audio data generated successfully');

    // Return the generated glyph
    console.log('Sending successful response');
    res.json({
      success: true,
      glyph: {
        seed: glyphSeed,
        svgData,
        audioData
      }
    });
  } catch (err) {
    console.error('Glyph generation error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      error: 'System error',
      message: 'Crucible malfunction. Try again later.'
    });
  }
});

// Save a generated glyph
router.post('/save', isAuthenticated, async (req, res) => {
  try {
    const {
      svgData,
      audioData,
      seed,
      glyphShape = 'standard',
      glyphColor = '#00ff00',
      glyph3dModel = null
    } = req.body;

    if (!svgData) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'No glyph data provided.'
      });
    }

    // Insert glyph into database with enhanced properties
    const { data: glyph, error } = await supabase
      .from('glyphs')
      .insert({
        user_id: req.session.user.id,
        svg_data: svgData,
        audio_data: audioData,
        seed: seed,
        glyph_shape: glyphShape,
        glyph_color: glyphColor,
        glyph_3d_model: glyph3dModel
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Award reputation for creating a sigil
    await supabase
      .from('profiles')
      .update({ reputation: supabase.raw('reputation + 1') })
      .eq('user_id', req.session.user.id);

    res.status(201).json({
      success: true,
      message: 'Glyph saved to your collection',
      glyphId: glyph.id
    });
  } catch (err) {
    console.error('Glyph save error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Crucible malfunction. Try again later.'
    });
  }
});

// View a specific glyph
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get glyph
    const { data: glyph, error } = await supabase
      .from('glyphs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !glyph) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    // Get glyph owner
    let owner = null;
    if (glyph.user_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', glyph.user_id)
        .single();

      if (!userError) {
        owner = userData;
      }
    }

    // Pass data to the frontend
    const data = {
      glyph,
      owner,
      user: req.session.user || null,
      isOwner: req.session.user && req.session.user.id === glyph.user_id
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/glyph/view.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error viewing glyph:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Delete a glyph
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if glyph exists and belongs to user
    const { data: glyph, error: fetchError } = await supabase
      .from('glyphs')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.session.user.id)
      .single();

    if (fetchError || !glyph) {
      return res.status(404).json({
        error: 'Glyph not found',
        message: 'The requested glyph does not exist or does not belong to you.'
      });
    }

    // Check if this is the profile glyph and remove it if so
    await supabase
      .from('profiles')
      .update({ glyph_id: null })
      .eq('glyph_id', id);

    // Delete glyph
    const { error: deleteError } = await supabase
      .from('glyphs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Glyph successfully erased from the system'
    });
  } catch (err) {
    console.error('Glyph delete error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Deterministic random number generator based on a seed
function seedRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }

  // Simple LCG random number generator
  let state = hash;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Helper function to generate SVG data for a glyph
function generateGlyphSVG(seed, complexity) {
  // Create a deterministic random number generator based on the seed
  const random = seedRandom(seed);

  // Set complexity parameters
  let numPoints, numLines, numCircles;
  switch (complexity) {
    case 'low':
      numPoints = 5 + Math.floor(random() * 5);
      numLines = 4 + Math.floor(random() * 4);
      numCircles = 1 + Math.floor(random() * 2);
      break;
    case 'high':
      numPoints = 15 + Math.floor(random() * 10);
      numLines = 12 + Math.floor(random() * 8);
      numCircles = 3 + Math.floor(random() * 4);
      break;
    case 'medium':
    default:
      numPoints = 10 + Math.floor(random() * 5);
      numLines = 8 + Math.floor(random() * 4);
      numCircles = 2 + Math.floor(random() * 2);
      break;
  }

  // Generate SVG elements
  const width = 300;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;

  // Generate points
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = random() * Math.PI * 2;
    const distance = 30 + random() * (centerX - 40);
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    points.push({ x, y });
  }

  // Start SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="glyph-svg">`;

  // Add a background circle
  svg += `<circle cx="${centerX}" cy="${centerY}" r="${centerX - 10}" fill="none" stroke="#333" stroke-width="2" />`;

  // Add lines
  for (let i = 0; i < numLines && points.length > 0; i++) {
    const startPointIndex = Math.floor(random() * points.length);
    const endPointIndex = Math.floor(random() * points.length);

    const startPoint = points[startPointIndex];
    const endPoint = points[endPointIndex];

    if (startPoint && endPoint) {
      svg += `<line x1="${startPoint.x}" y1="${startPoint.y}" x2="${endPoint.x}" y2="${endPoint.y}" stroke="#c0c0c0" stroke-width="1.5" />`;
    }
  }

  // Add circles
  for (let i = 0; i < numCircles && points.length > 0; i++) {
    const centerPointIndex = Math.floor(random() * points.length);
    const centerPoint = points[centerPointIndex];

    if (centerPoint) {
      const radius = 5 + random() * 20;
      svg += `<circle cx="${centerPoint.x}" cy="${centerPoint.y}" r="${radius}" fill="none" stroke="#a0a0a0" stroke-width="1" />`;
    }
  }

  // Add points
  for (const point of points) {
    svg += `<circle cx="${point.x}" cy="${point.y}" r="2" fill="#ffffff" />`;
  }

  // Add glitch effects
  const numGlitches = Math.floor(random() * 5) + 2;
  for (let i = 0; i < numGlitches; i++) {
    const x = random() * width;
    const y = random() * height;
    const rectWidth = 10 + random() * 40;
    const rectHeight = 2 + random() * 5;
    svg += `<rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" fill="#8a2be2" opacity="${0.1 + random() * 0.3}" />`;
  }

  // Close SVG
  svg += '</svg>';

  return svg;
}

// Helper function to generate audio data for a glyph
function generateGlyphAudio(seed, complexity) {
  // Create a deterministic random number generator based on the seed
  const random = seedRandom(seed);

  // Generate audio parameters
  // This would be a JSON representation of audio parameters
  // In a real implementation, this would be used to generate actual audio
  const audioData = {
    baseFrequency: 220 + Math.floor(random() * 220),
    harmonics: [],
    duration: 3 + random() * 2,
    waveform: ['sine', 'square', 'sawtooth', 'triangle'][Math.floor(random() * 4)]
  };

  // Add harmonics based on complexity
  const numHarmonics = complexity === 'low' ? 3 : (complexity === 'medium' ? 5 : 8);
  for (let i = 0; i < numHarmonics; i++) {
    audioData.harmonics.push({
      frequency: audioData.baseFrequency * (i + 1 + random()),
      amplitude: 0.1 + random() * 0.5,
      attack: 0.01 + random() * 0.2,
      decay: 0.1 + random() * 0.3,
      sustain: 0.2 + random() * 0.5,
      release: 0.1 + random() * 0.5
    });
  }

  return JSON.stringify(audioData);
}

module.exports = router;

// Elriel - Profile Routes (Supabase Version)
// Handles user profile viewing and editing

const escapeHTML = require('escape-html');
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const supabase = require('../services/db');

// Configure file uploads for profile backgrounds
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/uploads/backgrounds';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'bg-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Configure avatar upload to memory for Supabase storage
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for avatars
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  next();
};

// Serve profile dashboard
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Get user profile with join
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, users(username)')
      .eq('user_id', req.session.user.id)
      .single();

    if (error || !profile) {
      // Create default profile if it doesn't exist
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: req.session.user.id, status: 'New terminal connected' })
        .select('*, users(username)')
        .eq('user_id', req.session.user.id)
        .single();

      if (insertError) {
        throw insertError;
      }

      // Use the newly created profile
      profile = newProfile;
    }

    // Get user's glyph if it exists
    let glyph = null;
    if (profile.glyph_id) {
      const { data, error: glyphError } = await supabase
        .from('glyphs')
        .select('*')
        .eq('id', profile.glyph_id)
        .single();
      if (!glyphError) {
        glyph = data;
      }
    }

    // Get user's posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', req.session.user.id)
      .order('created_at', { ascending: false });

    if (postsError) {
      throw postsError;
    }

    // Get user's profile containers (always for dashboard)
    let containers = [];
    const { data: containersData, error: containersError } = await supabase
      .from('profile_containers')
      .select('*')
      .eq('profile_id', profile.id)
      .order('position', { ascending: true });

    if (!containersError) {
      containers = containersData || [];
    }

    // Group containers by zone
    const groupedContainers = {
      sidebar: containers.filter(c => c.zone === 'sidebar').sort((a, b) => a.position - b.position),
      mainLeft: containers.filter(c => c.zone === 'main-left').sort((a, b) => a.position - b.position),
      mainRight: containers.filter(c => c.zone === 'main-right').sort((a, b) => a.position - b.position)
    };

    console.log('Dashboard fetched grouped containers:', groupedContainers);

    // Pass data to the frontend
    const data = {
      profile,
      glyph,
      posts,
      groupedContainers,
      user: req.session.user
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/profile/dashboard.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading profile:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// View a user's profile
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const useEnhanced = req.query.enhanced === '1' || req.query.enhanced === 'true';

    // Get user and profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, users!inner(username, id)')
      .eq('users.username', username)
      .single();

    if (error || !profile) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    // Get user's glyph if it exists
    let glyph = null;
    if (profile.glyph_id) {
      const { data, error: glyphError } = await supabase
        .from('glyphs')
        .select('*')
        .eq('id', profile.glyph_id)
        .single();
      if (!glyphError) {
        glyph = data;
      }
    }

    // Get user's posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', profile.users.id)
      .order('created_at', { ascending: false });

    if (postsError) {
      throw postsError;
    }

    // Get user's profile containers if enhanced view
    let containers = [];
    let groupedContainers = {};
    if (useEnhanced) {
      const { data, error: containersError } = await supabase
        .from('profile_containers')
        .select('*')
        .eq('profile_id', profile.id)
        .order('position', { ascending: true });
      if (!containersError) {
        containers = data || [];
        // Group containers by zone
        groupedContainers = {
          sidebar: containers.filter(c => c.zone === 'sidebar').sort((a, b) => a.position - b.position),
          mainLeft: containers.filter(c => c.zone === 'main-left').sort((a, b) => a.position - b.position),
          mainRight: containers.filter(c => c.zone === 'main-right').sort((a, b) => a.position - b.position)
        };
        console.log('Profile view fetched grouped containers:', groupedContainers);
      }
    }

    // Get user's rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('user_rewards')
      .select('*, repute_rewards(*)')
      .eq('user_id', profile.users.id);

    if (rewardsError) {
      throw rewardsError;
    }

    // Pass data to the frontend
    const data = {
      profile,
      glyph,
      posts,
      containers,
      groupedContainers,
      rewards,
      user: req.session.user || null,
      isOwner: req.session.user && req.session.user.id === profile.users.id
    };

    // Determine which template to use
    const templatePath = useEnhanced ?
      '../views/profile/view-enhanced.html' :
      '../views/profile/view.html';

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, templatePath), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error viewing profile:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Enhanced profile view
router.get('/enhanced', isAuthenticated, (req, res) => {
  res.redirect(`/profile/user/${req.session.user.username}?enhanced=1`);
});

// Activity log page
router.get('/activity', isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('user_activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.session.user.id);

    if (countError) {
      throw countError;
    }

    const totalPages = Math.ceil(totalCount / perPage);

    // Get activities for current page
    const { data: activities, error: activitiesError } = await supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', req.session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (activitiesError) {
      throw activitiesError;
    }

    // Pass data to the frontend
    const data = {
      activities,
      totalPages,
      currentPage: page,
      username: req.session.user.username,
      user: req.session.user
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/profile/activity.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading activity log:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Container edit page - new container
router.get('/container/edit', isAuthenticated, async (req, res) => {
  try {
    // Pass data to the frontend for a new container
    const data = {
      container: null,
      user: req.session.user
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/profile/container-edit.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading container editor:', err);
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Container edit page - edit existing container
router.get('/container/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    let container = null;

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', req.session.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    // Get container and verify ownership
    const { data: containerData, error: containerError } = await supabase
      .from('profile_containers')
      .select('*')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .single();

    if (containerError || !containerData) {
      return res.status(404).sendFile(path.join(__dirname, '../views/404.html'));
    }

    container = containerData;

    // Pass data to the frontend
    const data = {
      container,
      user: req.session.user
    };

    // Inject data into the HTML
    let html = fs.readFileSync(path.join(__dirname, '../views/profile/container-edit.html'), 'utf8');
    html = html.replace('__DATA__', JSON.stringify(data));

    res.send(html);
  } catch (err) {
    console.error('Error loading container editor:', err);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Serve profile edit page
router.get('/edit', isAuthenticated, async (req, res) => {
  try {
    console.log('Loading profile edit for user ID:', req.session.user.id);
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, users(username)')
      .eq('user_id', req.session.user.id)
      .single();

    console.log('Profile query result - data exists:', !!profile, 'error:', profileError ? profileError.message : 'None');

    // Get user's profile containers
    let containers = [];
    const { data: containersData, error: containersError } = await supabase
      .from('profile_containers')
      .select('*')
      .eq('profile_id', profile.id)
      .order('position', { ascending: true });

    if (!containersError) {
      containers = containersData || [];
    }

    // Group containers by zone
    const groupedContainers = {
      sidebar: containers.filter(c => c.zone === 'sidebar').sort((a, b) => a.position - b.position),
      mainLeft: containers.filter(c => c.zone === 'main-left').sort((a, b) => a.position - b.position),
      mainRight: containers.filter(c => c.zone === 'main-right').sort((a, b) => a.position - b.position)
    };

    console.log('Edit page fetched grouped containers:', groupedContainers);

    if (profileError || !profile) {
      // Create default profile if it doesn't exist
      console.log('Creating default profile for user ID:', req.session.user.id);
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: req.session.user.id, status: 'New terminal connected' })
        .select('*, users(username)')
        .eq('user_id', req.session.user.id)
        .single();

      if (insertError) {
        console.error('Default profile creation error:', insertError);
        throw insertError;
      }

      // Use the newly created profile
      profile = newProfile;
      console.log('Default profile created successfully');
    }

    // Get user's glyph if it exists
    let glyph = null;
    if (profile.glyph_id) {
      const { data, error: glyphError } = await supabase
        .from('glyphs')
        .select('*')
        .eq('id', profile.glyph_id)
        .single();
      if (!glyphError) {
        glyph = data;
      }
    }
    // Get all districts
    let districts = [];
    try {
      const { data: districtsData, error: districtsError } = await supabase
        .from('districts')
        .select('*')
        .or(`is_hidden.eq.false,id.eq.${profile.district_id || 1}`);

      if (districtsError) {
        console.error('Districts query error:', districtsError);
        districts = [{ id: 1, name: 'Central District', is_hidden: false }];
      } else {
        districts = districtsData || [];
      }
    } catch (err) {
      console.error('Error loading districts:', err);
      districts = [{ id: 1, name: 'Central District', is_hidden: false }];
    }

    // Ensure at least one district exists
    if (districts.length === 0) {
      districts = [{ id: 1, name: 'Central District', is_hidden: false }];
    }

    // Get user's glyphs for selection
    let userGlyphs = [];
    try {
      const { data: glyphsData, error: glyphsError } = await supabase
        .from('glyphs')
        .select('*')
        .eq('user_id', req.session.user.id);
      if (!glyphsError && Array.isArray(glyphsData)) {
        userGlyphs = glyphsData;
      }
    } catch (err) {
      console.error('Error loading user glyphs:', err);
      userGlyphs = [];
    }

    // Ensure all expected keys exist in profile
    const safeProfile = {
      status: profile.status || '',
      custom_css: profile.custom_css || '',
      custom_html: profile.custom_html || '',
      blog_layout: profile.blog_layout || 'feed',
      district_id: profile.district_id || 1,
      background_image: profile.background_image || '',
      header_image: profile.header_image || '',
      theme_template: profile.theme_template || 'default',
      glyph_id: profile.glyph_id || null,
      glyph_3d: profile.glyph_3d || false,
      glyph_rotation_speed: profile.glyph_rotation_speed || 3,
      widgets_data: profile.widgets_data || '[]',
      avatar_url: profile.avatar_url || '',
      bio: profile.bio || '',
      layout_type: profile.layout_type || 'two-column',
      sidebar_config: profile.sidebar_config || '{}',
      main_content: profile.main_content || '[]',
      ...profile
    };

    console.log('Edit page fetched profile with new fields:', safeProfile);

    // Pass data to the frontend
    const data = {
      profile: safeProfile,
      glyph,
      districts,
      user: req.session.user,
      userGlyphs,
      groupedContainers
    };

    // Inject data into the HTML
    console.log('Reading edit.html template and injecting data');
    const jsonData = JSON.stringify(data);
    let html = fs.readFileSync(path.join(__dirname, '../views/profile/edit.html'), 'utf8');
    console.log('Data JSON length:', jsonData.length);
    html = html.replace('__DATA__', jsonData);

    res.send(html);
  } catch (err) {
    console.error('Error loading profile editor details:', {
      message: err.message,
      stack: err.stack,
      userId: req.session.user.id
    });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).sendFile(path.join(__dirname, '../views/error.html'));
  }
});

// Update profile (renamed to /edit)
router.post('/edit', isAuthenticated, upload.fields([
  { name: 'background', maxCount: 1 },
  { name: 'headerImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Profile edit started for user ID:', req.session.user.id);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Full request body:', req.body);
    console.log('Background file received:', req.files?.background?.[0]?.filename || 'None');
    console.log('Header file received:', req.files?.headerImage?.[0]?.filename || 'None');
    const {
      status, customCss, customHtml, themeTemplate, blogLayout, districtId, widgets,
      bio, layoutType, sidebarConfig, mainContent, backgroundType
    } = req.body;
    console.log('Background type from form:', backgroundType);
    console.log('Extracted form fields - status:', status, 'bio:', bio, 'layoutType:', layoutType, 'sidebarConfig raw:', sidebarConfig, 'mainContent raw:', mainContent);

    // Sanitize inputs
    const sanitizedStatus = status ? escapeHTML(status.slice(0, 100)) : null;
    const sanitizedCss = customCss ? escapeHTML(customCss.slice(0, 10000)) : null;
    const sanitizedHtml = customHtml ? escapeHTML(customHtml.slice(0, 20000)) : null;
    const sanitizedBio = bio ? escapeHTML(bio.slice(0, 500)) : null; // Basic sanitization; add markdown parser if needed

    // Validate layout_type
    const validLayouts = ['one-column', 'two-column'];
    let validatedLayout = null;
    if (layoutType && validLayouts.includes(layoutType)) {
      validatedLayout = layoutType;
    }

    // Build update object - MUST BE DECLARED BEFORE ANY USAGE
    const updateData = {};

    // Parse and store JSONB fields - handle empty/null gracefully
    let sidebarConfigData = [];
    if (sidebarConfig && sidebarConfig !== '[]' && sidebarConfig !== '{}') {
      try {
        sidebarConfigData = typeof sidebarConfig === 'string' ? JSON.parse(sidebarConfig) : sidebarConfig;
        console.log('Parsed sidebarConfigData:', sidebarConfigData);
        if (!Array.isArray(sidebarConfigData)) {
          sidebarConfigData = [];
        }
      } catch (e) {
        console.error('Error parsing sidebar_config:', e, 'Raw value:', sidebarConfig);
        sidebarConfigData = [];
      }
    }
    if (sidebarConfigData.length > 0) {
      updateData.sidebar_config = sidebarConfigData;
    }

    let mainContentData = { left: [], right: [] };
    if (mainContent && mainContent !== '[]' && mainContent !== '{}') {
      try {
        mainContentData = typeof mainContent === 'string' ? JSON.parse(mainContent) : mainContent;
        console.log('Parsed mainContentData:', mainContentData);
        if (typeof mainContentData !== 'object' || mainContentData === null) {
          mainContentData = { left: [], right: [] };
        }
      } catch (e) {
        console.error('Error parsing main_content:', e, 'Raw value:', mainContent);
        mainContentData = { left: [], right: [] };
      }
    }
    if (mainContentData.left.length > 0 || mainContentData.right.length > 0) {
      updateData.main_content = mainContentData;
    }

    // Continue building update object
    if (sanitizedStatus !== null) updateData.status = sanitizedStatus;
    if (sanitizedCss !== null) updateData.custom_css = sanitizedCss;
    if (sanitizedHtml !== null) updateData.custom_html = sanitizedHtml;
    if (sanitizedBio !== null) updateData.bio = sanitizedBio;
    if (validatedLayout !== null) updateData.layout_type = validatedLayout;
    if (sidebarConfigData && sidebarConfigData.length > 0) updateData.sidebar_config = sidebarConfigData;
    if (mainContentData && (mainContentData.left.length > 0 || mainContentData.right.length > 0)) updateData.main_content = mainContentData;
    if (themeTemplate) updateData.theme_template = themeTemplate;
    if (blogLayout) updateData.blog_layout = blogLayout;
    if (districtId) updateData.district_id = districtId;
    if (backgroundType) {
      updateData.profile_bg_type = backgroundType;
      updateData.profile_bg_tile = backgroundType === 'tiled'; // Assume tile if type is tiled
    }
    console.log('Background options added to updateData:', { profile_bg_type: backgroundType, profile_bg_tile: backgroundType === 'tiled' });

    // Log this activity
    const activityDescription = 'Updated profile settings';
    try {
      await supabase
        .from('user_activity_logs')
        .insert({
          user_id: req.session.user.id,
          activity_type: 'profile_updated',
          description: activityDescription
        });
    } catch (logErr) {
      console.error('Failed to log activity:', logErr);
    }

    // Handle background image upload
    if (req.files && req.files.background && req.files.background[0]) {
      updateData.background_image = '/uploads/backgrounds/' + req.files.background[0].filename;
    }
    
    // Handle header image upload
    if (req.files && req.files.headerImage && req.files.headerImage[0]) {
      updateData.header_image = '/uploads/backgrounds/' + req.files.headerImage[0].filename;
    }
    
    // Widgets_data column does not exist in schema; skip to avoid update errors
    // if (widgets) { ... } - removed

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Log parsed data for debugging
    console.log('Parsed sidebarConfig:', sidebarConfigData);
    console.log('Parsed mainContent:', mainContentData);
    console.log('Final updateData before Supabase call:', updateData);

    // Execute the update
    console.log('Executing Supabase update with data:', updateData);
    const { data: result, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', req.session.user.id)
      .select()
      .single();
    console.log('Supabase profile edit result:', result ? 'Success, ID:' + result.id : 'No result', 'Error:', error ? error.message + ', Details:' + JSON.stringify(error) : 'None');

    // If sidebar_config or main_content provided, sync to profile_containers (upsert based on zone/position)
    if (sidebarConfigData || mainContentData) {
      try {
        const profileId = result.id;
        console.log('Starting container sync for profile ID:', profileId);
        let allContainers = [];

        // Sidebar
        if (sidebarConfigData && Array.isArray(sidebarConfigData)) {
          for (let i = 0; i < sidebarConfigData.length; i++) {
            const cont = sidebarConfigData[i];
            allContainers.push({
              profile_id: profileId,
              zone: 'sidebar',
              position: i,
              container_type: cont.type,
              title: cont.title,
              content: cont.content,
              settings: cont.settings || {}
            });
          }
        }

        // Main content (assume mainContentData is {left: [], right: []})
        if (mainContentData && typeof mainContentData === 'object') {
          // Left zone
          const leftData = Array.isArray(mainContentData.left) ? mainContentData.left : [];
          for (let i = 0; i < leftData.length; i++) {
            const cont = leftData[i];
            if (cont && cont.type) { // Guard against invalid cont
              allContainers.push({
                profile_id: profileId,
                zone: 'main-left',
                position: i,
                container_type: cont.type,
                title: cont.title || null,
                content: cont.content || null,
                settings: cont.settings || {}
              });
            }
          }
          // Right zone
          const rightData = Array.isArray(mainContentData.right) ? mainContentData.right : [];
          for (let i = 0; i < rightData.length; i++) {
            const cont = rightData[i];
            if (cont && cont.type) { // Guard against invalid cont
              allContainers.push({
                profile_id: profileId,
                zone: 'main-right',
                position: i,
                container_type: cont.type,
                title: cont.title || null,
                content: cont.content || null,
                settings: cont.settings || {}
              });
            }
          }
        }

        console.log('Prepared containers for insert:', allContainers);

        // Delete existing containers for these zones
        const { error: deleteError } = await supabase
          .from('profile_containers')
          .delete()
          .eq('profile_id', profileId)
          .in('zone', ['sidebar', 'main-left', 'main-right']);
        if (deleteError) {
          console.error('Error deleting existing containers:', deleteError);
        } else {
          console.log('Existing containers deleted successfully');
        }

        // Insert new ones
        if (allContainers.length > 0) {
          const { error: insertError } = await supabase
            .from('profile_containers')
            .insert(allContainers);
          if (insertError) {
            console.error('Error syncing containers:', insertError);
          } else {
            console.log('Containers synced successfully:', allContainers.length);
          }
        } else {
          console.log('No new containers to insert');
        }
      } catch (syncErr) {
        console.error('Container sync error:', syncErr);
      }
    }

    if (error || !result) {
      console.error('Profile update failed:', error);
      return res.status(500).json({
        error: 'Update failed',
        message: error ? error.message : 'Terminal identity not found in the system.'
      });
    }

    res.json({
      success: true,
      message: 'Terminal identity updated successfully'
    });
  } catch (err) {
    console.error('Profile edit error details:', {
      message: err.message,
      stack: err.stack,
      userId: req.session.user.id,
      updateData
    });
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Avatar upload endpoint
router.post('/avatar', isAuthenticated, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select an image file.'
      });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif'];
    if (!allowedExts.includes(fileExt)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only JPG, PNG, and GIF images are allowed.'
      });
    }

    const fileName = `${req.session.user.id}-${Date.now()}${fileExt}`;

    // Upload to Supabase storage 'avatars' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, req.file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: req.file.mimetype
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update profile avatar_url
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', req.session.user.id);

    if (updateError) {
      console.error('Avatar profile update error:', updateError);
      throw updateError;
    }

    console.log('Avatar uploaded successfully for user:', req.session.user.id, 'URL:', publicUrl);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar_url: publicUrl
    });
  } catch (err) {
    console.error('Avatar endpoint error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Failed to upload avatar. Try again later.'
    });
  }
});

// Set profile glyph
router.post('/set-glyph/:glyphId', isAuthenticated, async (req, res) => {
  try {
    const { glyphId } = req.params;
    const { enable3d, rotationSpeed } = req.body;

    // Check if glyph exists and belongs to user
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

    // Build update data
    const updateData = { glyph_id: glyphId };

    if (enable3d !== undefined) {
      updateData.glyph_3d = enable3d === true || enable3d === '1' ? true : false;
    }

    if (rotationSpeed !== undefined) {
      updateData.glyph_rotation_speed = parseInt(rotationSpeed) || 3;
    }

    // Update profile
    const { data: result, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', req.session.user.id)
      .select()
      .single();

    if (updateError || !result) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Terminal identity not found in the system.'
      });
    }

    res.json({
      success: true,
      message: 'Glyph set as profile sigil'
    });
  } catch (err) {
    console.error('Set profile glyph error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Set background options
router.post('/background', isAuthenticated, async (req, res) => {
  try {
    const { backgroundType, tileBackground } = req.body;

    // Build update data
    const updateData = {};
    if (backgroundType) updateData.profile_bg_type = backgroundType;
    if (tileBackground !== undefined) updateData.profile_bg_tile = tileBackground === true || tileBackground === '1' ? true : false;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'No background options provided.'
      });
    }

    // Execute the update
    const { data: result, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', req.session.user.id)
      .select()
      .single();

    if (error || !result) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Terminal identity not found in the system.'
      });
    }

    res.json({
      success: true,
      message: 'Background options updated successfully'
    });
  } catch (err) {
    console.error('Update background options error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Profile container routes
// Create new container
router.post('/container', isAuthenticated, async (req, res) => {
  try {
    const { containerType, title, content, settings, position } = req.body;

    if (!containerType) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Container type is required.'
      });
    }

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', req.session.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'User profile not found.'
      });
    }

    // Insert container
    const insertData = {
      profile_id: profile.id,
      container_type: containerType,
      title: title || null,
      content: content || null,
      position: position || 0,
      settings: settings || null
    };

    const { data: result, error: insertError } = await supabase
      .from('profile_containers')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !result) {
      throw new Error('Failed to create container');
    }

    res.status(201).json({
      success: true,
      message: 'Container created successfully',
      containerId: result.id
    });
  } catch (err) {
    console.error('Container creation error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Update container
router.put('/container/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { containerType, title, content, settings, position } = req.body;

    // Check if container exists and belongs to user
    const { data: container, error: containerError } = await supabase
      .from('profile_containers')
      .select('profile_containers(*), profiles(user_id)')
      .eq('profile_containers.id', id)
      .eq('profiles.user_id', req.session.user.id)
      .single();

    if (containerError || !container) {
      return res.status(404).json({
        error: 'Container not found',
        message: 'The requested container does not exist or does not belong to you.'
      });
    }

    // Build update data
    const updateData = {};
    if (containerType) updateData.container_type = containerType;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (settings) updateData.settings = settings;
    if (position !== undefined) updateData.position = position;

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Execute the update
    const { data: result, error: updateError } = await supabase
      .from('profile_containers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !result) {
      return res.status(404).json({
        error: 'Update failed',
        message: 'Failed to update container.'
      });
    }

    res.json({
      success: true,
      message: 'Container updated successfully'
    });
  } catch (err) {
    console.error('Container update error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Delete container
router.delete('/container/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if container exists and belongs to user
    const { data: container, error: containerError } = await supabase
      .from('profile_containers')
      .select('profile_containers(*), profiles(user_id)')
      .eq('profile_containers.id', id)
      .eq('profiles.user_id', req.session.user.id)
      .single();

    if (containerError || !container) {
      return res.status(404).json({
        error: 'Container not found',
        message: 'The requested container does not exist or does not belong to you.'
      });
    }

    // Delete container
    const { error: deleteError } = await supabase
      .from('profile_containers')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error('Failed to delete container');
    }

    res.json({
      success: true,
      message: 'Container successfully removed'
    });
  } catch (err) {
    console.error('Container delete error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

// Equip/unequip rewards
router.post('/reward/:id/toggle', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { equipped } = req.body;

    // Check if user has this reward
    const { data: userReward, error } = await supabase
      .from('user_rewards')
      .select('user_rewards(*), repute_rewards(id)')
      .eq('user_id', req.session.user.id)
      .eq('repute_rewards.id', id)
      .single();

    if (error || !userReward) {
      return res.status(404).json({
        error: 'Reward not found',
        message: 'You do not have this reward.'
      });
    }

    // Update equipped status
    const { error: updateError } = await supabase
      .from('user_rewards')
      .update({ is_equipped: equipped === true || equipped === '1' ? true : false })
      .eq('user_id', req.session.user.id)
      .eq('reward_id', id);

    if (updateError) {
      throw new Error('Failed to update reward status');
    }

    res.json({
      success: true,
      message: 'Reward status updated successfully'
    });
  } catch (err) {
    console.error('Update reward status error:', err);
    res.status(500).json({
      error: 'System error',
      message: 'Terminal connection unstable. Try again later.'
    });
  }
});

module.exports = router;
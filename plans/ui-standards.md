# ELRIEL UI/UX Standards & Template Guidelines

## Overview
This document defines the standardized UI/UX architecture for the ELRIEL forum, ensuring consistency across all pages while maintaining the cyberpunk terminal aesthetic.

## Core Design Principles

### 1. Unified Cyberpunk Terminal Aesthetic
- Dark background with purple/green terminal colors
- CRT screen effects (noise, scan lines, glow)
- Monospace fonts (VT323, Share Tech Mono, IBM Plex Mono)
- Glitch effects for interactivity
- Panel-based layout with borders and shadows

### 2. Consistent Navigation
- Same sidebar structure across all pages
- Mobile-responsive navigation with toggle button
- Active state highlighting
- Predictable link structure

### 3. Responsive Design
- Mobile-first approach
- Touch-friendly controls
- Adaptive layouts for all screen sizes
- Proper viewport meta tags

## Standard Page Template

### Required HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAGE TITLE | ELRIEL</title>
  
  <!-- Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
  
  <!-- Unified Stylesheets -->
  <link rel="stylesheet" href="/css/cyberpunk-terminal.css">
  <link rel="stylesheet" href="/css/[page-specific].css"> <!-- Only if needed -->
  <link rel="stylesheet" href="/css/responsive-fixes.css">
  <link rel="stylesheet" href="/css/bleedstream-sidebar.css">
  
  <!-- Core Scripts -->
  <script src="/js/error-logger.js" defer></script>
  <script src="/js/accessibility.js" defer></script>
  <script src="/js/navigation-debug.js" defer></script>
  <script src="/js/mobile-enhancements.js" defer></script>
  <script src="/js/sidebar-manager.js" defer></script>
  <script src="/js/performance-fixes.js" defer></script>
</head>
<body class="terminal">
  <!-- Screen Effects -->
  <div class="noise-overlay"></div>
  <div class="scan-lines"></div>
  <div class="crt-effect"></div>
  
  <!-- Main Container -->
  <div class="container">
    <!-- HEADER: See section below -->
    <!-- CONTENT WRAPPER: See section below -->
    <!-- FOOTER: See section below -->
  </div>
  
  <!-- Page-specific JavaScript -->
  <script>
    // Data injection pattern
    const data = __DATA__;
    // Your page logic here
  </script>
</body>
</html>
```

### Standard Header Component

```html
<header class="main-header">
  <div class="logo">
    <h1 class="glitch" data-text="ELRIEL">ELRIEL</h1>
    <div class="logo-subtitle">DIGITAL WASTELAND v1.3.7</div>
  </div>
  <div class="user-panel">
    <div id="user-status">
      <!-- User status will be injected via JavaScript -->
    </div>
  </div>
</header>
```

### Standard Sidebar Navigation

```html
<div class="content-wrapper">
  <!-- Mobile Navigation Toggle -->
  <button type="button" class="mobile-nav-toggle" id="mobile-nav-toggle">TOGGLE NAVIGATION</button>
  
  <nav class="sidebar" id="main-sidebar">
    <div class="nav-section">
      <h3 class="nav-title">MAIN SYSTEMS</h3>
      <ul class="nav-links">
        <li><a href="/">TERMINAL</a></li>
        <li><a href="/feed/bleedstream">BLEEDSTREAM</a></li>
        <li><a href="/glyph/crucible">GLYPH CRUCIBLE</a></li>
        <li><a href="/whisper/board">WHISPERBOARD</a></li>
        <li><a href="/forum/scrapyard">SCRAPYARD</a></li>
      </ul>
    </div>
    <div class="nav-section">
      <h3 class="nav-title">PROFILE</h3>
      <ul class="nav-links">
        <li><a href="/profile">DASHBOARD</a></li>
        <li><a href="/profile/edit">EDIT PROFILE</a></li>
        <li><a href="/feed/new">CREATE POST</a></li>
      </ul>
    </div>
    <div class="nav-section">
      <h3 class="nav-title">SYSTEM</h3>
      <ul class="nav-links">
        <li><a href="/about">ABOUT</a></li>
        <li><a href="#" id="toggle-glitch">TOGGLE GLITCH</a></li>
      </ul>
    </div>
  </nav>

  <main class="main-content">
    <!-- Page content goes here -->
  </main>
</div>
```

### Standard Footer Component

```html
<footer class="main-footer">
  <div class="footer-text">ELRIEL NETWORK // ESTABLISHED 2025 // ALL RIGHTS SURRENDERED</div>
  <div class="footer-glyphs">
    <span class="glyph">⌘</span>
    <span class="glyph">⍟</span>
    <span class="glyph">⎔</span>
  </div>
</footer>
```

## Standard Panel Structure

### Basic Panel

```html
<section class="panel [panel-name]-panel">
  <div class="scanner-line"></div>
  <div class="panel-header">
    <h2>PANEL TITLE</h2>
    <div class="status-indicator">STATUS</div>
  </div>
  <div class="panel-content">
    <!-- Panel content here -->
  </div>
</section>
```

### Status Indicator Variants
- `<div class="status-indicator">NORMAL</div>` - Default green
- `<div class="status-indicator alert">ALERT</div>` - Red blinking

## Data Injection Pattern

### Server-Side (Node.js/Express)
```javascript
// In route handler
const data = {
  user: req.session.user,
  // ... other data
};

let html = fs.readFileSync(path.join(__dirname, '../views/page.html'), 'utf8');
html = html.replace('__DATA__', JSON.stringify(data));
res.send(html);
```

### Client-Side (JavaScript)
```javascript
let data, user;
try {
  data = __DATA__;
  user = data.user;
} catch (err) {
  console.error('Error accessing __DATA__:', err);
  data = {};
  user = null;
}

// Update user status
const userStatusEl = document.getElementById('user-status');
if (user) {
  userStatusEl.innerHTML = `
    <div class="logged-in">
      <span class="username">${user.username}</span>
      <div class="user-links">
        <a href="/profile" class="button">PROFILE</a>
        <a href="/auth/logout" class="button">LOGOUT</a>
      </div>
    </div>
  `;
} else {
  userStatusEl.innerHTML = `
    <div class="logged-out">
      <a href="/auth/login" class="button login-btn">LOGIN</a>
      <a href="/auth/register" class="button register-btn">REGISTER</a>
    </div>
  `;
}
```

## CSS Architecture

### File Hierarchy
1. **cyberpunk-terminal.css** - Base styles (REQUIRED on all pages)
2. **responsive-fixes.css** - Mobile adaptations (REQUIRED)
3. **bleedstream-sidebar.css** - Sidebar enhancements (REQUIRED)
4. **[page-specific].css** - Page-specific styles (OPTIONAL)

### Core CSS Variables
```css
:root {
  /* Terminal Colors */
  --terminal-green: #8a2be2;
  --terminal-dim-green: #5e1c99;
  --terminal-blue: #00ccff;
  --terminal-red: #ff0033;
  --terminal-purple: #cc00ff;
  
  /* Backgrounds */
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --bg-panel: rgba(15, 0, 20, 0.85);
  --bg-inset: rgba(8, 0, 15, 0.7);
  
  /* Text */
  --text-primary: var(--terminal-green);
  --text-secondary: var(--terminal-dim-green);
  --text-highlight: #ffffff;
  
  /* Glow Effects */
  --glow-strong: 0 0 10px rgba(138, 43, 226, 0.7);
  --glow-medium: 0 0 8px rgba(138, 43, 226, 0.5);
  --glow-weak: 0 0 5px rgba(138, 43, 226, 0.3);
}
```

## JavaScript Patterns

### Standard Initialization
```javascript
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page initializing...');
  
  // Initialize glitch toggle
  document.getElementById('toggle-glitch').addEventListener('click', function(e) {
    e.preventDefault();
    document.body.classList.toggle('glitch-active');
    localStorage.setItem('glitch-active', 
      document.body.classList.contains('glitch-active') ? 'true' : 'false');
  });

  // Check saved glitch state
  if (localStorage.getItem('glitch-active') === 'true') {
    document.body.classList.add('glitch-active');
  }
  
  console.log('Page initialized successfully');
});
```

### Form Submission Pattern
```javascript
document.getElementById('form-id').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const messageEl = document.getElementById('message');
  const errorMessageEl = document.getElementById('error-message');
  messageEl.textContent = '';
  errorMessageEl.textContent = '';
  
  try {
    const response = await fetch('/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* form data */ })
    });
    
    const data = await response.json();
    
    if (data.success) {
      messageEl.textContent = data.message;
      // Optional redirect
      setTimeout(() => window.location.href = '/redirect', 1500);
    } else {
      errorMessageEl.textContent = data.message || 'Operation failed.';
    }
  } catch (error) {
    console.error('Error:', error);
    errorMessageEl.textContent = 'System error. Could not connect to server.';
  }
});
```

## Navigation Links

### All Valid Routes
- `/` - Landing page/Terminal
- `/feed/bleedstream` - Main feed
- `/feed/new` - Create new post
- `/feed/post/:id` - View specific post
- `/glyph/crucible` - Glyph generation
- `/glyph/view/:id` - View specific glyph
- `/whisper/board` - Whisperboard listing
- `/whisper/new` - Create new whisper
- `/whisper/:id` - View specific whisper
- `/forum/scrapyard` - Scrapyard/Forum
- `/forum/topic/:id` - View forum topic
- `/profile` - User dashboard
- `/profile/edit` - Edit profile
- `/profile/activity` - Activity log
- `/profile/user/:username` - View user profile
- `/auth/login` - Login page
- `/auth/register` - Registration page
- `/auth/logout` - Logout handler
- `/about` - About page

## Mobile Responsiveness

### Required Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Mobile Navigation
- Must include mobile-nav-toggle button
- Sidebar must have id="main-sidebar"
- Toggle handled by sidebar-manager.js

### Touch Targets
- Minimum 44px touch targets
- Adequate spacing between interactive elements
- No hover-only functionality

## Common Patterns

### Loading States
```html
<div class="loading-indicator">LOADING...</div>
```

### Empty States
```html
<div class="empty-state">
  <div class="empty-icon">⨯</div>
  <div class="empty-message">NO DATA FOUND</div>
  <div class="empty-subtitle">Additional context here</div>
</div>
```

### Error Messages
```html
<div id="error-message" style="color: var(--terminal-red); margin-top: 1rem;"></div>
```

### Success Messages
```html
<div id="message" style="color: var(--terminal-green); margin-top: 1rem;"></div>
```

## Performance Guidelines

1. **Defer non-critical scripts** with `defer` attribute
2. **Minimize inline styles** - use CSS classes
3. **Lazy load images** where possible
4. **Clean up intervals** on page unload
5. **Use event delegation** for dynamic content

## Accessibility

1. **Proper labels** for all form inputs
2. **ARIA labels** for icon buttons
3. **Keyboard navigation** support
4. **Focus indicators** on interactive elements
5. **Screen reader** friendly markup

## Testing Checklist

### Visual Consistency
- [ ] Header matches landing page
- [ ] Sidebar navigation present and functional
- [ ] Footer matches landing page
- [ ] Screen effects (noise, scanlines, CRT) visible
- [ ] Color scheme matches cyberpunk-terminal.css

### Functionality
- [ ] All navigation links work
- [ ] Mobile navigation toggle works
- [ ] Forms submit correctly
- [ ] Data loads and displays
- [ ] Error handling works

### Responsive
- [ ] Looks good on desktop (1920px, 1440px, 1024px)
- [ ] Looks good on tablet (768px)
- [ ] Looks good on mobile (480px, 375px)
- [ ] Touch interactions work
- [ ] No horizontal scroll

### Performance
- [ ] Page loads in < 3 seconds
- [ ] No JavaScript errors in console
- [ ] No broken CSS references
- [ ] Images optimized
- [ ] Scripts deferred properly

## Implementation Status

### ✅ Completed Pages
- Landing page (index.html) - Reference implementation
- Profile system (edit, dashboard, view, view-enhanced, activity)
- Feed system (bleedstream, new-post, view-post)
- Glyph system (crucible) - Already well-structured
- Whisper system (board, new)
- Auth system (login, register)
- Forum system (scrapyard) - Already well-structured

### 🔍 Pages Requiring Verification
- About page
- Search pages
- Admin pages
- Crypto pages
- Error pages (404, error)

## Maintenance Notes

### When Adding New Pages
1. Copy template from index.html or any standardized page
2. Update title and page-specific content
3. Ensure all required CSS/JS files are included
4. Test on mobile, tablet, desktop
5. Verify all links work
6. Check console for errors

### When Modifying Existing Pages
1. Maintain header/sidebar/footer structure
2. Don't remove cyberpunk-terminal.css
3. Keep screen effects intact
4. Test responsive behavior
5. Preserve data injection pattern

## Quick Reference

### CSS Classes
- `.panel` - Standard container panel
- `.panel-header` - Panel title bar
- `.panel-content` - Panel body
- `.scanner-line` - Animated scan line effect
- `.button` - Standard button styling
- `.form-group` - Form field container
- `.glitch` - Glitch text effect
- `.hover-glow` - Hover glow effect

### IDs
- `#user-status` - User login/logout display
- `#main-sidebar` - Primary navigation sidebar
- `#mobile-nav-toggle` - Mobile menu toggle button
- `#toggle-glitch` - Glitch effect toggle

### JavaScript Functions
- `__DATA__` - Server-injected data placeholder
- `localStorage.getItem('glitch-active')` - Glitch state persistence
- `localStorage.getItem('sidebar-active')` - Sidebar state persistence

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-15  
**Status:** Production Ready

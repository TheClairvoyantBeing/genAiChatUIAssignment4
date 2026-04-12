/**
 * chat.js — NeuralChat UI Logic
 * OVERVIEW:
 *   - Message handling (render, typewriter effect, auto-scroll)
 *   - Sidebar toggle (mobile responsive)
 *   - Theme switching (dark/light via CSS variables)
 *   - Chat export (Blob API)
 *   - Basic markdown-ish formatting (bold, code, lists)
 * 
 * STACK: jQuery 3.7 + vanilla JS
 * NOTE: jQuery is overkill here, but was already in use. Refactor to vanilla when time permits.
 */

$(function () {

  /* ========== STATE ========== */
  let messageHistory = [];   // stores { sender, text, time } for export
  let isTyping = false;      // prevents double-sends while AI is "thinking"
  let isDark = true;         // theme state (sync with HTML data-theme attribute)

  /* Mock AI responses
     Tested: Should feel natural but not too polished.
     Range: technical + career advice (tailored to Evion's internship context).
     TODO: Replace with actual API call to Claude/ChatGPT API.
  */
  const aiResponses = [
    "That's a solid question. Let me break it down:\n\n**Key points:**\n- First, understand the core concept before optimizing\n- Think in terms of trade-offs, not absolutes\n- Document as you go — future you will thank present you\n\nWant me to go deeper on any specific part?",
    "Here's a quick Python snippet for that:\n\n```python\ndef solution(data):\n    # process and return result\n    return [x for x in data if x is not None]\n```\n\nThis uses a list comprehension — cleaner than a for loop here. Let me know if you need the async version.",
    "Great use case. The short answer is: **it depends on your scale**.\n\nFor small teams, a monolith is fine. Once you're past ~10 services, microservices start paying off in deployment flexibility. The overhead before that point usually isn't worth it.",
    "I'd recommend starting with the *fundamentals* before jumping into frameworks. Solid HTML/CSS/JS knowledge will make every framework easier to learn later.\n\nAlso — build real projects. Tutorials only get you so far.",
    "The difference is subtle but important:\n\n- `async/await` is syntactic sugar over Promises\n- Both are non-blocking but `async/await` reads like synchronous code\n- Use `.catch()` or `try/catch` for error handling — both work\n\nFor modern codebases, `async/await` is almost always the cleaner choice.",
    "For your resume, I'd lead with impact metrics wherever possible. Instead of *\"worked on backend services\"*, try *\"designed and deployed 3 REST APIs handling 50k+ daily requests\"*. Numbers catch attention.",
    "Docker tip: keep your images small. Use multi-stage builds and start from `alpine` or `distroless` base images. A 1GB image vs a 120MB image makes a real difference in CI pipeline speed.",
    "Honestly, that's a common mistake. **SQL first, then NoSQL.** Understanding relational data modeling makes the NoSQL decision much more intentional — you know exactly what you're trading away.",
    "For the Honeywell DevOps role, I'd highlight:\n1. CI/CD pipeline experience (GitHub Actions, Jenkins)\n2. Container orchestration (Kubernetes, Docker Compose)\n3. IaC tools (Terraform, Ansible)\n4. Monitoring (Prometheus, Grafana)\n\nThe 6-project portfolio approach you're taking is exactly right.",
    "Good instinct asking that. The answer is: **profile before you optimize**. Use `cProfile` in Python or Chrome DevTools for JS. Guessing where the bottleneck is almost always wrong.",
  ];

  /* ========== UTILITY FUNCTIONS ========== */
  
  // Get current time as HH:MM
  // Edge case: handles 12-hour format correctly (tested on US locale)
  function getTime() {
    try {
      return new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch (e) {
      // Fallback if Intl API fails (rare, but happened in older browsers)
      console.warn('toLocaleTimeString failed, using fallback', e);
      const n = new Date();
      const h = String(n.getHours() % 12 || 12).padStart(2, '0');
      const m = String(n.getMinutes()).padStart(2, '0');
      return h + ':' + m;
    }
  }

  /* Format text with basic markdown-ish parsing
     SECURITY: Escape HTML first to prevent XSS attacks on code/markdown
     Handles: **bold**, *italic*, `inline code`, ```code blocks```, lists
     
     NOTE: This is NOT a full markdown parser. It's minimal by design.
     If we add more formatting later, consider migrating to marked.js library.
  */
  function formatText(text) {
    // Validate input
    if (!text || typeof text !== 'string') {
      console.warn('formatText received invalid input:', text);
      return '';
    }

    // Escape HTML first to prevent XSS (CRITICAL SECURITY STEP)
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks (``` ... ```)
    // Use non-greedy match to prevent eating multiple code blocks
    safe = safe.replace(/```([\s\S]*?)```/g, (_, code) => {
      const trimmed = code.trim();
      return `<pre><code>${trimmed}</code></pre>`;
    });

    // Inline code — matches `text` but not if already in a code block
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text** — needs non-greedy matching
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic *text* — avoid matching ** or extra spaces
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Numbered lists (1. item) — multiline flag  
    safe = safe.replace(/^\d+\.\s(.+)$/gm, (match) => {
      return '<li>' + match.replace(/^\d+\.\s/, '') + '</li>';
    });
    // Wrap list items
    safe = safe.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Bullet lists (- item) 
    safe = safe.replace(/^[-•]\s(.+)$/gm, '<li>$1</li>');

    // Line breaks — MUST be last to avoid affecting other replacements
    safe = safe.replace(/\n/g, '<br>');

    return safe;
  }

  /* addMessage — creates and appends a message bubble to the DOM
     @param {string} text   — message content (will be formatted)
     @param {string} sender — 'user' or 'ai'
     @param {boolean} typewriter — animate AI response letter by letter
     
     NOTE: jQuery is used here for DOM manipulation. Consider refactoring to vanilla JS.
     PERF: Adding many messages rapidly might lag. Consider virtualizing if 100+ messages.
  */
  function addMessage(text, sender, typewriter = false) {
    // Defensive checks
    if (!text || !sender) {
      console.warn('addMessage called with missing params:', { text, sender });
      return;
    }

    const time = getTime();
    const isUser = sender === 'user';

    const name   = isUser ? 'You' : 'NeuralChat';
    const avatarContent = isUser
      ? 'E'  
      : '<i class="fa-solid fa-brain"></i>';
    const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
    const msgClass    = isUser ? 'user-message' : 'ai-message';

    // Format text only if not doing typewriter (typewriter will format progressively)
    const formattedText = typewriter ? '' : formatText(text);

    // Build message bubble — using template string for safety
    const $msg = $(`
      <div class="message ${msgClass}">
        <div class="msg-avatar ${avatarClass}">${avatarContent}</div>
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name">${name}</span>
            <span class="msg-time">${time}</span>
          </div>
          <div class="msg-bubble">${formattedText}</div>
        </div>
      </div>
    `);

    try {
      const $container = $('#messagesContainer');
      if ($container.length === 0) {
        throw new Error('messagesContainer not found in DOM');
      }
      $container.append($msg);
    } catch (err) {
      console.error('Failed to append message to DOM:', err);
      return;
    }

    scrollToBottom();

    // Typewriter effect for AI responses
    if (typewriter && !isUser) {
      typewriterEffect($msg.find('.msg-bubble'), text);
    }

    // Track for export — store time, sender name, and original text
    messageHistory.push({ 
      sender: name, 
      text: text,      // save original, not formatted 
      time: time 
    });
  }

  /* =========================================
      typewriterEffect — types out text letter by letter
  ========================================= */
  function typewriterEffect($bubble, text) {
    let i = 0;
    const speed = 18; // ms per character — feels natural

    function type() {
      if (i < text.length) {
        // Append next character and re-format progressively
        const partial = text.slice(0, i + 1);
        $bubble.html(formatText(partial));
        i++;
        scrollToBottom();
        setTimeout(type, speed);
      }
    }
    type();
  }

  /* =========================================
      scrollToBottom — smooth scroll to latest message
  ========================================= */
  function scrollToBottom() {
    const wrapper = document.getElementById('messagesWrapper');
    wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
  }

  /* =========================================
      showTypingIndicator / hideTypingIndicator
  ========================================= */
  function showTypingIndicator() {
    $('#typingIndicator').fadeIn(200);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    $('#typingIndicator').fadeOut(150);
  }

  /* sendMessage — orchestrates the entire send flow
     1. Validate input (not empty, not while typing)
     2. Hide welcome screen on first message
     3. Add user message to DOM + history
     4. Simulate AI thinking (random 1-2s)
     5. Pick random response and add with typewriter effect
     
     PERF BUG: If user sends multiple messages rapidly, isTyping might not update properly.
     TODO: Add message queue instead of just setting isTyping flag.
  */
  function sendMessage() {
    const $input = $('#messageInput');
    
    // Defensive: Check if input element exists
    if ($input.length === 0) {
      console.error('messageInput element not found');
      return;
    }

    const text = $input.val().trim();

    // Guard: don't send empty or while AI is typing
    if (!text || isTyping) return;

    // On first message, remove welcome screen with fade animation
    try {
      const $welcome = $('#welcomeScreen');
      if ($welcome.length > 0) {
        $welcome.fadeOut(250, function () {
          // Make sure to remove it from DOM to prevent memory waste
          $(this).remove();
        });
      }
    } catch (err) {
      console.warn('Error hiding welcome screen:', err);
      // Don't bail out, continue anyway
    }

    isTyping = true;

    // Add user message to UI + history
    addMessage(text, 'user', false);

    // Clear input and reset UI state
    $input.val('').trigger('input');
    $('#sendBtn').prop('disabled', true);

    // Simulate AI thinking — natural delay (1-2 seconds)
    const delay = 1000 + Math.random() * 1000;
    showTypingIndicator();

    setTimeout(function () {
      hideTypingIndicator();

      // Pick random AI response (mock response until API integration)
      const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      if (response) {
        addMessage(response, 'ai', true); // typewriter effect on
      } else {
        console.error('No AI responses available');
        addMessage('Something went wrong. Try again!', 'ai', false);
      }

      isTyping = false;
    }, delay);
  }

  /* =========================================
      Input handling — enable/disable send, auto-resize
  ========================================= */
  $('#messageInput').on('input', function () {
    const val = $(this).val().trim();

    // Enable/disable send button
    $('#sendBtn').prop('disabled', val.length === 0);

    // Auto-resize textarea
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
  });

  // Enter → send | Shift+Enter → newline
  $('#messageInput').on('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button click
  $('#sendBtn').on('click', sendMessage);

  /* =========================================
      Suggestion card clicks — pre-fill and send
  ========================================= */
  $(document).on('click', '.suggestion-card', function () {
    const prompt = $(this).data('prompt');
    $('#messageInput').val(prompt).trigger('input').focus();
    sendMessage();
  });

  /* =========================================
      Sidebar toggle — mobile
  ========================================= */
  $('#hamburgerBtn').on('click', function () {
    $('#sidebar').addClass('open');
    $('#sidebarOverlay').addClass('active');
  });

  function closeSidebar() {
    $('#sidebar').removeClass('open');
    $('#sidebarOverlay').removeClass('active');
  }

  $('#closeSidebar').on('click', closeSidebar);
  $('#sidebarOverlay').on('click', closeSidebar);

  /* =========================================
      New Chat — reset conversation
  ========================================= */
  $('#newChatBtn').on('click', function () {
    // Clear messages
    $('#messagesContainer').empty();
    messageHistory = [];
    isTyping = false;

    // Restore welcome screen if it was removed
    if ($('#welcomeScreen').length === 0) {
      const $welcome = $(`
        <div class="welcome-screen" id="welcomeScreen">
          <div class="welcome-icon"><i class="fa-solid fa-brain"></i></div>
          <h1 class="welcome-title">What can I help with?</h1>
          <p class="welcome-subtitle">Start a conversation or pick a suggestion below.</p>
          <div class="suggestion-grid" id="suggestionGrid">
            <div class="suggestion-card" data-prompt="Explain how neural networks learn using backpropagation.">
              <div class="card-icon"><i class="fa-solid fa-network-wired"></i></div>
              <div class="card-body-text"><div class="card-title">Explain neural nets</div><div class="card-desc">How backpropagation actually works</div></div>
            </div>
            <div class="suggestion-card" data-prompt="Write a Python script to scrape job listings from a website using BeautifulSoup.">
              <div class="card-icon"><i class="fa-brands fa-python"></i></div>
              <div class="card-body-text"><div class="card-title">Python web scraper</div><div class="card-desc">BeautifulSoup job listings script</div></div>
            </div>
            <div class="suggestion-card" data-prompt="Review my resume for a Software Engineer role at Honeywell and suggest improvements.">
              <div class="card-icon"><i class="fa-solid fa-file-lines"></i></div>
              <div class="card-body-text"><div class="card-title">Resume review</div><div class="card-desc">Optimize for a DevOps/SWE role</div></div>
            </div>
            <div class="suggestion-card" data-prompt="What are the key differences between SQL and NoSQL databases?">
              <div class="card-icon"><i class="fa-solid fa-database"></i></div>
              <div class="card-body-text"><div class="card-title">SQL vs NoSQL</div><div class="card-desc">Comparison with real use cases</div></div>
            </div>
          </div>
        </div>
      `);
      $('#messagesWrapper').prepend($welcome);
    } else {
      $('#welcomeScreen').show();
    }

    // Add to history list
    const $newItem = $(`
      <div class="history-item active">
        <i class="fa-regular fa-comment"></i>
        <span>New conversation</span>
      </div>
    `);
    $('.history-item').removeClass('active');
    $('#chatHistory').prepend($newItem);

    // Close sidebar on mobile
    closeSidebar();
    $('#messageInput').focus();
  });

  /* =========================================
      Dark / Light mode toggle — bonus
  ========================================= */
  $('#darkModeToggle').on('click', function () {
    isDark = !isDark;
    $('html').attr('data-theme', isDark ? 'dark' : 'light');
    $('#themeIcon')
      .toggleClass('fa-moon', isDark)
      .toggleClass('fa-sun', !isDark);
    $('#themeLabel').text(isDark ? 'Light Mode' : 'Dark Mode');
  });

  /* =========================================
      Export chat as .txt file — bonus
      Uses Blob API to generate downloadable text file
  ========================================= */
  $('#exportChatBtn').on('click', function () {
    if (messageHistory.length === 0) {
      alert('No messages to export yet. Start a conversation first!');
      return;
    }

    // Build plain text content
    let content = '=== NeuralChat Export ===\n';
    content += `Exported: ${new Date().toLocaleString()}\n`;
    content += '='.repeat(40) + '\n\n';

    messageHistory.forEach(function (msg) {
      content += `[${msg.time}] ${msg.sender}:\n${msg.text}\n\n`;
    });

    // Blob API download
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const $a   = $('<a>', { href: url, download: 'neuralchat-export.txt' });
    $('body').append($a);
    $a[0].click();
    $a.remove();
    URL.revokeObjectURL(url);
  });

  /* =========================================
      Attach button — placeholder (UI only)
  ========================================= */
  $('#attachBtn').on('click', function () {
    alert('File attachment coming soon! Focus is on the chat UI for now.');
  });

  /* =========================================
      Init — focus input on load
  ========================================= */
  $('#messageInput').focus();

});

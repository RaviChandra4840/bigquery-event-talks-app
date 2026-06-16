/**
 * BigQuery Release Notes Explorer - Application Logic
 */

// Global State
let appState = {
    updates: [],
    filteredUpdates: [],
    activeCategory: 'all',
    searchQuery: '',
    currentTweetUpdate: null
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshSpinner: document.getElementById('refresh-spinner'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChips: document.getElementById('filter-chips'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    errorAlert: document.getElementById('error-alert'),
    errorMessage: document.getElementById('error-message'),
    errorRetryBtn: document.getElementById('error-retry-btn'),
    noResults: document.getElementById('no-results'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    timelineFeed: document.getElementById('timeline-feed'),
    syncTime: document.getElementById('sync-time'),
    
    // Category counts
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countIssue: document.getElementById('count-issue'),
    countChange: document.getElementById('count-change'),
    countAnnouncement: document.getElementById('count-announcement'),
    countBreaking: document.getElementById('count-breaking'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    modalClose: document.getElementById('modal-close'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    presetEmoji: document.getElementById('preset-emoji'),
    presetLink: document.getElementById('preset-link'),
    presetTags: document.getElementById('preset-tags'),
    charRingProgress: document.getElementById('char-ring-progress'),
    charCountText: document.getElementById('char-count-text'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    copyBtnText: document.getElementById('copy-btn-text'),
    postTweetBtn: document.getElementById('post-tweet-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn')
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleaseNotes(false); // Load cached or fresh notes on load
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.className = savedTheme;
    } else {
        // Default to dark mode
        document.body.className = 'theme-dark';
        localStorage.setItem('theme', 'theme-dark');
    }
}

function toggleTheme() {
    if (document.body.classList.contains('theme-dark')) {
        document.body.className = 'theme-light';
        localStorage.setItem('theme', 'theme-light');
    } else {
        document.body.className = 'theme-dark';
        localStorage.setItem('theme', 'theme-dark');
    }
}

// ==========================================================================
// EVENT LISTENERS Setup
// ==========================================================================
function setupEventListeners() {
    // Theme Toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Refresh Release Notes
    elements.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.errorRetryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search Functionality
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.clearSearch.addEventListener('click', clearSearchQuery);
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Focus search: Ctrl + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.searchInput.focus();
        }
        // Focus search: '/' when not typing in inputs
        if (e.key === '/' && document.activeElement !== elements.searchInput && document.activeElement !== elements.tweetTextarea) {
            e.preventDefault();
            elements.searchInput.focus();
        }
        // Close modal: Escape
        if (e.key === 'Escape' && elements.tweetModal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Reset filters and search
    elements.resetFiltersBtn.addEventListener('click', resetAllFilters);
    
    // Category Chips
    elements.filterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        
        // Remove active class from all chips, add to clicked
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        appState.activeCategory = chip.dataset.category;
        filterAndRender();
    });
    
    // Modal Event Handlers
    elements.modalClose.addEventListener('click', closeModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeModal();
    });
    
    // Live update of tweet when options change
    elements.presetEmoji.addEventListener('change', updateTweetDraft);
    elements.presetLink.addEventListener('change', updateTweetDraft);
    elements.presetTags.addEventListener('change', updateTweetDraft);
    elements.tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    
    // Tweet actions
    elements.copyTweetBtn.addEventListener('click', copyTweetText);
    elements.postTweetBtn.addEventListener('click', postTweetToTwitter);
    
    // Export CSV action
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', exportToCSV);
    }
}

// ==========================================================================
// DATA FETCHING & STATE
// ==========================================================================
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    hideError();
    
    try {
        const url = `/api/releases?refresh=${forceRefresh}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned HTTP status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            appState.updates = data.updates;
            
            // Format and show sync date
            if (data.last_fetched) {
                const date = new Date(data.last_fetched);
                elements.syncTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + (data.source === 'cache' || data.source === 'cache_fallback' ? '(Cached)' : '(Live)');
            }
            
            computeCategoryCounts();
            filterAndRender();
        } else {
            throw new Error(data.message || 'Unknown error fetching data.');
        }
        
    } catch (error) {
        console.error('Error loading release notes:', error);
        showError(error.message || 'Could not communicate with the API server.');
    } finally {
        showLoading(false);
    }
}

function showLoading(isLoading) {
    if (isLoading) {
        elements.refreshBtn.classList.add('loading');
        elements.skeletonLoader.classList.remove('hidden');
        elements.timelineFeed.classList.add('hidden');
        elements.noResults.classList.add('hidden');
    } else {
        elements.refreshBtn.classList.remove('loading');
        elements.skeletonLoader.classList.add('hidden');
        elements.timelineFeed.classList.remove('hidden');
    }
}

function showError(msg) {
    elements.errorMessage.textContent = msg;
    elements.errorAlert.classList.remove('hidden');
}

function hideError() {
    elements.errorAlert.classList.add('hidden');
}

// ==========================================================================
// METADATA & COUNTS
// ==========================================================================
function computeCategoryCounts() {
    const counts = {
        all: appState.updates.length,
        Feature: 0,
        Issue: 0,
        Change: 0,
        Announcement: 0,
        Breaking: 0
    };
    
    appState.updates.forEach(update => {
        if (counts.hasOwnProperty(update.category)) {
            counts[update.category]++;
        } else {
            // General or other categories
            counts.all++;
        }
    });
    
    // Update labels in UI
    elements.countAll.textContent = counts.all;
    elements.countFeature.textContent = counts.Feature;
    elements.countIssue.textContent = counts.Issue;
    elements.countChange.textContent = counts.Change;
    elements.countAnnouncement.textContent = counts.Announcement;
    elements.countBreaking.textContent = counts.Breaking;
}

// ==========================================================================
// SEARCH & FILTER LOGIC
// ==========================================================================
function handleSearchInput(e) {
    appState.searchQuery = e.target.value;
    
    // Toggle clear search button visibility
    if (appState.searchQuery.length > 0) {
        elements.clearSearch.style.display = 'flex';
    } else {
        elements.clearSearch.style.display = 'none';
    }
    
    filterAndRender();
}

function clearSearchQuery() {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    elements.clearSearch.style.display = 'none';
    filterAndRender();
}

function resetAllFilters() {
    clearSearchQuery();
    
    // Reset chip selection to "All"
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-category="all"]').classList.add('active');
    appState.activeCategory = 'all';
    
    filterAndRender();
}

function filterAndRender() {
    const query = appState.searchQuery.trim().toLowerCase();
    const category = appState.activeCategory;
    
    appState.filteredUpdates = appState.updates.filter(update => {
        // Category Filter
        const categoryMatch = (category === 'all' || update.category === category);
        
        // Search Search Query
        const searchMatch = !query || 
            update.content_text.toLowerCase().includes(query) ||
            update.date.toLowerCase().includes(query) ||
            update.category.toLowerCase().includes(query);
            
        return categoryMatch && searchMatch;
    });
    
    renderTimeline();
}

// ==========================================================================
// RENDER TIMELINE LIST
// ==========================================================================
function renderTimeline() {
    elements.timelineFeed.innerHTML = '';
    
    if (appState.filteredUpdates.length === 0) {
        elements.noResults.classList.remove('hidden');
        elements.timelineFeed.classList.add('hidden');
        return;
    }
    
    elements.noResults.classList.add('hidden');
    elements.timelineFeed.classList.remove('hidden');
    
    // Group updates by date string (e.g. "June 15, 2026")
    const groups = {};
    appState.filteredUpdates.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });
    
    // Create DOM structure for each group
    Object.keys(groups).forEach(dateStr => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'timeline-group';
        
        // Date Header
        const header = document.createElement('div');
        header.className = 'timeline-date-header';
        header.innerHTML = `
            <div class="timeline-date-dot"></div>
            <h2 class="timeline-date-title">${dateStr}</h2>
        `;
        groupContainer.appendChild(header);
        
        // Cards under this date
        groups[dateStr].forEach(update => {
            const card = createCardDOM(update);
            groupContainer.appendChild(card);
        });
        
        elements.timelineFeed.appendChild(groupContainer);
    });
}

function createCardDOM(update) {
    const card = document.createElement('article');
    card.className = 'update-card';
    card.dataset.id = update.id;
    
    const categoryClass = `badge-${update.category.toLowerCase()}`;
    const cleanBadgeText = update.category;
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-meta">
                <span class="badge ${categoryClass}">${cleanBadgeText}</span>
                <span class="card-date">${update.date}</span>
            </div>
        </div>
        <div class="card-body">
            ${update.content_html}
        </div>
        <div class="card-actions">
            ${update.link ? `
                <a href="${update.link}" target="_blank" rel="noopener" class="btn-card" aria-label="Open official GCP BigQuery release logs">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    <span>Official Log</span>
                </a>
            ` : ''}
            <button class="btn-card btn-copy-card" data-id="${update.id}" aria-label="Copy update text to clipboard">
                <svg class="icon-copy" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <svg class="icon-check hidden" viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="copy-text-label">Copy Card</span>
            </button>
            <button class="btn-card btn-tweet" data-id="${update.id}" aria-label="Draft a Tweet about this release note">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
                <span>Tweet Update</span>
            </button>
        </div>
    `;
    
    // Hook event listener directly to the Copy button
    card.querySelector('.btn-copy-card').addEventListener('click', (e) => {
        copyCardText(update, e.currentTarget);
    });
    
    // Hook event listener directly to the Tweet button
    card.querySelector('.btn-tweet').addEventListener('click', () => {
        openTweetModal(update);
    });
    
    return card;
}

// ==========================================================================
// TWEET COMPOSER MODAL (X SHARER)
// ==========================================================================
function openTweetModal(update) {
    appState.currentTweetUpdate = update;
    
    // Set checkboxes to checked default
    elements.presetEmoji.checked = true;
    elements.presetLink.checked = true;
    elements.presetTags.checked = true;
    
    updateTweetDraft();
    
    // Show Modal
    elements.tweetModal.classList.add('active');
    elements.tweetModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Stop scrolling
    
    // Auto-focus textarea and position cursor at the end
    setTimeout(() => {
        elements.tweetTextarea.focus();
        elements.tweetTextarea.selectionStart = elements.tweetTextarea.selectionEnd = elements.tweetTextarea.value.length;
    }, 100);
}

function closeModal() {
    elements.tweetModal.classList.remove('active');
    elements.tweetModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Resume scrolling
    appState.currentTweetUpdate = null;
    
    // Reset copy button state
    resetCopyButton();
}

function updateTweetDraft() {
    const update = appState.currentTweetUpdate;
    if (!update) return;
    
    const emojiOpt = elements.presetEmoji.checked;
    const linkOpt = elements.presetLink.checked;
    const tagsOpt = elements.presetTags.checked;
    
    const emoji = emojiOpt ? "🚀 " : "";
    const category = update.category.toUpperCase();
    const dateStr = `[${update.date}]`;
    const cleanContent = update.content_text;
    
    const hashtags = tagsOpt ? "\n\n#BigQuery #GoogleCloud" : "";
    
    // We append the URL if the toggle is checked. We also use a mock URL on Twitter compose if link is empty.
    const url = update.link || "https://docs.cloud.google.com/bigquery/docs/release-notes";
    const linkSuffix = linkOpt ? `\n\nRead more: ${url}` : "";
    
    // Define tweet heading structure: "🚀 Google #BigQuery FEATURE [June 15, 2026]:\n\n"
    const heading = `${emoji}Google #BigQuery ${category} ${dateStr}:\n\n`;
    
    // Calculate how many characters are left for the core content body
    const totalExtraLength = heading.length + linkSuffix.length + hashtags.length;
    const maxBodyLength = 280 - totalExtraLength;
    
    let tweetBodyText = cleanContent;
    if (cleanContent.length > maxBodyLength) {
        // Truncate text nicely
        tweetBodyText = cleanContent.substring(0, maxBodyLength - 3) + "...";
    }
    
    const draftText = `${heading}${tweetBodyText}${linkSuffix}${hashtags}`;
    
    elements.tweetTextarea.value = draftText;
    updateCharCounter(draftText.length);
}

function handleTweetTextareaInput(e) {
    updateCharCounter(e.target.value.length);
}

function updateCharCounter(length) {
    const remaining = 280 - length;
    elements.charCountText.textContent = remaining;
    
    // Calculate percentage filled for the SVG Ring loader (Circumference is 100)
    let percent = Math.min((length / 280) * 100, 100);
    elements.charRingProgress.style.strokeDasharray = `${percent}, 100`;
    
    // Dynamic styling changes based on limit proximity
    if (remaining < 0) {
        elements.charCountText.classList.add('danger');
        elements.charRingProgress.className.baseVal = 'ring-progress danger';
        elements.postTweetBtn.disabled = true;
        elements.postTweetBtn.style.opacity = '0.5';
        elements.postTweetBtn.style.cursor = 'not-allowed';
    } else if (remaining <= 20) {
        elements.charCountText.classList.remove('danger');
        elements.charCountText.classList.add('warning');
        elements.charRingProgress.className.baseVal = 'ring-progress warning';
        elements.postTweetBtn.disabled = false;
        elements.postTweetBtn.style.opacity = '1';
        elements.postTweetBtn.style.cursor = 'pointer';
    } else {
        elements.charCountText.classList.remove('danger', 'warning');
        elements.charRingProgress.className.baseVal = 'ring-progress';
        elements.postTweetBtn.disabled = false;
        elements.postTweetBtn.style.opacity = '1';
        elements.postTweetBtn.style.cursor = 'pointer';
    }
}

// Copy Action
async function copyTweetText() {
    const text = elements.tweetTextarea.value;
    try {
        await navigator.clipboard.writeText(text);
        
        // Morph to green check checkmark
        elements.copyTweetBtn.querySelector('.icon-copy').classList.add('hidden');
        elements.copyTweetBtn.querySelector('.icon-check').classList.remove('hidden');
        elements.copyBtnText.textContent = 'Copied!';
        elements.copyTweetBtn.classList.add('btn-secondary-success');
        
        setTimeout(resetCopyButton, 2000);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        alert('Failed to copy text. Please select and copy manually.');
    }
}

function resetCopyButton() {
    elements.copyTweetBtn.querySelector('.icon-copy').classList.remove('hidden');
    elements.copyTweetBtn.querySelector('.icon-check').classList.add('hidden');
    elements.copyBtnText.textContent = 'Copy Text';
    elements.copyTweetBtn.classList.remove('btn-secondary-success');
}

// Post Tweet Web Intent Action
function postTweetToTwitter() {
    const text = elements.tweetTextarea.value;
    if (text.length > 280) return; // Prevent posting over limit
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
}

// Copy Card Text Action
async function copyCardText(update, button) {
    try {
        await navigator.clipboard.writeText(update.content_text);
        
        const iconCopy = button.querySelector('.icon-copy');
        const iconCheck = button.querySelector('.icon-check');
        const label = button.querySelector('.copy-text-label');
        
        iconCopy.classList.add('hidden');
        iconCheck.classList.remove('hidden');
        label.textContent = 'Copied!';
        button.style.color = '#10b981'; // Green color on success
        
        setTimeout(() => {
            iconCopy.classList.remove('hidden');
            iconCheck.classList.add('hidden');
            label.textContent = 'Copy Card';
            button.style.color = ''; // Reset style
        }, 2000);
    } catch (err) {
        console.error('Failed to copy card text:', err);
        alert('Could not copy card text. Please select manually.');
    }
}

// Export Filtered Updates to CSV
function exportToCSV() {
    const updatesToExport = appState.filteredUpdates;
    if (updatesToExport.length === 0) {
        alert("No updates match the current search or filters. Nothing to export.");
        return;
    }
    
    // CSV headers
    const headers = ["Date", "Category", "Official Link", "Content"];
    
    // Convert updates list to rows
    const rows = updatesToExport.map(u => [
        u.date,
        u.category,
        u.link,
        u.content_text
    ]);
    
    // Clean and quote cells to avoid breaking CSV format
    const escapeCSVCell = (text) => {
        if (text === null || text === undefined) return '';
        let val = text.toString();
        val = val.replace(/"/g, '""'); // Double double-quotes
        if (val.search(/("|,|\n)/g) >= 0) {
            val = `"${val}"`;
        }
        return val;
    };
    
    // Build CSV content string
    const csvContent = [
        headers.map(escapeCSVCell).join(','),
        ...rows.map(row => row.map(escapeCSVCell).join(','))
    ].join('\n');
    
    // Download trigger
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const datestr = new Date().toISOString().split('T')[0];
        const filename = `bigquery_releases_${appState.activeCategory}_${datestr}.csv`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error('CSV Export failed:', e);
        alert('CSV Export failed. Please try again.');
    }
}

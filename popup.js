// Utility function to get current active tab
const getCurrentTab = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    } catch (error) {
        console.error('Error getting current tab:', error);
        throw error;
    }
};

// Global variables for state management
let currentBookmarks = [];
let filteredBookmarks = [];
let currentVideoData = {};
let searchTerm = '';
let sortBy = 'time'; // 'time', 'description', 'date'

// DOM elements
let bookmarksContainer;
let searchInput;
let filterSelect;
let sortSelect;
let videoInfoContainer;

// Initialize popup
const initPopup = async () => {
    try {
        await setupUI();
        await loadCurrentVideoData();
        await loadBookmarks();
        setupEventListeners();
        setupKeyboardShortcuts();
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Failed to load bookmarks');
    }
};

// Setup UI elements
const setupUI = () => {
    const container = document.querySelector('.container');
    
    // Create video info section
    videoInfoContainer = document.createElement('div');
    videoInfoContainer.className = 'video-info';
    container.insertBefore(videoInfoContainer, container.firstChild);

    // Create search and filter section
    const controlsSection = document.createElement('div');
    controlsSection.className = 'controls-section';
    
    // Search input
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search bookmarks...';
    searchInput.className = 'search-input';
    
    // Filter select
    filterSelect = document.createElement('select');
    filterSelect.className = 'filter-select';
    filterSelect.innerHTML = `
        <option value="all">All bookmarks</option>
        <option value="recent">Recent (last 7 days)</option>
        <option value="today">Today</option>
        <option value="week">This week</option>
    `;
    
    // Sort select
    sortSelect = document.createElement('select');
    sortSelect.className = 'sort-select';
    sortSelect.innerHTML = `
        <option value="time">Sort by time</option>
        <option value="description">Sort by description</option>
        <option value="date">Sort by date</option>
    `;
    
    controlsSection.appendChild(searchInput);
    controlsSection.appendChild(filterSelect);
    controlsSection.appendChild(sortSelect);
    
    container.insertBefore(controlsSection, container.querySelector('.bookmarks'));
    
    // Update bookmarks container reference
    bookmarksContainer = document.getElementById('bookmarks');
};

// Load current video data
const loadCurrentVideoData = async () => {
    try {
        const activeTab = await getCurrentTab();
        if (activeTab.url.includes("youtube.com/watch")) {
            const queryParameters = activeTab.url.split("?")[1];
            const urlParameters = new URLSearchParams(queryParameters);
            const currentVideo = urlParameters.get("v");
            
            // Get video data from content script
            chrome.tabs.sendMessage(activeTab.id, { type: "GET_VIDEO_DATA" }, (response) => {
                if (response) {
                    currentVideoData = response;
                    updateVideoInfo();
                }
            });
        }
    } catch (error) {
        console.error('Error loading video data:', error);
    }
};

// Update video information display
const updateVideoInfo = () => {
    try {
        if (currentVideoData.title) {
            videoInfoContainer.innerHTML = `
                <div class="video-title">${currentVideoData.title}</div>
                <div class="video-stats">
                    <span class="bookmark-count">${currentBookmarks.length} bookmark${currentBookmarks.length !== 1 ? 's' : ''}</span>
                    ${currentVideoData.duration ? `<span class="video-duration">Duration: ${formatTime(currentVideoData.duration)}</span>` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error updating video info:', error);
    }
};

// Load bookmarks from storage
const loadBookmarks = async () => {
    try {
        const activeTab = await getCurrentTab();
        if (activeTab.url.includes("youtube.com/watch")) {
            const queryParameters = activeTab.url.split("?")[1];
            const urlParameters = new URLSearchParams(queryParameters);
            const currentVideo = urlParameters.get("v");

            chrome.storage.sync.get([currentVideo], (data) => {
                try {
                    currentBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
                    filteredBookmarks = [...currentBookmarks];
                    updateVideoInfo();
                    renderBookmarks();
                } catch (error) {
                    console.error('Error parsing bookmarks:', error);
                    currentBookmarks = [];
                    filteredBookmarks = [];
                    renderBookmarks();
                }
            });
        } else {
            showNotYouTubePage();
        }
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        showError('Failed to load bookmarks');
    }
};

// Setup event listeners
const setupEventListeners = () => {
    // Search functionality
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        filterAndRenderBookmarks();
    });

    // Filter functionality
    filterSelect.addEventListener('change', () => {
        filterAndRenderBookmarks();
    });

    // Sort functionality
    sortSelect.addEventListener('change', () => {
        sortBy = sortSelect.value;
        filterAndRenderBookmarks();
    });
};

// Setup keyboard shortcuts
const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
        // Ctrl+F or Cmd+F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            searchTerm = '';
            filterAndRenderBookmarks();
        }
    });
};

// Filter and render bookmarks
const filterAndRenderBookmarks = () => {
    try {
        let filtered = [...currentBookmarks];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(bookmark => 
                bookmark.desc.toLowerCase().includes(searchTerm) ||
                formatTime(bookmark.time).includes(searchTerm)
            );
        }

        // Apply date filter
        const filterValue = filterSelect.value;
        if (filterValue !== 'all') {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const oneWeek = 7 * oneDay;

            filtered = filtered.filter(bookmark => {
                const bookmarkDate = bookmark.timestamp || 0;
                const daysDiff = (now - bookmarkDate) / oneDay;

                switch (filterValue) {
                    case 'recent':
                        return daysDiff <= 7;
                    case 'today':
                        return daysDiff <= 1;
                    case 'week':
                        return daysDiff <= 7;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'time':
                    return a.time - b.time;
                case 'description':
                    return a.desc.localeCompare(b.desc);
                case 'date':
                    return (b.timestamp || 0) - (a.timestamp || 0);
                default:
                    return 0;
            }
        });

        filteredBookmarks = filtered;
        renderBookmarks();
    } catch (error) {
        console.error('Error filtering bookmarks:', error);
    }
};

// Render bookmarks in the UI
const renderBookmarks = () => {
    try {
        bookmarksContainer.innerHTML = "";

        if (filteredBookmarks.length > 0) {
            filteredBookmarks.forEach((bookmark) => {
                addNewBookmark(bookmarksContainer, bookmark);
            });
        } else {
            const noBookmarksMessage = searchTerm || filterSelect.value !== 'all' 
                ? 'No bookmarks match your search/filter criteria.' 
                : 'No bookmarks added yet.';
            bookmarksContainer.innerHTML = `<div class="no-bookmarks">${noBookmarksMessage}</div>`;
        }
    } catch (error) {
        console.error('Error rendering bookmarks:', error);
        bookmarksContainer.innerHTML = '<div class="error">Error loading bookmarks</div>';
    }
};

// Create bookmark element
const addNewBookmark = (bookmarksElement, bookmark) => {
    try {
        const bookmarkElement = document.createElement("div");
        bookmarkElement.className = "bookmark";
        bookmarkElement.id = "bookmark-" + bookmark.time;
        bookmarkElement.setAttribute("timestamp", bookmark.time);

        const bookmarkContent = document.createElement("div");
        bookmarkContent.className = "bookmark-content";

        const timeElement = document.createElement("div");
        timeElement.className = "bookmark-time";
        timeElement.textContent = formatTime(bookmark.time);

        const descElement = document.createElement("div");
        descElement.className = "bookmark-description";
        descElement.textContent = bookmark.desc;

        const dateElement = document.createElement("div");
        dateElement.className = "bookmark-date";
        dateElement.textContent = formatDate(bookmark.timestamp);

        const controlsElement = document.createElement("div");
        controlsElement.className = "bookmark-controls";

        // Play button
        const playBtn = document.createElement("img");
        playBtn.src = "assets/play.png";
        playBtn.title = "Play at this timestamp";
        playBtn.className = "control-btn play-btn";
        playBtn.addEventListener("click", () => onPlay(bookmark.time));

        // Delete button
        const deleteBtn = document.createElement("img");
        deleteBtn.src = "assets/delete.png";
        deleteBtn.title = "Delete bookmark";
        deleteBtn.className = "control-btn delete-btn";
        deleteBtn.addEventListener("click", () => onDelete(bookmark.time));

        // Edit button
        const editBtn = document.createElement("img");
        editBtn.src = "assets/edit.png";
        editBtn.title = "Edit bookmark";
        editBtn.className = "control-btn edit-btn";
        editBtn.addEventListener("click", () => onEdit(bookmark));

        bookmarkContent.appendChild(timeElement);
        bookmarkContent.appendChild(descElement);
        bookmarkContent.appendChild(dateElement);

        controlsElement.appendChild(playBtn);
        controlsElement.appendChild(editBtn);
        controlsElement.appendChild(deleteBtn);

        bookmarkElement.appendChild(bookmarkContent);
        bookmarkElement.appendChild(controlsElement);
        bookmarksElement.appendChild(bookmarkElement);
    } catch (error) {
        console.error('Error creating bookmark element:', error);
    }
};

// Play bookmark
const onPlay = async (bookmarkTime) => {
    try {
        console.log('=== PLAY BUTTON CLICKED ===');
        console.log('Playing bookmark at time:', bookmarkTime);
        const activeTab = await getCurrentTab();
        console.log('Active tab:', activeTab);
        
        if (!activeTab || !activeTab.id) {
            console.error('No active tab found');
            showError('No active tab found');
            return;
        }
        
        console.log('Sending PLAY message to content script...');
        chrome.tabs.sendMessage(activeTab.id, { 
            type: "PLAY", 
            value: parseFloat(bookmarkTime) 
        }, (response) => {
            console.log('Play response received:', response);
            if (chrome.runtime.lastError) {
                console.error('Error sending play message:', chrome.runtime.lastError);
                showError('Failed to play bookmark - make sure you are on a YouTube video page');
            } else if (response && response.success) {
                console.log('Play message sent successfully');
                window.close(); // Close popup after playing
            } else {
                console.error('Play failed:', response);
                showError('Failed to play bookmark - video player not found');
            }
        });
    } catch (error) {
        console.error('Error playing bookmark:', error);
        showError('Failed to play bookmark');
    }
};

// Delete bookmark
const onDelete = async (bookmarkTime) => {
    try {
        console.log('=== DELETE BUTTON CLICKED ===');
        console.log('Deleting bookmark at time:', bookmarkTime);
        const activeTab = await getCurrentTab();
        console.log('Active tab:', activeTab);
        
        if (!activeTab || !activeTab.id) {
            console.error('No active tab found');
            showError('No active tab found');
            return;
        }
        
        // Remove from UI immediately
        const bookmarkElement = document.getElementById("bookmark-" + bookmarkTime);
        if (bookmarkElement) {
            bookmarkElement.remove();
        }

        console.log('Sending DELETE message to content script...');
        // Remove from storage
        chrome.tabs.sendMessage(activeTab.id, {
            type: "DELETE",
            value: parseFloat(bookmarkTime),
        }, (response) => {
            console.log('Delete response received:', response);
            if (chrome.runtime.lastError) {
                console.error('Error sending delete message:', chrome.runtime.lastError);
                showError('Failed to delete bookmark - make sure you are on a YouTube video page');
                // Re-add the element if deletion failed
                if (bookmarkElement) {
                    bookmarksContainer.appendChild(bookmarkElement);
                }
            } else if (response) {
                console.log('Delete successful, updating bookmarks');
                currentBookmarks = response;
                filteredBookmarks = [...currentBookmarks];
                updateVideoInfo();
                filterAndRenderBookmarks();
            }
        });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        showError('Failed to delete bookmark');
    }
};

// Edit bookmark
const onEdit = (bookmark) => {
    try {
        console.log('=== EDIT BUTTON CLICKED ===');
        console.log('Editing bookmark:', bookmark);
        const newDescription = prompt('Edit bookmark description:', bookmark.desc);
        
        if (newDescription !== null && newDescription.trim() !== '') {
            bookmark.desc = newDescription.trim();
            bookmark.timestamp = Date.now(); // Update timestamp
            
            console.log('Updated bookmark:', bookmark);
            // Update in storage
            updateBookmarkInStorage(bookmark);
        }
    } catch (error) {
        console.error('Error editing bookmark:', error);
        showError('Failed to edit bookmark');
    }
};

// Update bookmark in storage
const updateBookmarkInStorage = async (updatedBookmark) => {
    try {
        console.log('Updating bookmark in storage:', updatedBookmark);
        const activeTab = await getCurrentTab();
        
        if (!activeTab || !activeTab.url.includes("youtube.com/watch")) {
            showError('Not on a YouTube video page');
            return;
        }
        
        const queryParameters = activeTab.url.split("?")[1];
        const urlParameters = new URLSearchParams(queryParameters);
        const currentVideo = urlParameters.get("v");

        if (!currentVideo) {
            showError('Could not get video ID');
            return;
        }

        // Update local array
        const index = currentBookmarks.findIndex(b => b.time === updatedBookmark.time);
        if (index !== -1) {
            currentBookmarks[index] = updatedBookmark;
            filteredBookmarks = [...currentBookmarks];
            
            console.log('Saving updated bookmarks:', currentBookmarks);
            
            // Update storage
            chrome.storage.sync.set({
                [currentVideo]: JSON.stringify(currentBookmarks)
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    showError('Failed to save changes');
                } else {
                    console.log('Bookmark updated successfully');
                    updateVideoInfo();
                    filterAndRenderBookmarks();
                }
            });
        } else {
            console.error('Bookmark not found in local array');
            showError('Bookmark not found');
        }
    } catch (error) {
        console.error('Error updating bookmark in storage:', error);
        showError('Failed to save changes');
    }
};

// Format time to HH:MM:SS
const formatTime = (seconds) => {
    try {
        if (!seconds || isNaN(seconds)) return '00:00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return '00:00:00';
    }
};

// Format date
const formatDate = (timestamp) => {
    try {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays <= 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

// Show error message
const showError = (message) => {
    try {
        const container = document.querySelector('.container');
        container.innerHTML = `<div class="error-message">${message}</div>`;
    } catch (error) {
        console.error('Error showing error message:', error);
    }
};

// Show not YouTube page message
const showNotYouTubePage = () => {
    try {
        const container = document.querySelector('.container');
        container.innerHTML = `
            <div class="not-youtube">
                <div class="title">This is not a YouTube video page.</div>
                <div class="subtitle">Please navigate to a YouTube video to use bookmarks.</div>
            </div>
        `;
    } catch (error) {
        console.error('Error showing not YouTube page message:', error);
    }
};

// Debug function to test functionality
const debugExtension = async () => {
    try {
        console.log('=== DEBUGGING EXTENSION ===');
        const activeTab = await getCurrentTab();
        console.log('Active tab:', activeTab);
        
        if (activeTab && activeTab.url.includes("youtube.com/watch")) {
            console.log('On YouTube video page');
            
            // Test getting video data
            chrome.tabs.sendMessage(activeTab.id, { type: "GET_VIDEO_DATA" }, (response) => {
                console.log('Video data response:', response);
            });
            
            // Test storage
            const queryParameters = activeTab.url.split("?")[1];
            const urlParameters = new URLSearchParams(queryParameters);
            const currentVideo = urlParameters.get("v");
            console.log('Current video ID:', currentVideo);
            
            chrome.storage.sync.get([currentVideo], (data) => {
                console.log('Storage data:', data);
            });
        } else {
            console.log('Not on YouTube video page');
        }
    } catch (error) {
        console.error('Debug error:', error);
    }
};

// Add debug function to window for testing
window.debugExtension = debugExtension;

// Test function for button functionality
window.testButtonFunctionality = () => {
    console.log('=== TESTING BUTTON FUNCTIONALITY ===');
    
    // Test if buttons exist
    const playButtons = document.querySelectorAll('.play-btn');
    const editButtons = document.querySelectorAll('.edit-btn');
    const deleteButtons = document.querySelectorAll('.delete-btn');
    
    console.log('Play buttons found:', playButtons.length);
    console.log('Edit buttons found:', editButtons.length);
    console.log('Delete buttons found:', deleteButtons.length);
    
    // Test if buttons are clickable
    playButtons.forEach((btn, index) => {
        console.log(`Play button ${index}:`, {
            exists: !!btn,
            clickable: btn.style.pointerEvents !== 'none',
            visible: btn.offsetParent !== null
        });
    });
    
    return {
        playButtons: playButtons.length,
        editButtons: editButtons.length,
        deleteButtons: deleteButtons.length
    };
};

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", initPopup);
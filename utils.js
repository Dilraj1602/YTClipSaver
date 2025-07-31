// Utility functions for the YouTube Bookmark Extension

/**
 * Get the currently active tab
 * @returns {Promise<chrome.tabs.Tab>} The active tab object
 */
export async function getCurrentTab() {
    try {
        const queryOptions = { active: true, currentWindow: true };
        const [tab] = await chrome.tabs.query(queryOptions);
        
        if (!tab) {
            throw new Error('No active tab found');
        }
        
        return tab;
    } catch (error) {
        console.error('Error getting current tab:', error);
        throw error;
    }
}

/**
 * Format time in seconds to HH:MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
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
}

/**
 * Format date to relative time string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string
 */
export function formatDate(timestamp) {
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
}

/**
 * Validate bookmark data
 * @param {Object} bookmark - Bookmark object to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateBookmark(bookmark) {
    try {
        if (!bookmark || typeof bookmark !== 'object') {
            return false;
        }
        
        if (typeof bookmark.time !== 'number' || bookmark.time < 0) {
            return false;
        }
        
        if (typeof bookmark.desc !== 'string' || bookmark.desc.trim() === '') {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error validating bookmark:', error);
        return false;
    }
}

/**
 * Generate a unique ID for bookmarks
 * @returns {string} Unique ID
 */
export function generateBookmarkId() {
    try {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    } catch (error) {
        console.error('Error generating bookmark ID:', error);
        return Date.now().toString();
    }
}
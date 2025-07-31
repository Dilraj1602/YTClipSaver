// Background script for YouTube Bookmark Extension
// Handles tab updates and communicates with content scripts

// Listen for tab updates to detect YouTube video pages
chrome.tabs.onUpdated.addListener((tabId, tab) => {
    try {
        // Check if the tab URL is a YouTube video page
        if (tab.url && tab.url.includes("youtube.com/watch")) {
            // Extract video ID from URL parameters
            const queryParameters = tab.url.split("?")[1];
            if (!queryParameters) {
                console.warn('No query parameters found in YouTube URL');
                return;
            }

            const urlParameters = new URLSearchParams(queryParameters);
            const videoId = urlParameters.get("v");

            if (!videoId) {
                console.warn('No video ID found in YouTube URL');
                return;
            }

            // Send message to content script with video ID
            chrome.tabs.sendMessage(tabId, {
                type: "NEW",
                videoId: videoId,
            }, (response) => {
                // Handle any errors in message sending
                if (chrome.runtime.lastError) {
                    console.error('Error sending message to content script:', chrome.runtime.lastError);
                }
            });
        }
    } catch (error) {
        console.error('Error handling tab update:', error);
    }
});

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
    try {
        if (details.reason === 'install') {
            console.log('YouTube Bookmark Extension installed');
        } else if (details.reason === 'update') {
            console.log('YouTube Bookmark Extension updated');
        }
    } catch (error) {
        console.error('Error handling extension install/update:', error);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    try {
        // This will open the popup automatically due to manifest configuration
        console.log('Extension icon clicked');
    } catch (error) {
        console.error('Error handling extension icon click:', error);
    }
});
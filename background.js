// Background service worker for YTClipSaver extension
let currentVideoId = "";

// Listen for tab updates to detect YouTube video navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    try {
        // Only process if the tab is complete and on YouTube
        if (changeInfo.status === 'complete' && tab.url && tab.url.includes("youtube.com/watch")) {
            console.log('YouTube video page detected:', tab.url);
            
            // Extract video ID from URL
            const urlParams = new URLSearchParams(tab.url.split("?")[1]);
            const videoId = urlParams.get("v");
            
            if (videoId && videoId !== currentVideoId) {
                console.log('New video detected:', videoId);
                currentVideoId = videoId;
                
                // Send message to content script to initialize
                chrome.tabs.sendMessage(tabId, {
                    type: "NEW",
                    videoId: videoId
                }).catch(error => {
                    console.log('Content script not ready yet, will retry...');
                    // Retry after a short delay
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                            type: "NEW",
                            videoId: videoId
                        }).catch(err => {
                            console.log('Content script still not ready');
                        });
                    }, 1000);
                });
            }
        }
    } catch (error) {
        console.error('Error in tab update listener:', error);
    }
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    try {
        console.log('YTClipSaver extension installed');
        
        // Set default settings
        chrome.storage.sync.set({
            'extensionSettings': {
                'version': '1.0',
                'installedAt': Date.now()
            }
        });
    } catch (error) {
        console.error('Error during extension installation:', error);
    }
});

// Handle extension action click (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Only work on YouTube pages
        if (tab.url && tab.url.includes("youtube.com/watch")) {
            console.log('Extension icon clicked on YouTube page');
            
            // Extract current video ID
            const urlParams = new URLSearchParams(tab.url.split("?")[1]);
            const videoId = urlParams.get("v");
            
            if (videoId) {
                currentVideoId = videoId;
                
                // Send message to content script to refresh
                chrome.tabs.sendMessage(tab.id, {
                    type: "NEW",
                    videoId: videoId
                }).catch(error => {
                    console.log('Content script not ready, opening popup instead');
                });
            }
        }
    } catch (error) {
        console.error('Error handling extension action:', error);
    }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        console.log('Background received message:', request);
        
        switch (request.type) {
            case "GET_CURRENT_VIDEO":
                sendResponse({ videoId: currentVideoId });
                break;
                
            case "REFRESH_CONTENT_SCRIPT":
                // Force content script refresh
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    files: ['contentScript.js']
                }).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Error refreshing content script:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep message channel open
                
            default:
                console.log('Unknown message type:', request.type);
        }
    } catch (error) {
        console.error('Error handling message in background:', error);
    }
});
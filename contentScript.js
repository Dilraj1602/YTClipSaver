(() => {
    // Global variables for YouTube elements and current video state
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];
    let isBookmarkModalOpen = false;
    
    // YouTube video data cache
    let currentVideoData = {
        title: "",
        duration: 0,
        thumbnail: ""
    };

    // Keyboard shortcut handler
    const handleKeyboardShortcut = (event) => {
        // Ctrl+B or Cmd+B to add bookmark
        if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
            event.preventDefault();
            addNewBookmarkEventHandler();
        }
        // Escape to close modal if open
        if (event.key === 'Escape' && isBookmarkModalOpen) {
            closeBookmarkModal();
        }
    };

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyboardShortcut);

    // Message listener for communication with background and popup
    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        try {
            console.log('=== CONTENT SCRIPT RECEIVED MESSAGE ===');
            console.log('Message object:', obj);
            const { type, value, videoId } = obj;

            switch (type) {
                case "NEW":
                    console.log('Processing NEW message with videoId:', videoId);
                    currentVideo = videoId;
                    newVideoLoaded();
                    break;
                case "PLAY":
                    console.log('=== PROCESSING PLAY MESSAGE ===');
                    console.log('Received PLAY message with value:', value);
                    console.log('youtubePlayer exists:', !!youtubePlayer);
                    console.log('Value is valid number:', !isNaN(value));
                    
                    if (youtubePlayer && !isNaN(value)) {
                        const timeToPlay = parseFloat(value);
                        console.log('Setting video time to:', timeToPlay);
                        youtubePlayer.currentTime = timeToPlay;
                        console.log('Video time set successfully');
                        response({ success: true });
                    } else {
                        console.error('Cannot play: youtubePlayer not found or invalid time value');
                        response({ success: false, error: 'Player not found or invalid time' });
                    }
                    break;
                case "DELETE":
                    console.log('=== PROCESSING DELETE MESSAGE ===');
                    console.log('Received DELETE message with value:', value);
                    deleteBookmark(value).then(updatedBookmarks => {
                        console.log('Delete successful, returning updated bookmarks:', updatedBookmarks);
                        response(updatedBookmarks);
                    }).catch(error => {
                        console.error('Error in delete operation:', error);
                        response([]);
                    });
                    return true; // Keep message channel open for async response
                case "GET_VIDEO_DATA":
                    console.log('Processing GET_VIDEO_DATA message');
                    response(currentVideoData);
                    break;
                default:
                    console.warn('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Fetch bookmarks from Chrome storage
    const fetchBookmarks = async () => {
        try {
            return new Promise((resolve) => {
                // Check if extension context is still valid
                if (!chrome.runtime || !chrome.runtime.id) {
                    console.error('Extension context invalidated');
                    resolve([]);
                    return;
                }

                chrome.storage.sync.get([currentVideo], (obj) => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage error:', chrome.runtime.lastError);
                        resolve([]);
                        return;
                    }
                    resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
                });
            });
        } catch (error) {
            console.error('Error fetching bookmarks:', error);
            return [];
        }
    };

    // Get current video information
    const getVideoData = () => {
        try {
            const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 
                              document.querySelector('h1.title')?.textContent?.trim() || 
                              'Unknown Video';
            
            const videoThumbnail = document.querySelector('meta[property="og:image"]')?.content || 
                                  document.querySelector('link[rel="image_src"]')?.href || 
                                  '';

            return {
                title: videoTitle,
                duration: youtubePlayer?.duration || 0,
                thumbnail: videoThumbnail
            };
        } catch (error) {
            console.error('Error getting video data:', error);
            return { title: 'Unknown Video', duration: 0, thumbnail: '' };
        }
    };

    // Initialize bookmark button and video data
    const newVideoLoaded = async () => {
        try {
            console.log('New video loaded, video ID:', currentVideo);
            const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
            currentVideoBookmarks = await fetchBookmarks();
            console.log('Loaded bookmarks:', currentVideoBookmarks);
            
            // Get video data
            currentVideoData = getVideoData();
            console.log('Video data:', currentVideoData);

            if (!bookmarkBtnExists) {
                console.log('Creating bookmark button...');
                createBookmarkButton();
            } else {
                console.log('Bookmark button already exists');
            }
        } catch (error) {
            console.error('Error loading new video:', error);
        }
    };

    // Create and add bookmark button to YouTube controls
    const createBookmarkButton = () => {
        try {
            console.log('Creating bookmark button...');
            const bookmarkBtn = document.createElement("img");
            bookmarkBtn.src = chrome.runtime.getURL("assets/bookmark.png");
            bookmarkBtn.className = "ytp-button bookmark-btn";
            bookmarkBtn.title = "Click to bookmark current timestamp (Ctrl+B)";
            bookmarkBtn.style.cursor = "pointer";

            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
            youtubePlayer = document.getElementsByClassName("video-stream")[0];

            console.log('YouTube elements found:', { 
                youtubeLeftControls: !!youtubeLeftControls, 
                youtubePlayer: !!youtubePlayer 
            });

            if (youtubeLeftControls && youtubePlayer) {
                youtubeLeftControls.appendChild(bookmarkBtn);
                bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
                console.log('Bookmark button added successfully');
            } else {
                console.warn('YouTube controls not found, retrying in 1 second...');
                setTimeout(createBookmarkButton, 1000);
            }
        } catch (error) {
            console.error('Error creating bookmark button:', error);
        }
    };

    // Create modal for custom bookmark description
    const createBookmarkModal = (currentTime) => {
        try {
            console.log('Creating bookmark modal for time:', currentTime);
            
            // Remove existing modal if any
            const existingModal = document.getElementById('bookmark-modal');
            if (existingModal) {
                console.log('Removing existing modal');
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'bookmark-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 10px;
                min-width: 300px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;

            const title = document.createElement('h3');
            title.textContent = 'Add Bookmark';
            title.style.margin = '0 0 15px 0';
            title.style.color = '#333';

            const timeDisplay = document.createElement('p');
            timeDisplay.textContent = `Time: ${getTime(currentTime)}`;
            timeDisplay.style.margin = '0 0 15px 0';
            timeDisplay.style.color = '#666';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter bookmark description (optional)';
            input.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin-bottom: 15px;
                box-sizing: border-box;
            `;

            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            `;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 5px;
                cursor: pointer;
            `;
            cancelBtn.onclick = closeBookmarkModal;

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save Bookmark';
            saveBtn.style.cssText = `
                padding: 8px 16px;
                background: #ff0000;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            `;
            saveBtn.onclick = () => {
                console.log('Save button clicked, description:', input.value.trim());
                saveBookmark(currentTime, input.value.trim());
            };

            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(saveBtn);

            modalContent.appendChild(title);
            modalContent.appendChild(timeDisplay);
            modalContent.appendChild(input);
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);

            document.body.appendChild(modal);
            input.focus();
            isBookmarkModalOpen = true;
            console.log('Modal created and displayed');

            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter key pressed, saving bookmark');
                    saveBookmark(currentTime, input.value.trim());
                }
            });

        } catch (error) {
            console.error('Error creating bookmark modal:', error);
        }
    };

    // Close bookmark modal
    const closeBookmarkModal = () => {
        try {
            const modal = document.getElementById('bookmark-modal');
            if (modal) {
                modal.remove();
            }
            isBookmarkModalOpen = false;
        } catch (error) {
            console.error('Error closing modal:', error);
        }
    };

    // Save bookmark with custom description
    const saveBookmark = async (currentTime, description) => {
        try {
            console.log('Saving bookmark:', { currentTime, description, currentVideo });
            
            // Check if extension context is still valid
            if (!chrome.runtime || !chrome.runtime.id) {
                console.error('Extension context invalidated during save');
                showContextLostError();
                return;
            }
            
            const newBookmark = {
                time: currentTime,
                desc: description || `Bookmark at ${getTime(currentTime)}`,
                timestamp: Date.now()
            };
            console.log('New bookmark object:', newBookmark);

            currentVideoBookmarks = await fetchBookmarks();
            console.log('Current bookmarks before adding:', currentVideoBookmarks);
            
            currentVideoBookmarks.push(newBookmark);
            currentVideoBookmarks.sort((a, b) => a.time - b.time);
            console.log('Bookmarks after adding:', currentVideoBookmarks);

            // Retry mechanism for storage operations
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    await new Promise((resolve, reject) => {
                        // Check if extension context is still valid before saving
                        if (!chrome.runtime || !chrome.runtime.id) {
                            reject(new Error('Extension context invalidated'));
                            return;
                        }

                        chrome.storage.sync.set({
                            [currentVideo]: JSON.stringify(currentVideoBookmarks)
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('Storage error:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                console.log('Bookmark saved successfully to storage');
                                resolve();
                            }
                        });
                    });
                    
                    // If we get here, save was successful
                    break;
                } catch (error) {
                    retryCount++;
                    console.log(`Save attempt ${retryCount} failed:`, error);
                    
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            closeBookmarkModal();
            showNotification('Bookmark saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving bookmark:', error);
            if (error.message.includes('Extension context invalidated')) {
                showContextLostError();
            } else {
                showNotification('Failed to save bookmark', 'error');
            }
        }
    };

    // Delete bookmark
    const deleteBookmark = async (timeToDelete) => {
        try {
            console.log('Deleting bookmark at time:', timeToDelete);
            
            // Check if extension context is still valid
            if (!chrome.runtime || !chrome.runtime.id) {
                console.error('Extension context invalidated during delete');
                throw new Error('Extension context invalidated');
            }
            
            currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time != timeToDelete);
            
            await new Promise((resolve, reject) => {
                // Check if extension context is still valid before saving
                if (!chrome.runtime || !chrome.runtime.id) {
                    reject(new Error('Extension context invalidated'));
                    return;
                }

                chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage error during delete:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log('Bookmark deleted successfully, updated array:', currentVideoBookmarks);
                        resolve();
                    }
                });
            });
            
            // Return the updated bookmarks array
            return currentVideoBookmarks;
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            throw error;
        }
    };

    // Show notification to user
    const showNotification = (message, type = 'info') => {
        try {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;

            const colors = {
                success: '#4CAF50',
                error: '#f44336',
                info: '#2196F3'
            };

            notification.style.background = colors[type] || colors.info;
            notification.textContent = message;

            document.body.appendChild(notification);

            // Remove notification after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    };

    // Bookmark event handler
    const addNewBookmarkEventHandler = () => {
        try {
            console.log('Bookmark button clicked!');
            if (!youtubePlayer) {
                console.error('Video player not found');
                showNotification('Video player not found', 'error');
                return;
            }

            const currentTime = youtubePlayer.currentTime;
            console.log('Current video time:', currentTime);
            
            if (currentTime <= 0) {
                console.error('Cannot bookmark at 0 seconds');
                showNotification('Cannot bookmark at 0 seconds', 'error');
                return;
            }

            console.log('Creating bookmark modal for time:', currentTime);
            createBookmarkModal(currentTime);
        } catch (error) {
            console.error('Error adding bookmark:', error);
            showNotification('Failed to add bookmark', 'error');
        }
    };

    // Convert seconds to HH:MM:SS format
    const getTime = (t) => {
        try {
            if (!t || isNaN(t)) return '00:00:00';
            
            const hours = Math.floor(t / 3600);
            const minutes = Math.floor((t % 3600) / 60);
            const seconds = Math.floor(t % 60);
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('Error formatting time:', error);
            return '00:00:00';
        }
    };

    // Add CSS for animations
    const addStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    };

    // Check if extension is properly loaded
    const isExtensionValid = () => {
        return chrome.runtime && chrome.runtime.id;
    };

    // Show user-friendly error when context is lost
    const showContextLostError = () => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: #f44336;
            color: white;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            font-size: 14px;
        `;
        notification.innerHTML = `
            <div style="margin-bottom: 8px;">⚠️ Extension Connection Lost</div>
            <div style="font-size: 12px; opacity: 0.9;">
                Please refresh this page to restore functionality.
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
    };

    // Attempt to recover extension context
    const attemptContextRecovery = async () => {
        try {
            console.log('Attempting to recover extension context...');
            
            // Try to communicate with background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "GET_CURRENT_VIDEO" }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response && response.videoId) {
                console.log('Context recovered, reinitializing...');
                currentVideo = response.videoId;
                await newVideoLoaded();
                return true;
            } else {
                console.log('Context recovery failed');
                showContextLostError();
                return false;
            }
        } catch (error) {
            console.error('Error during context recovery:', error);
            showContextLostError();
            return false;
        }
    };

    // Test function to verify extension is working
    const testExtension = () => {
        console.log('=== TESTING EXTENSION ===');
        console.log('Current video ID:', currentVideo);
        console.log('YouTube elements:', {
            youtubeLeftControls: !!youtubeLeftControls,
            youtubePlayer: !!youtubePlayer
        });
        console.log('Current bookmarks:', currentVideoBookmarks);
        console.log('Video data:', currentVideoData);
        console.log('Modal open:', isBookmarkModalOpen);
    };

    // Add test function to window for debugging
    window.testExtension = testExtension;
    
    // Add global test function that can be called from main page
    window.testYTBookmarkExtension = () => {
        console.log('=== YT BOOKMARK EXTENSION TEST ===');
        console.log('Extension loaded:', !!chrome.runtime);
        console.log('Extension ID:', chrome.runtime?.id);
        console.log('Current video ID:', currentVideo);
        console.log('YouTube elements found:', {
            youtubeLeftControls: !!youtubeLeftControls,
            youtubePlayer: !!youtubePlayer
        });
        console.log('Current bookmarks:', currentVideoBookmarks);
        console.log('Video data:', currentVideoData);
        console.log('Modal open:', isBookmarkModalOpen);
        
        // Test if bookmark button exists
        const bookmarkBtn = document.querySelector('.bookmark-btn');
        console.log('Bookmark button exists:', !!bookmarkBtn);
        
        // Test if we can access storage
        if (chrome.runtime && chrome.runtime.id) {
            chrome.storage.sync.get([currentVideo], (data) => {
                console.log('Storage test - current video data:', data);
            });
        }
        
        return {
            extensionLoaded: !!chrome.runtime,
            videoId: currentVideo,
            bookmarkButtonExists: !!bookmarkBtn,
            youtubeElementsFound: {
                controls: !!youtubeLeftControls,
                player: !!youtubePlayer
            },
            bookmarksCount: currentVideoBookmarks.length
        };
    };

    // Add manual test function
    window.testBookmarkCreation = () => {
        console.log('=== TESTING BOOKMARK CREATION ===');
        
        if (!youtubePlayer) {
            console.error('YouTube player not found');
            return false;
        }
        
        const currentTime = youtubePlayer.currentTime;
        console.log('Current video time:', currentTime);
        
        if (currentTime <= 0) {
            console.error('Cannot bookmark at 0 seconds');
            return false;
        }
        
        console.log('Creating test bookmark...');
        createBookmarkModal(currentTime);
        return true;
    };

    // Add context recovery test function
    window.testContextRecovery = () => {
        console.log('=== TESTING CONTEXT RECOVERY ===');
        return attemptContextRecovery();
    };

    // Add force refresh function
    window.forceExtensionRefresh = () => {
        console.log('=== FORCING EXTENSION REFRESH ===');
        if (chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ type: "REFRESH_CONTENT_SCRIPT" }, (response) => {
                console.log('Refresh response:', response);
            });
        } else {
            console.error('Extension context not available');
        }
    };

    // Initialize extension
    const init = () => {
        try {
            // Check if extension is valid before initializing
            if (!isExtensionValid()) {
                console.error('Extension context not available');
                showContextLostError();
                return;
            }
            
            addStyles();
            newVideoLoaded();
            
            // Set up periodic checks for extension validity
            setInterval(() => {
                if (!isExtensionValid()) {
                    console.log('Extension context lost, attempting to reinitialize...');
                    attemptContextRecovery();
                }
            }, 5000); // Check every 5 seconds
            
            // Also check on page visibility change (YouTube navigation)
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && !isExtensionValid()) {
                    console.log('Page became visible, checking extension context...');
                    attemptContextRecovery();
                }
            });
            
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    };

    // Start the extension
    init();
})();
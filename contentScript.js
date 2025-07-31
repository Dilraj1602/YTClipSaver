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
            const { type, value, videoId } = obj;

            switch (type) {
                case "NEW":
                    currentVideo = videoId;
                    newVideoLoaded();
                    break;
                case "PLAY":
                    if (youtubePlayer && !isNaN(value)) {
                        youtubePlayer.currentTime = parseFloat(value);
                    }
                    break;
                case "DELETE":
                    deleteBookmark(value);
                    response(currentVideoBookmarks);
                    break;
                case "GET_VIDEO_DATA":
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
            const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
            currentVideoBookmarks = await fetchBookmarks();
            
            // Get video data
            currentVideoData = getVideoData();

            if (!bookmarkBtnExists) {
                createBookmarkButton();
            }
        } catch (error) {
            console.error('Error loading new video:', error);
        }
    };

    // Create and add bookmark button to YouTube controls
    const createBookmarkButton = () => {
        try {
            const bookmarkBtn = document.createElement("img");
            bookmarkBtn.src = chrome.runtime.getURL("assets/bookmark.png");
            bookmarkBtn.className = "ytp-button bookmark-btn";
            bookmarkBtn.title = "Click to bookmark current timestamp (Ctrl+B)";
            bookmarkBtn.style.cursor = "pointer";

            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
            youtubePlayer = document.getElementsByClassName("video-stream")[0];

            if (youtubeLeftControls && youtubePlayer) {
                youtubeLeftControls.appendChild(bookmarkBtn);
                bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
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
            // Remove existing modal if any
            const existingModal = document.getElementById('bookmark-modal');
            if (existingModal) {
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
            saveBtn.onclick = () => saveBookmark(currentTime, input.value.trim());

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

            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
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
            const newBookmark = {
                time: currentTime,
                desc: description || `Bookmark at ${getTime(currentTime)}`,
                timestamp: Date.now()
            };

            currentVideoBookmarks = await fetchBookmarks();
            currentVideoBookmarks.push(newBookmark);
            currentVideoBookmarks.sort((a, b) => a.time - b.time);

            await new Promise((resolve, reject) => {
                chrome.storage.sync.set({
                    [currentVideo]: JSON.stringify(currentVideoBookmarks)
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            closeBookmarkModal();
            showNotification('Bookmark saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving bookmark:', error);
            showNotification('Failed to save bookmark', 'error');
        }
    };

    // Delete bookmark
    const deleteBookmark = async (timeToDelete) => {
        try {
            currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time != timeToDelete);
            
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('Error deleting bookmark:', error);
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
            if (!youtubePlayer) {
                showNotification('Video player not found', 'error');
                return;
            }

            const currentTime = youtubePlayer.currentTime;
            if (currentTime <= 0) {
                showNotification('Cannot bookmark at 0 seconds', 'error');
                return;
            }

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

    // Initialize extension
    const init = () => {
        try {
            addStyles();
            newVideoLoaded();
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    };

    // Start the extension
    init();
})();
document.addEventListener('DOMContentLoaded', function () {
    const storageInfoElement = document.getElementById('storage-info');
    const fileListElement = document.getElementById('file-list');
    const currentFolderDisplaySidebar = document.getElementById('current-folder-display');
    const currentFolderDisplayMain = document.getElementById('current-folder-display-main');
    const messageElement = document.getElementById('message');
    const backButton = document.getElementById('back-button');
    const previewContainer = document.getElementById('preview-container');
    const previewData = document.getElementById('preview-data');
    const fileInput = document.getElementById('file-upload');
    const dropArea = document.getElementById('file-list-container');
    const dropGuide = dropArea ? dropArea.querySelector('.drop-guide') : null;
    const messageModal = document.getElementById('message-modal');
    const messageModalTitle = document.getElementById('message-modal-title');
    const messageModalText = document.getElementById('message-modal-text');
    const closeMessageModalButton = document.getElementById('close-message-modal-button');
    const messageModalOkButton = document.getElementById('message-modal-ok-button');
    const shareModal = document.getElementById('share-modal');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkButton = document.getElementById('copy-share-link-button');
    const closeShareModalButton = document.getElementById('close-share-modal-button');
    const shareOptionsModal = document.getElementById('share-options-modal');
    const shareOptionsCloseButton = shareOptionsModal ? shareOptionsModal.querySelector('.close-button') : null;
    const shareOptionsFileName = shareOptionsModal ? shareOptionsModal.querySelector('.share-file-name') : null;
    const shareOptionsProtectionRadios = shareOptionsModal ? shareOptionsModal.querySelectorAll('input[name="protection"]') : [];
    const shareOptionsPinContainer = document.getElementById('pin-input-container');
    const shareOptionsPasswordContainer = document.getElementById('password-input-container');
    const shareOptionsPinInput = document.getElementById('share-pin-input');
    const shareOptionsPasswordInput = document.getElementById('share-password-input');
    const shareOptionsErrorMessage = shareOptionsModal ? shareOptionsModal.querySelector('.modal-error-message') : null;
    const createShareLinkButton = document.getElementById('create-share-link-button');
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileFab = document.getElementById('mobile-fab');
    const mobileNavItems = document.querySelectorAll('.nav-item');
    const mobileBreadcrumb = document.getElementById('mobile-breadcrumb');
    const mobilePathDisplay = document.getElementById('mobile-path-display');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    const mobileNewFolderBtn = document.getElementById('mobile-new-folder-btn');
    const appContainer = document.querySelector('.app-container');
    const appMainContent = document.querySelector('.main-content');
    const uploadButton = document.getElementById('upload-button');
    const clearFileButton = document.getElementById('clear-file-button');
    const uploadProgress = document.getElementById('upload-progress');
    const globalProgressContainer = document.getElementById('global-upload-progress-container');
    const globalProgressBar = document.getElementById('global-upload-progress-bar');
    const globalProgressText = document.getElementById('global-upload-progress-text');
    const hiddenOptionsModal = document.getElementById('hidden-options-modal');
    const appTitle = document.querySelector('.sidebar h1');

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentFolder = '';
    let isDragging = false;
    let currentDraggableModal = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let storageSyncTimer = null;
    let storageSyncInFlight = false;
    let storageSyncQueued = false;
    let lastStorageUsedText = '';
    let lastStorageQuotaText = '';
    let lastStorageUsedBytes = 0;
    let lastStorageQuotaBytes = 0;

    const baseURL = (() => {
        const { protocol, host, pathname } = location;
        const pathSegments = pathname.split('/');
        const basePath = pathSegments.length > 1 && pathSegments[1] !== 'index.html' ? `/${pathSegments[1]}` : '';
        return `${protocol}//${host}${basePath}`;
    })();

    const nameRegex = /^[a-zA-Z0-9_.\- ()\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+$/u;

    function isInvalidName(name) {
        return name === '.' || name === '..' || name.includes('..') || (name.startsWith('.') && name.length > 1);
    }

    function isRenamingInProgress() {
        return !!fileListElement.querySelector('.rename-input');
    }

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function formatFileSize(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n <= 0) return '0 Bytes';
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
        const value = n / Math.pow(1024, i);
        return `${parseFloat(value.toFixed(2))} ${units[i]}`;
    }

    function parseBytes(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value !== 'string') return 0;
        const raw = value.trim();
        if (!raw) return 0;
        if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Number(raw));
        const match = raw.toUpperCase().match(/^([\d.]+)\s*([KMGTPE]?)(?:IB|B)?$/);
        if (!match) return Number(raw) || 0;
        const num = parseFloat(match[1]);
        const unit = match[2] || '';
        const map = {
            '': 0,
            K: 1,
            M: 2,
            G: 3,
            T: 4,
            P: 5,
            E: 6
        };
        return num * Math.pow(1024, map[unit] || 0);
    }

    async function readErrorData(response) {
        try {
            return await response.json();
        } catch (_) {
            try {
                const text = await response.text();
                return { message: text || response.statusText || '不明なエラー' };
            } catch (__) {
                return { message: response.statusText || '不明なエラー' };
            }
        }
    }

    async function handleResponse(response) {
        if (!response.ok) {
            const errorData = await readErrorData(response);
            if (errorData.code === 'NOT_VERIFIED' || errorData.code === 'NOT_VERIFIED_OR_DISCORD_NOT_LINKED') {
                window.location.href = `${baseURL}/link-discord.html?status=pending_approval`;
                const err = new Error('Redirecting to pending approval page.');
                err.code = errorData.code;
                throw err;
            }
            if (errorData.code === 'NOT_AUTHENTICATED') {
                window.location.href = `${baseURL}/login.html`;
                const err = new Error('Redirecting to login page.');
                err.code = errorData.code;
                throw err;
            }
            const err = new Error(errorData.message || `不明なエラー (${response.status})`);
            err.code = errorData.code;
            throw err;
        }
        try {
            return await response.json();
        } catch (_) {
            return {};
        }
    }

    function handleError(error, prefix) {
        const message = error && error.message ? error.message : 'サーバーとの通信に失敗しました。';
        console.error(prefix, error);
        if (error && error.code === 'NOT_AUTHORIZED_FOR_OPERATIONS') {
            updateUI.showModalMessage('操作は許可されていません', message);
        } else {
            updateUI.message(`${prefix}: ${message}`, true);
        }
    }

    function updateUserProfileUI(user) {
        if (!user) return;
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            userAvatar.src = `/365Cloud/api/user/avatar?t=${Date.now()}`;
        }
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.textContent = `ようこそ、${user.displayName || user.username}さん`;
        }
        const discordStatusDiv = document.getElementById('discord-status');
        const linkButton = document.getElementById('link-discord-button');
        if (!discordStatusDiv) return;
        discordStatusDiv.innerHTML = '';
        const p = document.createElement('p');
        if (user.discordAuth && user.discordAuth.id) {
            if (!user.isVerifiedByAdmin) {
                p.style.color = '#ffb347';
                p.textContent = 'Discord連携済み - 管理者の承認待ちです。';
                if (linkButton) linkButton.style.display = 'none';
            } else {
                p.style.color = '#28a745';
                p.textContent = `Discord連携済み: ${user.discordAuth.username}`;
                if (linkButton) linkButton.style.display = 'none';
            }
        } else {
            p.style.color = '#dc3545';
            p.textContent = 'Discord未連携です。アカウントの全機能を利用するには連携が必要です。';
            if (linkButton) linkButton.style.display = 'inline-block';
        }
        discordStatusDiv.appendChild(p);
    }

    const updateUI = {
        currentFolderDisplay: () => {
            const folderPath = currentFolder ? `/${currentFolder}` : '/';
            if (currentFolderDisplaySidebar) currentFolderDisplaySidebar.textContent = `現在のフォルダー: ${folderPath}`;
            if (currentFolderDisplayMain) currentFolderDisplayMain.textContent = `/${currentFolder || ''}`;
            if (mobilePathDisplay) mobilePathDisplay.textContent = currentFolder ? currentFolder.split('/').pop() : 'ホーム';
        },
        message: (message, isError = false) => {
            if (!messageElement) return;
            messageElement.textContent = message;
            messageElement.style.color = isError ? 'var(--text-color-message-error)' : 'var(--text-color-message-success)';
        },
        clearMessage: () => {
            if (messageElement) messageElement.textContent = '';
        },
        storageInfo: (used, quota) => {
            const usedText = typeof used === 'string' ? used : formatFileSize(used);
            const quotaText = typeof quota === 'string' ? quota : formatFileSize(quota);
            lastStorageUsedText = usedText;
            lastStorageQuotaText = quotaText;
            lastStorageUsedBytes = parseBytes(usedText);
            lastStorageQuotaBytes = parseBytes(quotaText);
            if (storageInfoElement) storageInfoElement.textContent = `使用容量: ${usedText} / ${quotaText}`;
            if (window.Android && typeof window.Android.onStorageUsageUpdated === 'function') {
                try {
                    window.Android.onStorageUsageUpdated(String(usedText), String(quotaText), String(lastStorageUsedBytes), String(lastStorageQuotaBytes));
                } catch (_) {}
            }
            if (window.Android && typeof window.Android.setStorageUsage === 'function') {
                try {
                    window.Android.setStorageUsage(String(usedText), String(quotaText), String(lastStorageUsedBytes), String(lastStorageQuotaBytes));
                } catch (_) {}
            }
        },
        backButtonVisibility: () => {
            if (backButton) backButton.style.display = currentFolder ? 'inline-block' : 'none';
            if (mobileBreadcrumb && appContainer) {
                if (currentFolder) {
                    mobileBreadcrumb.classList.add('visible');
                    appContainer.classList.add('has-breadcrumb');
                } else {
                    mobileBreadcrumb.classList.remove('visible');
                    appContainer.classList.remove('has-breadcrumb');
                }
            }
        },
        showDropGuide: (show) => {
            if (!dropGuide || !fileListElement || !dropArea) return;
            if (show) {
                dropGuide.style.display = 'flex';
                fileListElement.style.display = 'none';
                dropArea.style.justifyContent = 'center';
                dropArea.style.alignItems = 'center';
            } else {
                dropGuide.style.display = 'none';
                fileListElement.style.display = 'block';
                dropArea.style.justifyContent = 'flex-start';
                dropArea.style.alignItems = 'flex-start';
            }
        },
        toggleSidebar: (open) => {
            if (!sidebar) return;
            if (window.matchMedia('(max-width: 768px)').matches) {
                const isOpen = open !== undefined ? open : !sidebar.classList.contains('open');
                sidebar.classList.toggle('open', isOpen);
                document.body.classList.toggle('sidebar-open', isOpen);
            }
        },
        setPreviewOpen: (isOpen) => {
            document.body.classList.toggle('preview-open', isOpen);
            if (appMainContent) appMainContent.style.overflowY = isOpen ? 'hidden' : 'auto';
        },
        showModalMessage: (title, message) => {
            if (!messageModal || !messageModalTitle || !messageModalText) return;
            messageModalTitle.textContent = title;
            messageModalText.textContent = message;
            messageModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            const messageModalContent = messageModal.querySelector('.modal-content');
            if (messageModalContent) {
                const modalContentRect = messageModalContent.getBoundingClientRect();
                messageModalContent.style.left = `${(window.innerWidth - modalContentRect.width) / 2}px`;
                messageModalContent.style.top = `${(window.innerHeight - modalContentRect.height) / 2}px`;
            }
        },
        hideModalMessage: () => {
            if (messageModal) messageModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    };

    function scheduleStorageSync(delay = 200) {
        if (storageSyncTimer) clearTimeout(storageSyncTimer);
        storageSyncTimer = setTimeout(() => {
            syncStorageInfo({ force: false, silent: true });
        }, delay);
    }

    async function syncStorageInfo(options = {}) {
        const force = !!options.force;
        const silent = !!options.silent;
        if (storageSyncInFlight && !force) {
            storageSyncQueued = true;
            return;
        }
        storageSyncInFlight = true;
        try {
            const response = await fetch(`${baseURL}/storage`, { credentials: 'include' });
            const data = await handleResponse(response);
            const used = data.storageUsed ?? data.used ?? data.usedStorage ?? data.currentUsed ?? 0;
            const quota = data.storageQuota ?? data.quota ?? data.maxStorage ?? data.limit ?? 0;
            updateUI.storageInfo(used, quota);
        } catch (error) {
            if (!silent) handleError(error, 'ストレージ情報の取得に失敗しました');
        } finally {
            storageSyncInFlight = false;
            if (storageSyncQueued) {
                storageSyncQueued = false;
                scheduleStorageSync(50);
            }
        }
    }

    function attachAndroidStorageBridge() {
        window.onStorageUsageChanged = function (used, quota) {
            updateUI.storageInfo(used, quota);
        };
        window.onStorageInfoChanged = function (used, quota) {
            updateUI.storageInfo(used, quota);
        };
        window.onStorageChanged = function (used, quota) {
            updateUI.storageInfo(used, quota);
        };
        window.dispatchStorageUsageChanged = function (used, quota) {
            updateUI.storageInfo(used, quota);
        };
        if (window.Android && typeof window.Android.requestStorageSync === 'function') {
            try {
                window.Android.requestStorageSync();
            } catch (_) {}
        }
    }

    function initDragAndDrop() {
        const items = fileListElement.querySelectorAll('li[data-file-name]');
        const folders = fileListElement.querySelectorAll('li[data-is-directory="true"]');
        items.forEach(item => {
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', item.dataset.fileName || '');
                e.dataTransfer.effectAllowed = 'move';
            });
        });
        folders.forEach(folder => {
            folder.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggedName = e.dataTransfer.getData('text/plain');
                if (folder.dataset.fileName !== draggedName) {
                    folder.classList.add('drag-over-folder');
                }
            });
            folder.addEventListener('dragleave', () => {
                folder.classList.remove('drag-over-folder');
            });
            folder.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                folder.classList.remove('drag-over-folder');
                const sourceName = e.dataTransfer.getData('text/plain');
                const destinationPath = folder.dataset.path;
                if (sourceName === folder.dataset.fileName) return;
                fileOperations.moveItem(sourceName, destinationPath);
            });
        });
    }

    const fileOperations = {
        loadFiles: async (folder) => {
            try {
                const response = await fetch(`${baseURL}/files?folder=${encodeURIComponent(folder || '')}`, { credentials: 'include' });
                const data = await handleResponse(response);
                fileListElement.innerHTML = '';
                updateUI.storageInfo(data.storageUsed, data.storageQuota);
                if (currentFolder) {
                    const backItem = document.createElement('li');
                    backItem.className = 'folder';
                    backItem.dataset.isDirectory = 'true';
                    backItem.dataset.path = currentFolder.includes('/') ? currentFolder.substring(0, currentFolder.lastIndexOf('/')) : '';
                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'item-name';
                    nameSpan.style.cursor = 'pointer';
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'item-icon folder';
                    if (isMobile) {
                        iconSpan.innerHTML = '<i class="fas fa-level-up-alt"></i>';
                    } else {
                        iconSpan.innerHTML = '';
                    }
                    nameSpan.appendChild(iconSpan);
                    nameSpan.appendChild(document.createTextNode(' ..'));
                    backItem.appendChild(nameSpan);
                    nameSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isRenamingInProgress()) return;
                        currentFolder = currentFolder.includes('/') ? currentFolder.substring(0, currentFolder.lastIndexOf('/')) : '';
                        fileOperations.loadFiles(currentFolder);
                    });
                    fileListElement.appendChild(backItem);
                }
                const files = Array.isArray(data.files) ? data.files : [];
                files.forEach(file => {
                    const listItem = document.createElement('li');
                    listItem.draggable = true;
                    listItem.dataset.fileName = file.name;
                    listItem.dataset.originalName = file.originalName;
                    listItem.dataset.path = currentFolder ? `${currentFolder}/${file.name}` : file.name;
                    if (file.isDirectory) listItem.dataset.isDirectory = 'true';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'item-name';
                    nameSpan.style.cursor = 'pointer';

                    const iconSpan = document.createElement('span');
                    iconSpan.className = `item-icon ${file.isDirectory ? 'folder' : 'file'}`;
                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                    if (isMobile) {
                        let iconHTML = '<i class="fas fa-file"></i>';
                        if (file.isDirectory) {
                            iconHTML = '<i class="fas fa-folder"></i>';
                        } else if (file.type) {
                            if (file.type.startsWith('image/')) iconHTML = '<i class="fas fa-file-image"></i>';
                            else if (file.type.startsWith('video/')) iconHTML = '<i class="fas fa-file-video"></i>';
                            else if (file.type.startsWith('audio/')) iconHTML = '<i class="fas fa-file-audio"></i>';
                            else if (file.type === 'application/pdf') iconHTML = '<i class="fas fa-file-pdf"></i>';
                            else if (file.type === 'text/plain') iconHTML = '<i class="fas fa-file-alt"></i>';
                        }
                        iconSpan.innerHTML = iconHTML;
                    } else {
                        iconSpan.innerHTML = '';
                        if (file.type) iconSpan.dataset.type = file.type;
                    }

                    nameSpan.appendChild(iconSpan);

                    const nameText = document.createElement('span');
                    nameText.textContent = ` ${file.originalName}`;
                    nameSpan.appendChild(nameText);

                    if (!file.isDirectory) {
                        const sizeSpan = document.createElement('span');
                        sizeSpan.className = 'item-size';
                        sizeSpan.textContent = formatFileSize(file.size);
                        nameSpan.appendChild(sizeSpan);
                    }

                    listItem.appendChild(nameSpan);

                    nameSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isRenamingInProgress()) return;
                        if (file.isDirectory) {
                            currentFolder = currentFolder ? `${currentFolder}/${file.name}` : file.name;
                            fileOperations.loadFiles(currentFolder);
                        } else {
                            const filePath = currentFolder ? `${currentFolder}/${file.name}` : file.name;
                            const downloadUrl = `${baseURL}/download?file=${encodeURIComponent(filePath)}`;
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = file.originalName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    });

                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'item-actions';

                    const createActionBtn = (iconClass, title, onClick) => {
                        const btn = document.createElement('button');
                        if (isMobile) {
                            btn.innerHTML = `<i class="${iconClass}"></i>`;
                        } else {
                            btn.textContent = title;
                        }
                        btn.title = title;
                        btn.addEventListener('click', onClick);
                        return btn;
                    };

                    if (!file.isDirectory) {
                        buttonContainer.appendChild(createActionBtn('fas fa-eye', 'プレビュー', (e) => {
                            e.stopPropagation();
                            fileOperations.showPreview(file);
                        }));
                    }

                    buttonContainer.appendChild(createActionBtn('fas fa-edit', '名前変更', (e) => {
                        e.stopPropagation();
                        fileOperations.startRename(listItem);
                    }));

                    if (!file.isDirectory) {
                        buttonContainer.appendChild(createActionBtn('fas fa-share-alt', '共有', (e) => {
                            e.stopPropagation();
                            fileOperations.shareFile(file);
                        }));
                    }

                    buttonContainer.appendChild(createActionBtn('fas fa-trash-alt', '削除', (e) => {
                        e.stopPropagation();
                        fileOperations.deleteFile(file.name, file.originalName);
                    }));

                    listItem.appendChild(buttonContainer);
                    fileListElement.appendChild(listItem);
                });

                updateUI.showDropGuide(fileListElement.children.length === 0);
                updateUI.backButtonVisibility();
                updateUI.currentFolderDisplay();
                updateUI.clearMessage();
                initDragAndDrop();
                scheduleStorageSync(50);
            } catch (err) {
                handleError(err, 'ファイル一覧の取得に失敗しました');
                fileListElement.innerHTML = '';
                updateUI.showDropGuide(true);
                throw err;
            }
        },
        createFolder: async () => {
            if (isRenamingInProgress()) return;
            const folderNameInput = document.getElementById('folder-name');
            if (!folderNameInput) return;
            let folderName = folderNameInput.value.trim().replace(/^\/|\/$/g, '');
            if (!folderName || isInvalidName(folderName) || !nameRegex.test(folderName)) {
                alert('フォルダー名が不正です。');
                return;
            }
            try {
                const response = await fetch(`${baseURL}/create-folder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderName }),
                    credentials: 'include'
                });
                const data = await handleResponse(response);
                updateUI.message(data.message, false);
                folderNameInput.value = '';
                await fileOperations.loadFiles(currentFolder);
                scheduleStorageSync(100);
            } catch (err) {
                handleError(err, 'フォルダー作成に失敗しました');
            }
        },
        deleteFile: async (fileName, originalName) => {
            if (isRenamingInProgress()) return;
            if (!confirm(`「${originalName}」を削除しますか？`)) return;
            try {
                const response = await fetch(`${baseURL}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: fileName }),
                    credentials: 'include'
                });
                const data = await handleResponse(response);
                updateUI.message(data.message, false);
                await fileOperations.loadFiles(currentFolder);
                scheduleStorageSync(100);
            } catch (err) {
                handleError(err, '削除に失敗しました');
            }
        },
        moveItem: async (sourceName, destinationFolder) => {
            if (isRenamingInProgress()) return;
            try {
                const response = await fetch(`${baseURL}/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: sourceName,
                        destinationFolder: destinationFolder
                    }),
                    credentials: 'include'
                });
                const data = await handleResponse(response);
                updateUI.message(data.message, false);
                await fileOperations.loadFiles(currentFolder);
                scheduleStorageSync(100);
            } catch (err) {
                handleError(err, '移動に失敗しました');
            }
        },
        shareFile: (file) => {
            if (isRenamingInProgress()) return;
            if (!shareOptionsModal || !shareOptionsFileName || !shareOptionsErrorMessage || !shareOptionsPinInput || !shareOptionsPasswordInput || !createShareLinkButton) return;
            shareOptionsFileName.textContent = `ファイル: ${file.originalName}`;
            shareOptionsErrorMessage.textContent = '';
            shareOptionsPinInput.value = '';
            shareOptionsPasswordInput.value = '';
            if (shareOptionsPinContainer) shareOptionsPinContainer.style.display = 'none';
            if (shareOptionsPasswordContainer) shareOptionsPasswordContainer.style.display = 'none';
            const noneRadio = shareOptionsModal.querySelector('input[value="none"]');
            if (noneRadio) noneRadio.checked = true;
            createShareLinkButton.disabled = false;
            createShareLinkButton.textContent = '共有リンクを作成';
            shareOptionsModal.style.display = 'flex';
            document.body.classList.add('modal-open');

            const filePath = currentFolder ? `${currentFolder}/${file.name}` : file.name;

            const createLinkHandler = async () => {
                shareOptionsErrorMessage.textContent = '';
                createShareLinkButton.disabled = true;
                createShareLinkButton.textContent = '作成中...';
                const checkedRadio = shareOptionsModal.querySelector('input[name="protection"]:checked');
                const protectionType = checkedRadio ? checkedRadio.value : 'none';
                const protection = { type: protectionType };

                if (protectionType === 'pin') {
                    const pin = shareOptionsPinInput.value;
                    if (!/^\d{4,6}$/.test(pin)) {
                        shareOptionsErrorMessage.textContent = '無効なPINです (4〜6桁の数字)。';
                        createShareLinkButton.disabled = false;
                        createShareLinkButton.textContent = '共有リンクを作成';
                        return;
                    }
                    protection.value = pin;
                } else if (protectionType === 'password') {
                    const password = shareOptionsPasswordInput.value;
                    if (!password || password.length < 8) {
                        shareOptionsErrorMessage.textContent = '無効なパスワードです (8文字以上)。';
                        createShareLinkButton.disabled = false;
                        createShareLinkButton.textContent = '共有リンクを作成';
                        return;
                    }
                    protection.value = password;
                }

                try {
                    const response = await fetch(`${baseURL}/share`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file: filePath, protection }),
                        credentials: 'include'
                    });
                    const data = await handleResponse(response);
                    shareOptionsModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    shareLinkInput.value = data.shareLink || '';
                    shareModal.style.display = 'flex';
                } catch (error) {
                    shareOptionsErrorMessage.textContent = `エラー: ${error.message}`;
                } finally {
                    createShareLinkButton.disabled = false;
                    createShareLinkButton.textContent = '共有リンクを作成';
                }
            };

            const cloned = createShareLinkButton.cloneNode(true);
            createShareLinkButton.parentNode.replaceChild(cloned, createShareLinkButton);
            cloned.addEventListener('click', createLinkHandler);
        },
        showPreview: (file) => {
            if (isRenamingInProgress()) return;
            if (!previewContainer || !previewData) return;
            previewContainer.style.display = 'flex';
            previewData.innerHTML = '';
            updateUI.setPreviewOpen(true);
            const filePath = currentFolder ? `${currentFolder}/${file.name}` : file.name;
            const fileUrl = `${baseURL}/download?file=${encodeURIComponent(filePath)}`;
            const type = file.type || '';
            let element;
            if (type.startsWith('image/')) {
                element = document.createElement('img');
                element.src = fileUrl;
                element.alt = file.originalName || file.name;
                previewData.appendChild(element);
                return;
            }
            if (type.startsWith('video/')) {
                element = document.createElement('video');
                element.controls = true;
                element.src = fileUrl;
                previewData.appendChild(element);
                return;
            }
            if (type.startsWith('audio/')) {
                element = document.createElement('audio');
                element.controls = true;
                element.src = fileUrl;
                previewData.appendChild(element);
                return;
            }
            if (type === 'text/plain' || type.startsWith('text/')) {
                fetch(fileUrl, { credentials: 'include' })
                    .then(r => r.text())
                    .then(text => {
                        const pre = document.createElement('pre');
                        pre.textContent = text;
                        previewData.appendChild(pre);
                    })
                    .catch(err => {
                        previewData.textContent = `プレビュー失敗: ${err.message}`;
                    });
                return;
            }
            previewData.innerHTML = `<div>プレビュー非対応<br>(${type || '不明'})</div>`;
        },
        startRename: (listItem) => {
            if (isRenamingInProgress()) return;
            const nameSpan = listItem.querySelector('.item-name');
            const buttonContainer = listItem.querySelector('.item-actions');
            if (!nameSpan || !buttonContainer) return;
            const originalName = listItem.dataset.originalName || '';
            const originalButtonElements = Array.from(buttonContainer.children);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'rename-input';
            input.value = originalName;
            input.addEventListener('click', e => e.stopPropagation());
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    fileOperations.confirmRename(listItem, listItem.dataset.fileName, input.value, originalButtonElements);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    fileOperations.cancelRename(listItem, nameSpan, originalButtonElements);
                }
            });
            nameSpan.replaceWith(input);
            input.focus();
            input.select();
            buttonContainer.innerHTML = '';
            const okButton = createButton('OK', (e) => {
                e.stopPropagation();
                fileOperations.confirmRename(listItem, listItem.dataset.fileName, input.value, originalButtonElements);
            });
            const cancelButton = createButton('キャンセル', (e) => {
                e.stopPropagation();
                fileOperations.cancelRename(listItem, nameSpan, originalButtonElements);
            });
            buttonContainer.appendChild(okButton);
            buttonContainer.appendChild(cancelButton);
        },
        confirmRename: async (listItem, oldFileName, newName, originalButtonElements) => {
            const trimmedNewName = newName.trim();
            if (!trimmedNewName || isInvalidName(trimmedNewName) || !nameRegex.test(trimmedNewName)) {
                alert('新しい名前が不正です。');
                const input = listItem.querySelector('.rename-input');
                if (input) input.focus();
                return;
            }
            if (trimmedNewName === listItem.dataset.originalName) {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'item-name';
                nameSpan.style.cursor = 'pointer';
                nameSpan.innerHTML = `<span class="item-icon ${listItem.dataset.isDirectory ? 'folder' : 'file'}"></span> ${listItem.dataset.originalName}`;
                if (!listItem.dataset.isDirectory) {
                    nameSpan.innerHTML += `<span class="item-size">${listItem.querySelector('.item-size') ? listItem.querySelector('.item-size').textContent : ''}</span>`;
                }
                fileOperations.cancelRename(listItem, nameSpan, originalButtonElements);
                return;
            }
            try {
                const response = await fetch(`${baseURL}/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldName: oldFileName, newName: trimmedNewName }),
                    credentials: 'include'
                });
                const data = await handleResponse(response);
                updateUI.message(data.message, false);
                await fileOperations.loadFiles(currentFolder);
                scheduleStorageSync(100);
            } catch (err) {
                handleError(err, '名前の変更に失敗しました');
                await fileOperations.loadFiles(currentFolder);
            }
        },
        cancelRename: (listItem, originalNameSpan, originalButtonElements) => {
            const input = listItem.querySelector('.rename-input');
            if (input) input.replaceWith(originalNameSpan);
            const buttonContainer = listItem.querySelector('.item-actions');
            if (!buttonContainer) return;
            buttonContainer.innerHTML = '';
            originalButtonElements.forEach(btn => buttonContainer.appendChild(btn));
        },
        logout: async () => {
            if (isRenamingInProgress()) return;
            try {
                const response = await fetch(`${baseURL}/logout`, { method: 'POST', credentials: 'include' });
                const data = await handleResponse(response);
                alert(data.message || 'ログアウトしました。');
                window.location.href = `${baseURL}/login.html`;
            } catch (err) {
                handleError(err, 'ログアウトに失敗しました');
            }
        }
    };

    const storageOperations = {
        CHUNK_SIZE: 5 * 1024 * 1024,
        CHUNK_UPLOAD_THRESHOLD: 10 * 1024 * 1024,
        checkStorageBeforeUpload: async (files) => {
            const response = await fetch(`${baseURL}/storage`, { credentials: 'include' });
            const data = await handleResponse(response);
            const usedBytes = parseBytes(data.storageUsed ?? data.used ?? 0);
            const quotaBytes = parseBytes(data.storageQuota ?? data.quota ?? 0);
            const totalUploadSizeBytes = Array.from(files).reduce((acc, file) => acc + file.size, 0);
            if (quotaBytes > 0 && usedBytes + totalUploadSizeBytes > quotaBytes) {
                throw new Error(`ディスク容量が上限を超えます。\n\n現在の使用量: ${data.storageUsed}\n上限: ${data.storageQuota}\nアップロードサイズ合計: ${formatFileSize(totalUploadSizeBytes)}`);
            }
        },
        _uploadSingleFile: (file, progressCallback, onCompleteCallback) => {
            const formData = new FormData();
            formData.append('files', file);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${baseURL}/upload-files`, true);
            xhr.withCredentials = true;
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    progressCallback(file.name, percent, event.loaded, event.total);
                }
            };
            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status === 200) {
                        onCompleteCallback(file.name, true, data.message || 'アップロードが完了しました。');
                    } else {
                        onCompleteCallback(file.name, false, data.message || 'アップロードに失敗しました。');
                    }
                } catch (e) {
                    onCompleteCallback(file.name, false, e.message || 'アップロード処理に失敗しました');
                }
            };
            xhr.onerror = () => {
                onCompleteCallback(file.name, false, 'ネットワークエラー');
            };
            xhr.send(formData);
        },
        _uploadFileInChunks: async (file, progressCallback, onCompleteCallback) => {
            const fileId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            const totalChunks = Math.ceil(file.size / storageOperations.CHUNK_SIZE);
            let uploadedChunks = 0;
            let currentChunkIndex = 0;
            try {
                while (currentChunkIndex < totalChunks) {
                    const start = currentChunkIndex * storageOperations.CHUNK_SIZE;
                    const end = Math.min(start + storageOperations.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);
                    const formData = new FormData();
                    formData.append('chunk', chunk, file.name);
                    formData.append('totalChunks', String(totalChunks));
                    formData.append('fileName', file.name);
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${baseURL}/api/upload-chunk?fileId=${encodeURIComponent(fileId)}&chunkIndex=${currentChunkIndex}`, true);
                    xhr.withCredentials = true;
                    await new Promise((resolve, reject) => {
                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                uploadedChunks++;
                                const percent = (uploadedChunks / totalChunks) * 100;
                                progressCallback(file.name, percent, Math.min(file.size, uploadedChunks * storageOperations.CHUNK_SIZE), file.size);
                                resolve();
                            } else {
                                reject(new Error(`チャンク ${currentChunkIndex} のアップロードに失敗しました。ステータス: ${xhr.status}`));
                            }
                        };
                        xhr.onerror = () => reject(new Error(`チャンク ${currentChunkIndex} のネットワークエラー`));
                        xhr.send(formData);
                    });
                    currentChunkIndex++;
                }
                const mergeResponse = await fetch(`${baseURL}/api/merge-chunks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId, fileName: file.name, totalChunks, currentFolder }),
                    credentials: 'include'
                });
                const mergeData = await handleResponse(mergeResponse);
                onCompleteCallback(file.name, true, mergeData.message || 'ファイルが正常にアップロードされました。');
            } catch (error) {
                onCompleteCallback(file.name, false, `チャンクアップロード中にエラーが発生しました: ${error.message}`);
            }
        },
        uploadFiles: async (files) => {
            if (isRenamingInProgress() || !files || files.length === 0) return;
            uploadButton.disabled = true;
            clearFileButton.disabled = true;
            fileInput.disabled = true;
            if (dropArea) dropArea.style.pointerEvents = 'none';
            updateUI.message('アップロードを開始します...', false);
            if (globalProgressContainer) globalProgressContainer.style.display = 'flex';

            try {
                await storageOperations.checkStorageBeforeUpload(files);
                let completedFiles = 0;
                const fileProgress = new Map();
                Array.from(files).forEach(file => fileProgress.set(file.name, { uploaded: 0, total: file.size }));
                const totalBytesToUpload = Array.from(files).reduce((sum, file) => sum + file.size, 0);

                const updateGlobalProgress = () => {
                    let currentTotalUploadedBytes = 0;
                    fileProgress.forEach(progress => {
                        currentTotalUploadedBytes += progress.uploaded;
                    });
                    const globalPercent = totalBytesToUpload > 0 ? (currentTotalUploadedBytes / totalBytesToUpload) * 100 : 0;
                    if (globalProgressBar) globalProgressBar.style.width = `${globalPercent}%`;
                    if (globalProgressText) {
                        globalProgressText.textContent = `${Math.round(globalPercent)}%`;
                        const textWidth = globalProgressText.offsetWidth;
                        if (globalProgressBar && globalProgressBar.offsetWidth < textWidth + 15) {
                            globalProgressText.style.left = `calc(100% + 5px)`;
                            globalProgressText.style.transform = 'translateY(-50%)';
                            globalProgressText.style.color = 'var(--text-color-primary)';
                            globalProgressText.style.textShadow = 'none';
                        } else {
                            globalProgressText.style.left = '50%';
                            globalProgressText.style.transform = 'translate(-50%, -50%)';
                            globalProgressText.style.color = 'white';
                            globalProgressText.style.textShadow = '0 0 2px rgba(0,0,0,0.7)';
                        }
                    }
                };

                const fileProgressCallback = (fileName, percent, loaded, total) => {
                    const fileInfo = fileProgress.get(fileName);
                    if (fileInfo) {
                        fileInfo.uploaded = loaded != null ? loaded : fileInfo.total * (percent / 100);
                        fileInfo.total = total != null ? total : fileInfo.total;
                        fileProgress.set(fileName, fileInfo);
                    }
                    updateGlobalProgress();
                    if (window.Android && typeof window.Android.uploadProgress === 'function') {
                        const currentLoaded = Math.round(fileInfo ? fileInfo.uploaded : 0);
                        const currentTotal = Math.round(fileInfo ? fileInfo.total : 0);
                        try {
                            window.Android.uploadProgress(fileName, Math.round(percent), currentLoaded, currentTotal);
                        } catch (_) {}
                    }
                };

                const fileOnCompleteCallback = (fileName, success, message) => {
                    completedFiles++;
                    if (!success) {
                        handleError(new Error(message), `ファイルのアップロードに失敗しました: ${fileName}`);
                    } else {
                        updateUI.message(`${fileName}: ${message}`, false);
                        const fileInfo = fileProgress.get(fileName);
                        if (fileInfo) {
                            fileInfo.uploaded = fileInfo.total;
                            fileProgress.set(fileName, fileInfo);
                        }
                    }
                    updateGlobalProgress();
                    if (window.Android && typeof window.Android.uploadComplete === 'function') {
                        try {
                            window.Android.uploadComplete(fileName, success, message);
                        } catch (_) {}
                    }
                    scheduleStorageSync(120);
                    if (completedFiles === files.length) {
                        updateUI.message('すべてのファイルのアップロードが完了しました。', false);
                        if (globalProgressContainer) globalProgressContainer.style.display = 'none';
                        uploadButton.disabled = false;
                        clearFileButton.disabled = false;
                        fileInput.disabled = false;
                        if (dropArea) dropArea.style.pointerEvents = 'auto';
                        fileInput.value = '';
                        fileOperations.loadFiles(currentFolder);
                        scheduleStorageSync(200);
                    }
                };

                const uploadPromises = Array.from(files).map(async (file) => {
                    if (file.size > storageOperations.CHUNK_UPLOAD_THRESHOLD) {
                        await storageOperations._uploadFileInChunks(file, fileProgressCallback, fileOnCompleteCallback);
                    } else {
                        await new Promise(resolve => {
                            storageOperations._uploadSingleFile(file, fileProgressCallback, (fileName, success, message) => {
                                fileOnCompleteCallback(fileName, success, message);
                                resolve();
                            });
                        });
                    }
                });

                await Promise.all(uploadPromises);
            } catch (err) {
                handleError(err, 'アップロード処理全体の失敗');
                if (globalProgressContainer) globalProgressContainer.style.display = 'none';
                uploadButton.disabled = false;
                clearFileButton.disabled = false;
                fileInput.disabled = false;
                if (dropArea) dropArea.style.pointerEvents = 'auto';
                fileInput.value = '';
            }
        }
    };

    function setupModalDragging() {
        const messageModalContent = messageModal ? messageModal.querySelector('.modal-content') : null;
        if (!messageModalContent) return;
        messageModalContent.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            currentDraggableModal = messageModalContent;
            dragOffsetX = e.clientX - currentDraggableModal.getBoundingClientRect().left;
            dragOffsetY = e.clientY - currentDraggableModal.getBoundingClientRect().top;
            currentDraggableModal.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !currentDraggableModal) return;
            const newX = e.clientX - dragOffsetX;
            const newY = e.clientY - dragOffsetY;
            currentDraggableModal.style.left = `${newX}px`;
            currentDraggableModal.style.top = `${newY}px`;
        });
        document.addEventListener('mouseup', () => {
            if (isDragging && currentDraggableModal) {
                isDragging = false;
                currentDraggableModal.style.cursor = 'grab';
                document.body.style.userSelect = '';
                currentDraggableModal = null;
            }
        });
    }

    function attachGlobalEvents() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (isRenamingInProgress()) return;
                if (currentFolder === '' || currentFolder.lastIndexOf('/') < 0) currentFolder = '';
                else currentFolder = currentFolder.substring(0, currentFolder.lastIndexOf('/'));
                fileOperations.loadFiles(currentFolder);
            });
        }

        if (uploadButton) {
            uploadButton.addEventListener('click', () => storageOperations.uploadFiles(fileInput.files));
        }

        if (clearFileButton) {
            clearFileButton.addEventListener('click', () => {
                fileInput.value = '';
                if (uploadProgress) uploadProgress.textContent = '';
                updateUI.clearMessage();
            });
        }

        const createFolderButton = document.getElementById('create-folder-button');
        if (createFolderButton) createFolderButton.addEventListener('click', fileOperations.createFolder);

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) logoutButton.addEventListener('click', fileOperations.logout);

        const previewCloseButton = document.getElementById('preview-close-button');
        if (previewCloseButton) {
            previewCloseButton.addEventListener('click', () => {
                if (previewContainer) previewContainer.style.display = 'none';
                if (previewData) previewData.innerHTML = '';
                updateUI.setPreviewOpen(false);
            });
        }

        if (closeShareModalButton) {
            closeShareModalButton.addEventListener('click', () => {
                shareModal.style.display = 'none';
                document.body.classList.remove('modal-open');
            });
        }

        if (copyShareLinkButton) {
            copyShareLinkButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(shareLinkInput.value);
                    copyShareLinkButton.textContent = 'コピーしました！';
                    setTimeout(() => {
                        copyShareLinkButton.textContent = 'コピー';
                    }, 1500);
                } catch (_) {
                    try {
                        shareLinkInput.select();
                        document.execCommand('copy');
                        copyShareLinkButton.textContent = 'コピーしました！';
                        setTimeout(() => {
                            copyShareLinkButton.textContent = 'コピー';
                        }, 1500);
                    } catch (err) {
                        alert('クリップボードへのコピーに失敗しました。');
                    }
                }
            });
        }

        if (dropArea) {
            dropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!isRenamingInProgress()) dropArea.classList.add('drag-over');
            });
            dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
            dropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                dropArea.classList.remove('drag-over');
                if (!isRenamingInProgress()) storageOperations.uploadFiles(e.dataTransfer.files);
            });
        }

        if (resizer && sidebar) {
            resizer.addEventListener('mousedown', (e) => {
                if (window.matchMedia('(max-width: 768px)').matches) return;
                isResizing = true;
                startX = e.clientX;
                startWidth = sidebar.offsetWidth;
                document.body.style.cursor = 'ew-resize';
            });
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = startWidth + (e.clientX - startX);
                if (newWidth > 150 && newWidth < window.innerWidth * 0.5) {
                    sidebar.style.flexBasis = `${newWidth}px`;
                }
            });
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.style.cursor = 'default';
            });
        }

        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            });
        }

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                updateUI.toggleSidebar();
            });
        }

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                updateUI.toggleSidebar();
            });
        }

        if (mobileFab) {
            mobileFab.addEventListener('click', () => {
                fileInput.click();
            });
        }

        mobileNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                mobileNavItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (target === 'upload-trigger') {
                    fileInput.click();
                } else if (target === 'settings') {
                    window.location.href = '/365Cloud/settings.html';
                } else if (target === 'files') {
                    if (currentFolder !== '') {
                        currentFolder = '';
                        fileOperations.loadFiles('');
                    }
                }
            });
        });

        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                currentFolder = currentFolder.includes('/') ? currentFolder.substring(0, currentFolder.lastIndexOf('/')) : '';
                fileOperations.loadFiles(currentFolder);
            });
        }

        if (mobileNewFolderBtn) {
            mobileNewFolderBtn.addEventListener('click', () => {
                const name = prompt('新しいフォルダー名を入力:');
                if (!name || !name.trim()) return;
                const folderNameInput = document.getElementById('folder-name');
                if (!folderNameInput) return;
                folderNameInput.value = name.trim();
                fileOperations.createFolder();
            });
        }

        document.body.addEventListener('click', (e) => {
            if (window.matchMedia('(max-width: 768px)').matches && sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
                updateUI.toggleSidebar(false);
            }
        });

        shareOptionsProtectionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (shareOptionsPinContainer) shareOptionsPinContainer.style.display = (radio.value === 'pin' && radio.checked) ? 'block' : 'none';
                if (shareOptionsPasswordContainer) shareOptionsPasswordContainer.style.display = (radio.value === 'password' && radio.checked) ? 'block' : 'none';
            });
        });

        if (shareOptionsCloseButton) {
            shareOptionsCloseButton.addEventListener('click', () => {
                shareOptionsModal.style.display = 'none';
                document.body.classList.remove('modal-open');
            });
        }

        if (shareOptionsModal) {
            shareOptionsModal.addEventListener('click', (e) => {
                if (e.target === shareOptionsModal) {
                    shareOptionsModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                }
            });
        }

        if (closeMessageModalButton) closeMessageModalButton.addEventListener('click', updateUI.hideModalMessage);
        if (messageModalOkButton) messageModalOkButton.addEventListener('click', updateUI.hideModalMessage);
        if (messageModal) {
            messageModal.addEventListener('click', (e) => {
                if (e.target === messageModal) updateUI.hideModalMessage();
            });
        }

        window.addEventListener('focus', () => {
            scheduleStorageSync(20);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                scheduleStorageSync(20);
            }
        });

        window.addEventListener('storage-info-refresh-request', () => {
            scheduleStorageSync(0);
        });
    }

    function startAutoStorageSync() {
        if (window.__storageSyncIntervalId) {
            clearInterval(window.__storageSyncIntervalId);
        }
        window.__storageSyncIntervalId = setInterval(() => {
            if (!document.hidden) {
                syncStorageInfo({ silent: true });
            }
        }, 2000);
    }

    async function initializePage() {
        try {
            attachAndroidStorageBridge();
            attachGlobalEvents();
            setupModalDragging();
            startAutoStorageSync();
            const response = await fetch(`${baseURL}/check-login-status`, { credentials: 'include' });
            const data = await handleResponse(response);
            if (!data.loggedIn || !data.user) {
                throw new Error('未ログイン');
            }
            if (data.needsDiscordLink) {
                window.location.href = `${baseURL}/link-discord.html`;
                return;
            }
            updateUserProfileUI(data.user);
            updateUI.message('ログイン成功。ファイル一覧を取得中...');
            await fileOperations.loadFiles('');
            await syncStorageInfo({ force: true, silent: true });
        } catch (error) {
            console.error('Login session invalid or check failed. Redirecting to login page:', error);
            window.location.href = `${baseURL}/login.html`;
        }
    }

    initializePage();
});

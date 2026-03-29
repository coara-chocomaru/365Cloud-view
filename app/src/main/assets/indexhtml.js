document.addEventListener('DOMContentLoaded', function() {
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
    const dropGuide = dropArea.querySelector('.drop-guide');
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
    const shareOptionsCloseButton = shareOptionsModal.querySelector('.close-button');
    const shareOptionsFileName = shareOptionsModal.querySelector('.share-file-name');
    const shareOptionsProtectionRadios = shareOptionsModal.querySelectorAll('input[name="protection"]');
    const shareOptionsPinContainer = document.getElementById('pin-input-container');
    const shareOptionsPasswordContainer = document.getElementById('password-input-container');
    const shareOptionsPinInput = document.getElementById('share-pin-input');
    const shareOptionsPasswordInput = document.getElementById('share-password-input');
    const shareOptionsErrorMessage = shareOptionsModal.querySelector('.modal-error-message');
    const createShareLinkButton = document.getElementById('create-share-link-button');
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');
    let isResizing = false;
    let startX;
    let startWidth;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileFab = document.getElementById('mobile-fab');
    const mobileNavItems = document.querySelectorAll('.nav-item');
    let currentFolder = '';
    let isDragging = false;
    let currentDraggableModal = null;
    let dragOffsetX, dragOffsetY;
    const messageModalContent = messageModal.querySelector('.modal-content');
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
    const baseURL = (() => {
        const { protocol, host, pathname } = location;
        const pathSegments = pathname.split('/');
        const basePath = pathSegments.length > 1 && pathSegments[1] !== 'index.html' ? `/${pathSegments[1]}` : '';
        return `${protocol}//${host}${basePath}`;
    })();
    async function handleResponse(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
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
        return response.json();
    }
    function handleError(error, prefix) {
        const message = error.message || 'サーバーとの通信に失敗しました。';
        console.error(prefix, ':', error);
        if (error.code === 'NOT_AUTHORIZED_FOR_OPERATIONS') {
            updateUI.showModalMessage('操作は許可されていません', message);
        } else {
            updateUI.message(`${prefix}: ${message}`, true);
        }
    }
    function updateUserProfileUI(user) {
        if (!user) return;
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            userAvatar.src = `/365Cloud/api/user/avatar?t=${new Date().getTime()}`;
        }
        document.getElementById('welcome-message').textContent = `ようこそ、${user.displayName || user.username}さん`;
        const discordStatusDiv = document.getElementById('discord-status');
        const linkButton = document.getElementById('link-discord-button');
        discordStatusDiv.innerHTML = '';
        const p = document.createElement('p');
        if (user.discordAuth && user.discordAuth.id) {
            if (!user.isVerifiedByAdmin) {
                p.style.color = '#ffb347';
                p.textContent = 'Discord連携済み - 管理者の承認待ちです。';
                linkButton.style.display = 'none';
            } else {
                p.style.color = '#28a745';
                p.textContent = `Discord連携済み: ${user.discordAuth.username}`;
                linkButton.style.display = 'none';
            }
        } else {
            p.style.color = '#dc3545';
            p.textContent = 'Discord未連携です。アカウントの全機能を利用するには連携が必要です。';
            linkButton.style.display = 'inline-block';
        }
        discordStatusDiv.appendChild(p);
    }
    const mobileBreadcrumb = document.getElementById('mobile-breadcrumb');
    const mobilePathDisplay = document.getElementById('mobile-path-display');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    const mobileNewFolderBtn = document.getElementById('mobile-new-folder-btn');
    const appContainer = document.querySelector('.app-container');
    const updateUI = {
        currentFolderDisplay: () => {
            const folderPath = currentFolder ? `/${currentFolder}` : '/';
            currentFolderDisplaySidebar.textContent = `現在のフォルダー: ${folderPath}`;
            currentFolderDisplayMain.textContent = `/${currentFolder || ''}`;
            if (mobilePathDisplay) {
                mobilePathDisplay.textContent = currentFolder ? currentFolder.split('/').pop() : 'ホーム';
            }
        },
        message: (message, isError = false) => {
            messageElement.textContent = message;
            messageElement.style.color = isError ? 'var(--text-color-message-error)' : 'var(--text-color-message-success)';
        },
        clearMessage: () => { messageElement.textContent = ''; },
        storageInfo: (used, quota) => { storageInfoElement.textContent = `使用容量: ${used} / ${quota}`; },
        backButtonVisibility: () => {
            backButton.style.display = currentFolder ? 'inline-block' : 'none';
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
            if (window.matchMedia('(max-width: 768px)').matches) {
                const isOpen = open !== undefined ? open : !sidebar.classList.contains('open');
                sidebar.classList.toggle('open', isOpen);
                document.body.classList.toggle('sidebar-open', isOpen);
            }
        },
        setPreviewOpen: (isOpen) => {
            document.body.classList.toggle('preview-open', isOpen);
            document.querySelector('.main-content').style.overflowY = isOpen ? 'hidden' : 'auto';
        },
        showModalMessage: (title, message) => {
            messageModalTitle.textContent = title;
            messageModalText.textContent = message;
            messageModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            const modalContentRect = messageModalContent.getBoundingClientRect();
            messageModalContent.style.left = `${(window.innerWidth - modalContentRect.width) / 2}px`;
            messageModalContent.style.top = `${(window.innerHeight - modalContentRect.height) / 2}px`;
        },
        hideModalMessage: () => {
            messageModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    };
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${['Bytes', 'KB', 'MB', 'GB', 'TB'][i]}`;
    }
    function parseBytes(str) {
        if (typeof str !== 'string') return 0;
        const match = str.trim().toUpperCase().match(/^(\d+\.?\d*)\s*([KMGT])?B?$/);
        if (!match) return parseFloat(str) || 0;
        const num = parseFloat(match[1]);
        const unit = match[2];
        const powers = { 'K': 1, 'M': 2, 'G': 3, 'T': 4 };
        return num * Math.pow(1024, powers[unit] || 0);
    }
    const nameRegex = /^[a-zA-Z0-9_.\- ()\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+$/u;
    function isInvalidName(name) { return name === '.' || name === '..' || name.includes('..') || (name.startsWith('.') && name.length > 1); }
    function isRenamingInProgress() { return !!fileListElement.querySelector('.rename-input'); }
    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
    function initDragAndDrop() {
        const items = fileListElement.querySelectorAll('li[data-file-name]');
        const folders = fileListElement.querySelectorAll('li[data-is-directory="true"]');
        items.forEach(item => {
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                if (document.activeElement.tagName === 'INPUT') {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', item.dataset.fileName);
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
                if (sourceName === folder.dataset.fileName) {
                    return;
                }
                fileOperations.moveItem(sourceName, destinationPath);
            });
        });
    }
    const fileOperations = {
        loadFiles: (folder) => {
            return fetch(`${baseURL}/files?folder=${encodeURIComponent(folder)}`, { credentials: 'include' })
                .then(handleResponse)
                .then(data => {
                    fileListElement.innerHTML = '';
                    updateUI.storageInfo(data.storageUsed, data.storageQuota);
                    if (currentFolder) {
                        const backItem = document.createElement('li');
                        backItem.className = 'folder';
                        backItem.dataset.isDirectory = 'true';
                        backItem.dataset.path = currentFolder.substring(0, currentFolder.lastIndexOf('/'));
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
                            currentFolder = currentFolder.substring(0, currentFolder.lastIndexOf('/'));
                            fileOperations.loadFiles(currentFolder);
                        });
                        fileListElement.appendChild(backItem);
                    }
                    data.files.forEach(file => {
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
                            if (file.type) {
                                iconSpan.dataset.type = file.type;
                            }
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
                                const downloadUrl = `${baseURL}/download?file=${encodeURIComponent(currentFolder ? `${currentFolder}/${file.name}` : file.name)}`;
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
                        if (!file.isDirectory) buttonContainer.appendChild(createActionBtn('fas fa-eye', 'プレビュー', (e) => { e.stopPropagation(); fileOperations.showPreview(file); }));
                        buttonContainer.appendChild(createActionBtn('fas fa-edit', '名前変更', (e) => { e.stopPropagation(); fileOperations.startRename(listItem); }));
                        if (!file.isDirectory) buttonContainer.appendChild(createActionBtn('fas fa-share-alt', '共有', (e) => { e.stopPropagation(); fileOperations.shareFile(file); }));
                        buttonContainer.appendChild(createActionBtn('fas fa-trash-alt', '削除', (e) => { e.stopPropagation(); fileOperations.deleteFile(file.name, file.originalName); }));
                        listItem.appendChild(buttonContainer);
                        fileListElement.appendChild(listItem);
                    });
                    updateUI.showDropGuide(fileListElement.children.length === 0);
                    updateUI.backButtonVisibility();
                    updateUI.currentFolderDisplay();
                    updateUI.clearMessage();
                    initDragAndDrop();
                })
                .catch(err => {
                    handleError(err, 'ファイル一覧の取得に失敗しました');
                    fileListElement.innerHTML = '';
                    updateUI.showDropGuide(true);
                    throw err;
                });
        },
        createFolder: () => {
            if (isRenamingInProgress()) return;
            const folderNameInput = document.getElementById('folder-name');
            let folderName = folderNameInput.value.trim().replace(/^\/|\/$/g, '');
            if (!folderName || isInvalidName(folderName) || !nameRegex.test(folderName)) return alert('フォルダー名が不正です。');
            fetch(`${baseURL}/create-folder`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName }), credentials: 'include'
            }).then(handleResponse).then(data => {
                updateUI.message(data.message, false);
                fileOperations.loadFiles(currentFolder);
                folderNameInput.value = '';
            }).catch(err => handleError(err, 'フォルダー作成に失敗しました'));
        },
        deleteFile: (fileName, originalName) => {
            if (isRenamingInProgress()) return;
            if (!confirm(`「${originalName}」を削除しますか？`)) return;
            fetch(`${baseURL}/delete`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: fileName }), credentials: 'include'
            }).then(handleResponse).then(data => {
                updateUI.message(data.message, false);
                fileOperations.loadFiles(currentFolder);
            }).catch(err => handleError(err, '削除に失敗しました'));
        },
        moveItem: (sourceName, destinationFolder) => {
            if (isRenamingInProgress()) return;
            fetch(`${baseURL}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: sourceName,
                    destinationFolder: destinationFolder
                }),
                credentials: 'include'
            })
            .then(handleResponse)
            .then(data => {
                updateUI.message(data.message, false);
                fileOperations.loadFiles(currentFolder);
            })
            .catch(err => handleError(err, '移動に失敗しました'));
        },
        shareFile: (file) => {
            if (isRenamingInProgress()) return;
            shareOptionsFileName.textContent = `ファイル: ${file.originalName}`;
            shareOptionsErrorMessage.textContent = '';
            shareOptionsPinInput.value = '';
            shareOptionsPasswordInput.value = '';
            shareOptionsPinContainer.style.display = 'none';
            shareOptionsPasswordContainer.style.display = 'none';
            shareOptionsModal.querySelector('input[value="none"]').checked = true;
            createShareLinkButton.disabled = false;
            createShareLinkButton.textContent = '共有リンクを作成';
            shareOptionsModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            const createLinkHandler = async () => {
                shareOptionsErrorMessage.textContent = '';
                createShareLinkButton.disabled = true;
                createShareLinkButton.textContent = '作成中...';
                const protectionType = shareOptionsModal.querySelector('input[name="protection"]:checked').value;
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
                    const filePath = currentFolder ? `${currentFolder}/${file.name}` : file.name;
                    const response = await fetch(`${baseURL}/share`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file: filePath, protection: protection }),
                        credentials: 'include'
                    });
                    const data = await handleResponse(response);
                    shareOptionsModal.style.display = 'none';
                    shareLinkInput.value = data.shareLink;
                    shareModal.style.display = "flex";
                } catch (error) {
                    shareOptionsErrorMessage.textContent = `エラー: ${error.message}`;
                } finally {
                    createShareLinkButton.disabled = false;
                    createShareLinkButton.textContent = '共有リンクを作成';
                }
            };
            createShareLinkButton.replaceWith(createShareLinkButton.cloneNode(true));
            document.getElementById('create-share-link-button').addEventListener('click', createLinkHandler);
        },
        showPreview: (file) => {
            if (isRenamingInProgress()) return;
            previewContainer.style.display = "flex";
            previewData.innerHTML = "";
            updateUI.setPreviewOpen(true);
            const filePath = currentFolder ? `${currentFolder}/${file.name}` : file.name;
            const fileUrl = `${baseURL}/download?file=${encodeURIComponent(filePath)}`;
            const type = file.type || '';
            let element;
            if (type.startsWith('image/')) element = document.createElement('img');
            else if (type.startsWith('video/')) element = document.createElement('video');
            else if (type.startsWith('audio/')) element = document.createElement('audio');
            else if (type === 'text/plain') {
                fetch(fileUrl, { credentials: 'include' }).then(r => r.text()).then(text => {
                    const pre = document.createElement('pre');
                    pre.textContent = text;
                    previewData.appendChild(pre);
                }).catch(err => previewData.textContent = `プレビュー失敗: ${err.message}`);
                return;
            } else {
                previewData.innerHTML = `<div>プレビュー非対応<br>(${type || '不明'})</div>`;
                return;
            }
            element.src = fileUrl;
            if (element.tagName !== 'IMG') element.controls = true;
            element.onerror = () => previewData.textContent = "メディアの読み込みに失敗しました。";
            previewData.appendChild(element);
        },
        startRename: (listItem) => {
            if (isRenamingInProgress()) return;
            const nameSpan = listItem.querySelector('.item-name');
            const buttonContainer = listItem.querySelector('.item-actions');
            const originalName = listItem.dataset.originalName;
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
        confirmRename: (listItem, oldFileName, newName, originalButtonElements) => {
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
                if (!listItem.dataset.isDirectory) { nameSpan.innerHTML += `<span class="item-size">${listItem.querySelector('.item-size')?.textContent || ''}</span>`; }
                fileOperations.cancelRename(listItem, nameSpan, originalButtonElements);
                return;
            }
            fetch(`${baseURL}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldName: oldFileName, newName: trimmedNewName }),
                credentials: 'include'
            })
            .then(handleResponse)
            .then(data => {
                updateUI.message(data.message, false);
                fileOperations.loadFiles(currentFolder); 
            })
            .catch(err => {
                handleError(err, '名前の変更に失敗しました');
                fileOperations.loadFiles(currentFolder); 
            });
        },
        cancelRename: (listItem, originalNameSpan, originalButtonElements) => {
            const input = listItem.querySelector('.rename-input');
            if (input) {
                input.replaceWith(originalNameSpan);
            }
            const buttonContainer = listItem.querySelector('.item-actions');
            buttonContainer.innerHTML = '';
            originalButtonElements.forEach(btn => buttonContainer.appendChild(btn));
        },
        logout: () => {
            if (isRenamingInProgress()) return;
            fetch(`${baseURL}/logout`, { method: 'POST', credentials: 'include' })
                .then(handleResponse)
                .then(data => {
                    alert(data.message);
                    window.location.href = `${baseURL}/login.html`;
                }).catch(err => handleError(err, 'ログアウトに失敗しました'));
        }
    };
    const storageOperations = {
        CHUNK_SIZE: 5 * 1024 * 1024,
        CHUNK_UPLOAD_THRESHOLD: 10 * 1024 * 1024,
        checkStorageBeforeUpload: (files) => {
            return new Promise((resolve, reject) => {
                fetch(`${baseURL}/storage`, { credentials: 'include' })
                    .then(handleResponse)
                    .then(data => {
                        const usedBytes = parseBytes(data.storageUsed);
                        const quotaBytes = parseBytes(data.storageQuota);
                        const totalUploadSizeBytes = Array.from(files).reduce((acc, file) => acc + file.size, 0);
                        if (quotaBytes > 0 && usedBytes + totalUploadSizeBytes > quotaBytes) {
                            reject(new Error(`ディスク容量が上限を超えます。\n\n現在の使用量: ${data.storageUsed}\n上限: ${data.storageQuota}\nアップロードサイズ合計: ${formatFileSize(totalUploadSizeBytes)}`));
                        } else {
                            resolve();
                        }
                    })
                    .catch(reject);
            });
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
                    progressCallback(file.name, percent);
                }
            };
            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
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
                    formData.append('totalChunks', totalChunks);
                    formData.append('fileName', file.name);
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${baseURL}/api/upload-chunk?fileId=${fileId}&chunkIndex=${currentChunkIndex}`, true);
                    xhr.withCredentials = true;
                    await new Promise((resolve, reject) => {
                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                uploadedChunks++;
                                const percent = (uploadedChunks / totalChunks) * 100;
                                progressCallback(file.name, percent);
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
                    body: JSON.stringify({ fileId, fileName: file.name, totalChunks, currentFolder: currentFolder }),
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
            const uploadButton = document.getElementById('upload-button');
            const clearFileButton = document.getElementById('clear-file-button');
            const fileInput = document.getElementById('file-upload');
            const dropArea = document.getElementById('file-list-container');
            const globalProgressContainer = document.getElementById('global-upload-progress-container');
            const globalProgressBar = document.getElementById('global-upload-progress-bar');
            const globalProgressText = document.getElementById('global-upload-progress-text');
            uploadButton.disabled = true;
            clearFileButton.disabled = true;
            fileInput.disabled = true;
            dropArea.style.pointerEvents = 'none';
            updateUI.message('アップロードを開始します...', false);
            globalProgressContainer.style.display = 'flex';
            try {
                await storageOperations.checkStorageBeforeUpload(files);
                let completedFiles = 0;
                const fileProgress = new Map();
                Array.from(files).forEach(file => fileProgress.set(file.name, { uploaded: 0, total: file.size }));
                const totalBytesToUpload = Array.from(files).reduce((sum, file) => sum + file.size, 0);
                const updateGlobalProgress = () => {
                    let currentTotalUploadedBytes = 0;
                    fileProgress.forEach(progress => currentTotalUploadedBytes += progress.uploaded);
                    const globalPercent = totalBytesToUpload > 0 ? (currentTotalUploadedBytes / totalBytesToUpload) * 100 : 0;
                    globalProgressBar.style.width = `${globalPercent}%`;
                    globalProgressText.textContent = `${Math.round(globalPercent)}%`;
                    const textWidth = globalProgressText.offsetWidth;
                    if (globalProgressBar.offsetWidth < textWidth + 15) {
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
                };
                const fileProgressCallback = (fileName, percent) => {
                    const fileInfo = fileProgress.get(fileName);
                    if (fileInfo) {
                        fileInfo.uploaded = fileInfo.total * (percent / 100);
                        fileProgress.set(fileName, fileInfo);
                    }
                    updateGlobalProgress();
                    if (window.Android && typeof window.Android.uploadProgress === 'function') {
                        const loaded = Math.round(fileInfo ? fileInfo.uploaded : 0);
                        const total = Math.round(fileInfo ? fileInfo.total : 0);
                        window.Android.uploadProgress(fileName, Math.round(percent), loaded, total);
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
                        window.Android.uploadComplete(fileName, success, message);
                    }
                    if (completedFiles === files.length) {
                        updateUI.message('すべてのファイルのアップロードが完了しました。', false);
                        globalProgressContainer.style.display = 'none';
                        uploadButton.disabled = false;
                        clearFileButton.disabled = false;
                        fileInput.disabled = false;
                        dropArea.style.pointerEvents = 'auto';
                        fileInput.value = '';
                        fileOperations.loadFiles(currentFolder);
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
                globalProgressContainer.style.display = 'none';
                uploadButton.disabled = false;
                clearFileButton.disabled = false;
                fileInput.disabled = false;
                dropArea.style.pointerEvents = 'auto';
                fileInput.value = '';
            }
        }
    };
    backButton.addEventListener('click', () => {
        if (isRenamingInProgress()) return;
        if (currentFolder === '' || currentFolder.lastIndexOf('/') < 0) currentFolder = '';
        else currentFolder = currentFolder.substring(0, currentFolder.lastIndexOf('/'));
        fileOperations.loadFiles(currentFolder);
    });
    document.getElementById('upload-button').addEventListener('click', () => storageOperations.uploadFiles(fileInput.files));
    document.getElementById('clear-file-button').addEventListener('click', () => { fileInput.value = ''; document.getElementById('upload-progress').textContent = ''; updateUI.clearMessage(); });
    document.getElementById('create-folder-button').addEventListener('click', fileOperations.createFolder);
    document.getElementById('logout-button').addEventListener('click', fileOperations.logout);
    document.getElementById('preview-close-button').addEventListener('click', () => {
        previewContainer.style.display = "none";
        previewData.innerHTML = "";
        updateUI.setPreviewOpen(false);
    });
    closeShareModalButton.addEventListener('click', () => { shareModal.style.display = 'none'; document.body.classList.remove('modal-open'); });
    copyShareLinkButton.addEventListener('click', () => {
        shareLinkInput.select();
        try {
            document.execCommand('copy');
            copyShareLinkButton.textContent = 'コピーしました！';
            setTimeout(() => { copyShareLinkButton.textContent = 'コピー'; }, 1500);
        } catch (err) { alert("クリップボードへのコピーに失敗しました。"); }
    });
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); if(!isRenamingInProgress()) dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', (e) => { e.preventDefault(); dropArea.classList.remove('drag-over'); if(!isRenamingInProgress()) storageOperations.uploadFiles(e.dataTransfer.files); });
    resizer.addEventListener('mousedown', (e) => { if (window.matchMedia('(max-width: 768px)').matches) return; isResizing = true; startX = e.clientX; startWidth = sidebar.offsetWidth; document.body.style.cursor = 'ew-resize'; });
    document.addEventListener('mousemove', (e) => { if (!isResizing) return; const newWidth = startWidth + (e.clientX - startX); if (newWidth > 150 && newWidth < window.innerWidth * 0.5) sidebar.style.flexBasis = `${newWidth}px`; });
    document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = 'default'; });
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => { 
            document.body.classList.toggle('dark-mode'); 
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
        });
    }
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); }
    sidebarToggle.addEventListener('click', (e) => { e.stopPropagation(); updateUI.toggleSidebar(); });
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', (e) => { e.stopPropagation(); updateUI.toggleSidebar(); });
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
            currentFolder = currentFolder.includes('/')
                ? currentFolder.substring(0, currentFolder.lastIndexOf('/'))
                : '';
            fileOperations.loadFiles(currentFolder);
        });
    }
    if (mobileNewFolderBtn) {
        mobileNewFolderBtn.addEventListener('click', () => {
            const name = prompt('新しいフォルダー名を入力:');
            if (!name || !name.trim()) return;
            const folderNameInput = document.getElementById('folder-name');
            folderNameInput.value = name.trim();
            fileOperations.createFolder();
        });
    }
    document.body.addEventListener('click', (e) => { if (window.matchMedia('(max-width: 768px)').matches && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== sidebarToggle) { updateUI.toggleSidebar(false); } });
    shareOptionsProtectionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            shareOptionsPinContainer.style.display = (radio.value === 'pin' && radio.checked) ? 'block' : 'none';
            shareOptionsPasswordContainer.style.display = (radio.value === 'password' && radio.checked) ? 'block' : 'none';
        });
    });
    shareOptionsCloseButton.addEventListener('click', () => { shareOptionsModal.style.display = 'none'; document.body.classList.remove('modal-open'); });
    shareOptionsModal.addEventListener('click', (e) => { if (e.target === shareOptionsModal) { shareOptionsModal.style.display = 'none'; document.body.classList.remove('modal-open'); } });
    closeMessageModalButton.addEventListener('click', updateUI.hideModalMessage);
    messageModalOkButton.addEventListener('click', updateUI.hideModalMessage);
    messageModal.addEventListener('click', (e) => { if (e.target === messageModal) { updateUI.hideModalMessage(); } });
    const initializePage = async () => {
        try {
            const data = await fetch(`${baseURL}/check-login-status`, { credentials: 'include' }).then(handleResponse);
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
        } catch (error) {
            console.error('Login session invalid or check failed. Redirecting to login page:', error);
            window.location.href = `${baseURL}/login.html`;
        }
    };
    initializePage();
    const appTitle = document.querySelector('.sidebar h1');
    const hiddenOptionsModal = document.getElementById('hidden-options-modal');
});

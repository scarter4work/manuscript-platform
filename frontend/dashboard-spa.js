// Single Page Application Logic for Manuscript Dashboard
// Version: 2025-10-14-02 - Fixed immediate report display

const app = {
    // Configuration
    API_BASE: window.location.hostname === 'localhost'
        ? 'http://localhost:8080'  // Spring Boot default port
        : window.location.origin,
    
    // State
    state: {
        currentView: 'library',
        manuscripts: [],
        manuscriptKey: null,
        reportId: null,
        analysisResults: {
            developmental: null,
            lineEditing: null,
            copyEditing: null
        },
        assetResults: {
            bookDescription: null,
            keywords: null,
            categories: null,
            authorBio: null,
            backMatter: null,
            coverBrief: null,
            seriesDescription: null,
            errors: null
        },
        generatedAssets: null,
        marketAnalysis: null,
        socialMedia: null
    },

    // Initialize app
    async init() {
        console.log('Initializing SPA...');

        // Load user info and setup admin navigation
        await this.loadUserInfo();

        // Set up file input handler (only if element exists)
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const fileNameEl = document.getElementById('fileName');
                    const fileLabelEl = document.getElementById('fileLabel');
                    const fileSizeEl = document.getElementById('fileSize');

                    // Show loading state immediately
                    if (fileLabelEl) {
                        fileLabelEl.classList.remove('has-file');
                        fileLabelEl.classList.add('loading');
                    }
                    if (fileNameEl) fileNameEl.innerHTML = '⏳ Processing file...';
                    if (fileSizeEl) fileSizeEl.style.display = 'none';

                    // Simulate small delay to ensure loading state is visible
                    // (for large files this happens naturally, for small files we show it briefly)
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Update to success state
                    if (fileLabelEl) {
                        fileLabelEl.classList.remove('loading');
                        fileLabelEl.classList.add('has-file');
                    }
                    if (fileNameEl) fileNameEl.textContent = `✓ ${file.name}`;

                    // Display file size
                    if (fileSizeEl) {
                        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                        fileSizeEl.textContent = `📊 ${sizeMB} MB`;
                        fileSizeEl.style.display = 'block';
                    }
                }
            });
        }

        // Check for initial route from URL
        const hash = window.location.hash.slice(1); // Remove #
        const params = new URLSearchParams(window.location.search);
        const reportId = params.get('loadReport');

        // Determine default view based on which page we're on
        const hasLibrary = document.getElementById('viewLibrary');
        const defaultView = hasLibrary ? 'library' : 'upload';

        if (reportId) {
            this.state.reportId = reportId;
            this.navigate('summary');
        } else if (hash) {
            const [view, id] = hash.split('/');
            if (id) this.state.reportId = id;
            this.navigate(view || defaultView);
        } else {
            // Default view based on which page we're on
            this.navigate(defaultView);
        }

        // Handle browser back/forward
        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash.slice(1);
            const [view] = newHash.split('/');
            if (view && view !== this.state.currentView) {
                this.navigate(view, false, true);
            }
        });
    },

    // Load user info
    async loadUserInfo() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, { credentials: 'include' });

            if (!response.ok) {
                console.error('Not authenticated');
                return;
            }

            const data = await response.json();

            if (data.userId) {
                // Update user info display with logout button
                document.getElementById('userInfo').innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="text-align: right;">
                            <div style="opacity: 0.9;">👤 ${data.email}</div>
                            <div style="font-size: 12px; opacity: 0.7;">${data.role.toUpperCase()}</div>
                        </div>
                        <button onclick="app.handleLogout()" style="
                            background: white;
                            color: #667eea;
                            border: 2px solid white;
                            padding: 8px 16px;
                            border-radius: 6px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.background='rgba(255,255,255,0.9)'" onmouseout="this.style.background='white'">
                            Logout
                        </button>
                    </div>
                `;

                // Add admin navigation items if user is admin
                if (data.role === 'admin') {
                    const mainNav = document.getElementById('mainNav');
                    const adminNav = `
                        <a href="/admin-dashboard.html" class="main-nav-item">🎯 Admin Dashboard</a>
                        <a href="/admin-dmca.html" class="main-nav-item">🔒 DMCA Review</a>
                    `;
                    mainNav.innerHTML += adminNav;
                }
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    // Handle logout
    async handleLogout() {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        // Redirect to login page
        window.location.href = '/login.html';
    },

    // ====================
    // MANUSCRIPT LIBRARY
    // ====================

    // Load manuscript library
    async loadLibrary() {
        console.log('Loading manuscript library...');

        try {
            // Show loading state
            document.getElementById('libraryLoading').style.display = 'block';
            document.getElementById('libraryEmpty').style.display = 'none';
            document.getElementById('manuscriptsList').style.display = 'none';

            // Fetch manuscripts and stats in parallel
            const [manuscriptsResponse, statsResponse] = await Promise.all([
                fetch(`${this.API_BASE}/manuscripts`, { credentials: 'include' }),
                fetch(`${this.API_BASE}/manuscripts/stats`, { credentials: 'include' })
            ]);

            if (!manuscriptsResponse.ok || !statsResponse.ok) {
                throw new Error('Failed to load manuscripts');
            }

            const manuscriptsData = await manuscriptsResponse.json();
            const statsData = await statsResponse.json();

            // Update state
            this.state.manuscripts = manuscriptsData.manuscripts || [];

            // Update stats display
            this.displayStats(statsData.stats);

            // Display manuscripts
            if (this.state.manuscripts.length === 0) {
                document.getElementById('libraryLoading').style.display = 'none';
                document.getElementById('libraryEmpty').style.display = 'block';
            } else {
                document.getElementById('libraryLoading').style.display = 'none';
                this.displayManuscripts(this.state.manuscripts);
            }

        } catch (error) {
            console.error('Failed to load library:', error);
            document.getElementById('libraryLoading').style.display = 'none';
            document.getElementById('libraryEmpty').innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 5em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">Error Loading Manuscripts</h3>
                    <p style="color: #999; margin-bottom: 30px;">${error.message}</p>
                    <button class="btn" onclick="app.loadLibrary()">Try Again</button>
                </div>
            `;
            document.getElementById('libraryEmpty').style.display = 'block';
        }
    },

    // Display stats
    displayStats(stats) {
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statAnalyzing').textContent = stats.byStatus?.analyzing || 0;
        document.getElementById('statComplete').textContent = stats.byStatus?.complete || 0;

        // Format word count
        const totalWords = stats.totalWordCount || 0;
        const formattedWords = totalWords >= 1000
            ? (totalWords / 1000).toFixed(1) + 'K'
            : totalWords.toString();
        document.getElementById('statWords').textContent = formattedWords;
    },

    // Display manuscripts
    displayManuscripts(manuscripts) {
        const listContainer = document.getElementById('manuscriptsList');

        if (!manuscripts || manuscripts.length === 0) {
            listContainer.style.display = 'none';
            return;
        }

        // Sort by upload date (newest first)
        manuscripts.sort((a, b) => b.uploaded_at - a.uploaded_at);

        const manuscriptCards = manuscripts.map(ms => {
            const uploadDate = new Date(ms.uploaded_at * 1000).toLocaleDateString();
            const statusColors = {
                draft: '#999',
                analyzing: '#ffa726',
                complete: '#4caf50'
            };
            const statusColor = statusColors[ms.status] || '#999';

            const reportId = ms.metadata?.reportId || '';

            return `
                <div class="manuscript-card" style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 20px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.1)';">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; color: #333; font-size: 1.3em;">${ms.title || 'Untitled Manuscript'}</h3>
                            <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 0.9em; color: #666;">
                                <span style="display: flex; align-items: center; gap: 5px;">
                                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
                                    ${ms.status.charAt(0).toUpperCase() + ms.status.slice(1)}
                                </span>
                                ${ms.genre ? `<span>📚 ${ms.genre.charAt(0).toUpperCase() + ms.genre.slice(1)}</span>` : ''}
                                ${ms.word_count ? `<span>📝 ${ms.word_count.toLocaleString()} words</span>` : ''}
                                <span>📅 ${uploadDate}</span>
                            </div>
                        </div>
                        <div style="background: ${statusColor}22; color: ${statusColor}; padding: 6px 16px; border-radius: 20px; font-size: 0.85em; font-weight: 600; white-space: nowrap;">
                            ${ms.status.toUpperCase()}
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px;">
                        ${ms.status === 'complete' && reportId ? `
                            <button class="btn" onclick="app.viewManuscript('${ms.id}', '${reportId}')" style="padding: 10px 20px; font-size: 14px; margin: 0;">
                                📊 View Report
                            </button>
                        ` : ''}
                        ${ms.status === 'analyzing' && reportId ? `
                            <button class="btn" onclick="app.checkAnalysisStatus('${reportId}')" style="padding: 10px 20px; font-size: 14px; margin: 0; background: #ffa726;">
                                🔄 Check Progress
                            </button>
                        ` : ''}
                        ${ms.status === 'draft' || ms.status === 'complete' ? `
                            <button class="btn-secondary btn" onclick="app.reanalyzeManuscript('${ms.id}')" style="padding: 10px 20px; font-size: 14px; margin: 0; background: #667eea;">
                                🔄 ${ms.status === 'draft' ? 'Start Analysis' : 'Reanalyze'}
                            </button>
                        ` : ''}
                        <button class="btn" onclick="app.deleteManuscript('${ms.id}', '${ms.title}')" style="padding: 10px 20px; font-size: 14px; margin: 0; background: #f44336;">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = manuscriptCards;
        listContainer.style.display = 'block';
    },

    // Filter manuscripts
    filterManuscripts() {
        const statusFilter = document.getElementById('filterStatus').value;
        const genreFilter = document.getElementById('filterGenre').value;

        let filtered = [...this.state.manuscripts];

        if (statusFilter) {
            filtered = filtered.filter(ms => ms.status === statusFilter);
        }

        if (genreFilter) {
            filtered = filtered.filter(ms => ms.genre === genreFilter);
        }

        this.displayManuscripts(filtered);
    },

    // View manuscript report
    viewManuscript(manuscriptId, reportId) {
        console.log('Viewing manuscript:', manuscriptId, reportId);
        this.state.reportId = reportId;
        this.navigate('summary');
    },

    // Check analysis status
    async checkAnalysisStatus(reportId) {
        console.log('Checking analysis status:', reportId);
        this.state.reportId = reportId;
        this.navigate('analysis');
        // Start polling for status
        await this.pollAnalysisStatus();
    },

    // Reanalyze manuscript
    async reanalyzeManuscript(manuscriptId) {
        if (!confirm('Are you sure you want to (re)analyze this manuscript? This will start a new analysis process.')) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/manuscripts/${manuscriptId}/reanalyze`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start analysis');
            }

            const result = await response.json();

            alert('Analysis started! Redirecting to progress view...');

            this.state.reportId = result.reportId;
            this.navigate('analysis');
            await this.pollAnalysisStatus();

        } catch (error) {
            console.error('Reanalyze error:', error);
            alert('Failed to start analysis: ' + error.message);
        }
    },

    // Delete manuscript
    async deleteManuscript(manuscriptId, title) {
        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone and will delete all associated analysis data.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/manuscripts/${manuscriptId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete manuscript');
            }

            alert('Manuscript deleted successfully');

            // Reload library
            await this.loadLibrary();

        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete manuscript: ' + error.message);
        }
    },

    // Navigation function
    navigate(view, reset = false, skipHistory = false) {
        console.log('Navigating to:', view);
        
        // Reset state if requested
        if (reset) {
            this.resetState();
        }
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Show target view
        const targetView = document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`);
        if (targetView) {
            targetView.classList.add('active');
            this.state.currentView = view;
            
            // Update URL hash (unless we're already handling a hashchange)
            if (!skipHistory) {
                const newHash = this.state.reportId ? `${view}/${this.state.reportId}` : view;
                window.location.hash = newHash;
            }
            
            // Update breadcrumb
            this.updateBreadcrumb(view);
            
            // Load content if needed
            if (view === 'library') {
                this.loadLibrary();
            } else if (view === 'report') {
                this.loadReport();
            } else if (view === 'annotated') {
                this.loadAnnotated();
            } else if (view === 'summary' && this.state.reportId && !this.state.analysisResults.developmental) {
                // If navigating to summary but don't have results, fetch and show data
                this.showLimitedSummary();
            } else if (view === 'market') {
                // Load market analysis view
                this.loadMarketAnalysisView();
            } else if (view === 'assets') {
                // Load assets view
                this.loadAssetsView();
            } else if (view === 'formatting') {
                // Load formatting view
                this.loadFormattingView();
            } else if (view === 'social') {
                // Load social media view
                this.loadSocialView();
            }
        }
    },

    // Update breadcrumb
    updateBreadcrumb(view) {
        const breadcrumb = document.getElementById('breadcrumb');
        const breadcrumbContent = document.getElementById('breadcrumbContent');

        if (view === 'upload' || view === 'library') {
            breadcrumb.style.display = 'none';
            return;
        }
        
        breadcrumb.style.display = 'block';
        
        const homeIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0L0 6v10h6V10h4v6h6V6L8 0z"/>
        </svg>`;
        
        let content = `
            <a onclick="app.navigate('upload', true)">${homeIcon} Dashboard</a>
            <span class="breadcrumb-separator">›</span>
        `;
        
        if (view === 'analysis') {
            content += `<span class="breadcrumb-current">Running Analysis</span>`;
        } else if (view === 'summary') {
            content += `<span class="breadcrumb-current">Analysis Results</span>`;
        } else if (view === 'report') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Summary Report</span>
            `;
        } else if (view === 'annotated') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Annotated Manuscript</span>
            `;
        } else if (view === 'market') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Market Analysis</span>
            `;
        } else if (view === 'social') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Social Media Content</span>
            `;
        } else if (view === 'assetGeneration') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Generating Assets</span>
            `;
        } else if (view === 'assets') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Marketing Assets</span>
            `;
        } else if (view === 'formatting') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Format Manuscript</span>
            `;
        } else if (view === 'formattingProgress') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Formatting in Progress</span>
            `;
        } else if (view === 'formattingComplete') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Formatting Complete</span>
            `;
        } else if (view === 'marketAnalysis') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Market Analysis</span>
            `;
        } else if (view === 'marketAnalysisProgress') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Analyzing Market</span>
            `;
        } else if (view === 'marketAnalysisResults') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Market Analysis Results</span>
            `;
        } else if (view === 'socialMedia') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Social Media Marketing</span>
            `;
        } else if (view === 'socialMediaProgress') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Generating Marketing Kit</span>
            `;
        } else if (view === 'socialMediaResults') {
            content += `
                <a onclick="app.navigate('summary')">Analysis Results</a>
                <span class="breadcrumb-separator">›</span>
                <a onclick="app.navigate('assets')">Marketing Assets</a>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">Marketing Kit</span>
            `;
        }

        breadcrumbContent.innerHTML = content;
    },

    // Reset state
    resetState() {
        this.state.manuscriptKey = null;
        this.state.reportId = null;
        this.state.analysisResults = {
            developmental: null,
            lineEditing: null,
            copyEditing: null
        };
        
        // Reset upload form
        document.getElementById('fileInput').value = '';
        document.getElementById('fileName').textContent = 'Click or drag to upload manuscript';
        document.getElementById('fileLabel').classList.remove('has-file');
        
        // Reset agent cards
        ['dev', 'line', 'copy'].forEach(agent => {
            this.updateAgentStatus(agent, 'pending', 'Pending');
            document.getElementById(agent + 'Details').innerHTML = '';
            document.getElementById(agent + 'Details').classList.remove('visible');
            document.getElementById(agent + 'DetailsBtn').classList.add('hidden');
        });
        
        // Hide breadcrumb
        document.getElementById('breadcrumb').style.display = 'none';
        
        // Clear URL hash
        window.location.hash = '';
    },

    // Upload and analyze (ASYNC VERSION)
    async uploadAndAnalyze() {
        const fileInput = document.getElementById('fileInput');
        const genre = document.getElementById('genre').value;
        const styleGuide = document.getElementById('styleGuide').value;
        const copyrightAttestation = document.getElementById('copyrightAttestation');

        if (!fileInput.files[0]) {
            alert('Please select a manuscript file');
            return;
        }

        // Phase E: Copyright attestation required
        if (!copyrightAttestation.checked) {
            alert('Please confirm that you own the copyright or have permission to upload this manuscript.\n\nThis attestation is required to comply with copyright law and the Digital Millennium Copyright Act (DMCA).');
            return;
        }

        // Navigate to analysis view
        this.navigate('analysis');
        this.updateProgress(0, 'Preparing upload...');

        // Disable upload button
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
        }

        try {
            // Upload manuscript (Phase C: analysis is automatically queued on upload)
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('title', fileInput.files[0].name.replace(/\.[^/.]+$/, "")); // Remove extension
            formData.append('genre', genre);

            // Use XMLHttpRequest for upload progress tracking
            const uploadResult = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                // Track upload progress
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        const uploadProgress = Math.min(percentComplete * 0.15, 15); // Scale to 0-15%
                        const mbLoaded = (e.loaded / (1024 * 1024)).toFixed(2);
                        const mbTotal = (e.total / (1024 * 1024)).toFixed(2);
                        this.updateProgress(
                            uploadProgress,
                            `Uploading: ${mbLoaded}MB / ${mbTotal}MB (${percentComplete.toFixed(0)}%)`
                        );
                    }
                });

                // Handle completion
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            resolve(result);
                        } catch (error) {
                            reject(new Error('Invalid response format'));
                        }
                    } else {
                        reject(new Error(`Upload failed: ${xhr.responseText}`));
                    }
                });

                // Handle errors
                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload cancelled'));
                });

                // Open and send request
                xhr.open('POST', `${this.API_BASE}/upload/manuscript`);
                xhr.withCredentials = true;
                xhr.send(formData);
            });

            // Phase C returns: { manuscript: { id, reportId, status: 'queued', ... } }
            if (!uploadResult.manuscript || !uploadResult.manuscript.reportId) {
                throw new Error('Invalid upload response - no reportId');
            }

            this.state.manuscriptKey = uploadResult.manuscript.r2_key;
            this.state.reportId = uploadResult.manuscript.reportId;
            this.state.manuscriptId = uploadResult.manuscript.id;

            console.log('Upload complete:', {
                manuscriptId: this.state.manuscriptId,
                reportId: this.state.reportId,
                status: uploadResult.manuscript.status
            });

            this.updateProgress(15, 'Upload complete! Analysis queued...');

            // Phase C: Analysis is automatically queued, start polling for status
            await this.pollAnalysisStatus();

        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload/Analysis failed: ' + error.message);

            // Re-enable upload button
            const uploadBtn = document.getElementById('uploadBtn');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload & Start Analysis';
            }

            this.navigate('upload', true);
        }
    },

    // Poll for analysis status (Phase C - with automatic queueing)
    async pollAnalysisStatus() {
        const pollInterval = 2000; // Poll every 2 seconds
        const maxPolls = 600; // Max 20 minutes (600 * 2 seconds) - increased for real AI analysis
        let pollCount = 0;

        const poll = async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/analyze/status?reportId=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    throw new Error('Failed to get status');
                }

                const status = await response.json();
                console.log('Phase C Status:', status);

                // Update UI based on Phase C status
                if (status.status === 'queued') {
                    this.updateProgress(20, status.message || 'Analysis queued...');
                    this.updateAgentStatus('dev', 'pending', 'Queued');
                    this.updateAgentStatus('line', 'pending', 'Queued');
                    this.updateAgentStatus('copy', 'pending', 'Queued');
                }
                else if (status.status === 'processing' || status.status === 'running') {
                    // Update progress based on percentage (20-100 range to leave room for upload at 15%)
                    const progress = 20 + (status.progress * 0.80); // Scale from 20-100
                    this.updateProgress(progress, status.message || 'Processing analysis...');

                    // Update agent statuses based on currentStep
                    const currentStep = status.currentStep || '';

                    if (currentStep === 'initialization' || currentStep === 'developmental' || status.progress <= 33) {
                        this.updateAgentStatus('dev', 'running', 'Analyzing...');
                        this.updateAgentStatus('line', 'pending', 'Waiting');
                        this.updateAgentStatus('copy', 'pending', 'Waiting');
                    }
                    else if (currentStep === 'line-editing' || (status.progress > 33 && status.progress <= 66)) {
                        this.updateAgentStatus('dev', 'complete', 'Complete ✓');
                        this.updateAgentStatus('line', 'running', 'Analyzing...');
                        this.updateAgentStatus('copy', 'pending', 'Waiting');
                    }
                    else if (currentStep === 'copy-editing' || status.progress > 66) {
                        this.updateAgentStatus('dev', 'complete', 'Complete ✓');
                        this.updateAgentStatus('line', 'complete', 'Complete ✓');
                        this.updateAgentStatus('copy', 'running', 'Analyzing...');
                    }
                }
                else if (status.status === 'complete') {
                    // Analysis complete! Now start asset generation polling
                    this.updateProgress(100, 'Analysis complete! Generating marketing assets... ✨');
                    this.updateAgentStatus('dev', 'complete', 'Complete ✓');
                    this.updateAgentStatus('line', 'complete', 'Complete ✓');
                    this.updateAgentStatus('copy', 'complete', 'Complete ✓');

                    console.log('Analysis complete! Fetching results...');

                    // Fetch the analysis results from R2
                    await this.fetchAnalysisResults();

                    // Show summary immediately with analysis results
                    setTimeout(() => {
                        if (this.state.analysisResults.developmental) {
                            this.showSummary();
                        } else {
                            this.navigate('summary');
                        }

                        // Phase D: Start polling for asset generation in background
                        // This won't block showing the report
                        setTimeout(() => {
                            this.pollAssetStatus();
                        }, 2000);
                    }, 500);

                    return; // Stop polling analysis
                }
                else if (status.status === 'failed' || status.status === 'error') {
                    throw new Error(status.message || status.error || 'Analysis failed');
                }

                // Continue polling if not complete
                pollCount++;
                if (pollCount < maxPolls) {
                    setTimeout(poll, pollInterval);
                } else {
                    throw new Error('Analysis timeout - taking longer than expected. Please check back later.');
                }

            } catch (error) {
                console.error('Polling error:', error);
                alert('Analysis error: ' + error.message);
                this.navigate('upload', true);
            }
        };

        // Start polling
        poll();
    },

    // Phase D: Poll for asset generation status
    async pollAssetStatus() {
        const pollInterval = 3000; // Poll every 3 seconds
        const maxPolls = 20; // Max 60 seconds (20 * 3 seconds) - assets generate in background
        let pollCount = 0;

        const poll = async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/assets/status?reportId=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    // Asset status not found yet - assets might not have been queued yet
                    if (response.status === 404) {
                        console.log('Asset status not found, waiting...');
                        pollCount++;
                        if (pollCount < maxPolls) {
                            setTimeout(poll, pollInterval);
                        } else {
                            console.warn('Asset generation timeout');
                            this.showSummaryWithoutAssets();
                        }
                        return;
                    }
                    throw new Error('Failed to get asset status');
                }

                const status = await response.json();
                console.log('Phase D Asset Status:', status);

                // Update progress message based on status
                if (status.status === 'processing') {
                    const assetProgress = status.progress || 0;
                    this.updateProgress(100, `Generating marketing assets... ${assetProgress}%`);
                } else if (status.status === 'complete' || status.status === 'partial') {
                    // Assets complete!
                    console.log('Assets generated!', status);

                    // Store asset results in state
                    this.state.assetResults = {
                        bookDescription: status.bookDescription,
                        keywords: status.keywords,
                        categories: status.categories,
                        authorBio: status.authorBio,
                        backMatter: status.backMatter,
                        coverBrief: status.coverBrief,
                        seriesDescription: status.seriesDescription,
                        errors: status.errors
                    };

                    // If we're already on the summary page, refresh it to show assets
                    if (this.state.currentView === 'summary' && this.state.analysisResults.developmental) {
                        console.log('Refreshing summary with new assets...');
                        this.showSummary();
                    }

                    return; // Stop polling
                } else if (status.status === 'failed') {
                    console.error('Asset generation failed:', status.error);
                    // Summary is already showing - just stop polling
                    return;
                }

                // Continue polling if not complete
                pollCount++;
                if (pollCount < maxPolls) {
                    setTimeout(poll, pollInterval);
                } else {
                    console.warn('Asset generation timeout');
                    this.showSummaryWithoutAssets();
                }

            } catch (error) {
                console.error('Asset polling error:', error);
                // Summary is already showing - just stop polling
            }
        };

        // Start polling
        poll();
    },

    // Show summary without waiting for assets (fallback)
    showSummaryWithoutAssets() {
        console.log('Asset polling timed out - summary already visible');
        // No need to navigate - summary is already showing
        // Assets will be marked as unavailable in the UI
    },

    // Update progress bar
    updateProgress(percent, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        if (!progressBar || !progressText) {
            console.error('Progress elements not found!', { progressBar, progressText });
            return;
        }

        console.log('Updating progress:', percent + '%', text);
        progressBar.style.width = percent + '%';
        progressText.textContent = text;
    },

    // Update agent status
    updateAgentStatus(agent, status, text) {
        const agentCard = document.getElementById(agent + 'Agent');
        const statusSpan = document.getElementById(agent + 'Status');

        if (!agentCard || !statusSpan) {
            console.error('Agent elements not found!', { agent, agentCard, statusSpan });
            return;
        }

        console.log('Updating agent:', agent, status, text);
        agentCard.className = 'agent-card ' + status;
        statusSpan.className = 'agent-status status-' + status;
        statusSpan.textContent = text;
    },

    // Fetch analysis results from API
    async fetchAnalysisResults() {
        try {
            console.log('Fetching analysis results for reportId:', this.state.reportId);

            // Fetch all results using the new /results endpoint
            const response = await fetch(`${this.API_BASE}/results?id=${this.state.reportId}`, { credentials: 'include' });

            if (!response.ok) {
                throw new Error('Failed to fetch results');
            }

            const data = await response.json();
            console.log('Results fetched:', data);

            if (data.success && data.results) {
                // Store results
                this.state.analysisResults.developmental = data.results.developmental;
                this.state.analysisResults.lineEditing = data.results.lineEditing;
                this.state.analysisResults.copyEditing = data.results.copyEditing;

                // Display in agent cards
                if (data.results.developmental) {
                    this.displayDevelopmentalResults(data.results.developmental);
                }
                if (data.results.lineEditing) {
                    this.displayLineEditingResults(data.results.lineEditing);
                }
                if (data.results.copyEditing) {
                    this.displayCopyEditingResults(data.results.copyEditing);
                }

                console.log('Analysis results fetched and displayed successfully');
            }

        } catch (error) {
            console.error('Error fetching analysis results:', error);
            // Continue anyway - showLimitedSummary will handle missing data
        }
    },

    // Display results
    displayDevelopmentalResults(analysis) {
        const details = document.getElementById('devDetails');
        const btn = document.getElementById('devDetailsBtn');
        
        details.innerHTML = `
            <div class="score-display">
                <div class="score-item">
                    <div class="score-value">${analysis.analysis.overallScore}/10</div>
                    <div class="score-label">Overall Score</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${analysis.analysis.structure?.score || '-'}/10</div>
                    <div class="score-label">Structure</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${analysis.analysis.characters?.score || '-'}/10</div>
                    <div class="score-label">Characters</div>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <strong>Top Priorities:</strong>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    ${(analysis.analysis.topPriorities || []).map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        `;
        
        btn.classList.remove('hidden');
    },

    displayLineEditingResults(analysis) {
        const details = document.getElementById('lineDetails');
        const btn = document.getElementById('lineDetailsBtn');
        
        const assessment = analysis.overallAssessment;
        const patterns = analysis.patterns;
        
        details.innerHTML = `
            <div class="score-display">
                <div class="score-item">
                    <div class="score-value">${assessment.overallProseScore}/10</div>
                    <div class="score-label">Prose Score</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${patterns.totalIssues}</div>
                    <div class="score-label">Issues Found</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${patterns.passiveVoiceTotal}</div>
                    <div class="score-label">Passive Voice</div>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <strong>Key Weaknesses:</strong>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    ${(assessment.keyWeaknesses || []).map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        `;
        
        btn.classList.remove('hidden');
    },

    displayCopyEditingResults(analysis) {
        const details = document.getElementById('copyDetails');
        const btn = document.getElementById('copyDetailsBtn');
        
        const assessment = analysis.overallAssessment;
        
        details.innerHTML = `
            <div class="score-display">
                <div class="score-item">
                    <div class="score-value">${assessment.overallCopyScore}/10</div>
                    <div class="score-label">Copy Score</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${assessment.totalErrors}</div>
                    <div class="score-label">Errors Found</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${assessment.readyForPublication ? '✓' : '✗'}</div>
                    <div class="score-label">Ready to Publish</div>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <strong>Summary:</strong>
                <p style="margin-top: 10px;">${assessment.summary}</p>
            </div>
        `;
        
        btn.classList.remove('hidden');
    },

    // Toggle details
    toggleDetails(agent) {
        const details = document.getElementById(agent + 'Details');
        details.classList.toggle('visible');
        
        const btn = document.getElementById(agent + 'DetailsBtn');
        btn.textContent = details.classList.contains('visible') ? 'Hide Details' : 'View Details';
    },

    // Show summary
    showSummary() {
        const dev = this.state.analysisResults.developmental.analysis;
        const line = this.state.analysisResults.lineEditing.overallAssessment;
        const copy = this.state.analysisResults.copyEditing.overallAssessment;

        // Calculate overall score
        const overallScore = ((dev.overallScore * 0.4) + 
                             (line.overallProseScore * 0.3) + 
                             (copy.overallCopyScore * 0.3)).toFixed(1);

        // Total issues
        const totalIssues = (this.state.analysisResults.lineEditing.patterns.totalIssues || 0) + 
                           (copy.totalErrors || 0);

        // Ready for publication?
        const ready = overallScore >= 8 && copy.readyForPublication;

        document.getElementById('overallScore').textContent = overallScore + '/10';
        document.getElementById('totalIssues').textContent = totalIssues;
        document.getElementById('readyStatus').textContent = ready ? '✓ Yes' : '✗ Not Yet';

        let message = '';
        if (overallScore >= 9) {
            message = '🎉 Excellent! Your manuscript is publication-ready with minimal revisions.';
        } else if (overallScore >= 7) {
            message = '👍 Good work! Address the key issues and you\'ll be ready to publish.';
        } else if (overallScore >= 5) {
            message = '⚠️ Needs work. Focus on the top priorities from each analysis.';
        } else {
            message = '📝 Significant revision needed. Consider working through each agent\'s recommendations systematically.';
        }

        document.getElementById('summaryMessage').textContent = message;
        
        // Navigate to summary view
        this.navigate('summary');
    },

    // Show limited summary (when we only have reportId, not full analysis)
    async showLimitedSummary() {
        // Show loading state
        document.getElementById('overallScore').textContent = '...';
        document.getElementById('totalIssues').textContent = '...';
        document.getElementById('readyStatus').textContent = '...';
        document.getElementById('summaryMessage').textContent = 'Loading analysis data...';

        try {
            // Fetch the actual analysis data from the reports
            const response = await fetch(`${this.API_BASE}/report?id=${this.state.reportId}`, { credentials: 'include' });

            if (!response.ok) {
                throw new Error('Failed to fetch analysis data');
            }

            const reportHtml = await response.text();

            // Parse the HTML to extract data
            const parser = new DOMParser();
            const doc = parser.parseFromString(reportHtml, 'text/html');

            // Try to extract scores from the report HTML
            // Look for developmental score
            const devScoreElement = doc.querySelector('[data-dev-score]');
            const lineScoreElement = doc.querySelector('[data-line-score]');
            const copyScoreElement = doc.querySelector('[data-copy-score]');
            const totalIssuesElement = doc.querySelector('[data-total-issues]');

            let devScore = devScoreElement ? parseFloat(devScoreElement.textContent) : 7;
            let lineScore = lineScoreElement ? parseFloat(lineScoreElement.textContent) : 7;
            let copyScore = copyScoreElement ? parseFloat(copyScoreElement.textContent) : 8;
            let totalIssues = totalIssuesElement ? parseInt(totalIssuesElement.textContent) : 0;

            // If we couldn't extract from HTML, try to find text patterns
            if (!devScoreElement) {
                const scoreMatch = reportHtml.match(/Overall Score[:\s]+(\d+\.?\d*)/i);
                if (scoreMatch) devScore = parseFloat(scoreMatch[1]);
            }

            // Calculate weighted overall score
            const overallScore = ((devScore * 0.4) + (lineScore * 0.3) + (copyScore * 0.3)).toFixed(1);

            // Ready for publication check
            const ready = overallScore >= 8 && copyScore >= 9;

            // Update display
            document.getElementById('overallScore').textContent = overallScore + '/10';
            document.getElementById('totalIssues').textContent = totalIssues > 0 ? totalIssues : 'N/A';
            document.getElementById('readyStatus').textContent = ready ? '✓ Yes' : '✗ Not Yet';

            // Set message based on score
            let message = '';
            if (overallScore >= 9) {
                message = '🎉 Excellent! Your manuscript is publication-ready with minimal revisions.';
            } else if (overallScore >= 7) {
                message = '👍 Good work! Address the key issues and you\'ll be ready to publish.';
            } else if (overallScore >= 5) {
                message = '⚠️ Needs work. Focus on the top priorities from each analysis.';
            } else {
                message = '📝 Significant revision needed. Review each agent\'s recommendations systematically.';
            }

            document.getElementById('summaryMessage').textContent = message;

        } catch (error) {
            console.error('Error loading summary data:', error);
            // Fallback to checkmarks if fetch fails
            document.getElementById('overallScore').textContent = '✓';
            document.getElementById('totalIssues').textContent = '✓';
            document.getElementById('readyStatus').textContent = '✓';
            document.getElementById('summaryMessage').textContent =
                'Your analysis is complete. Click the buttons below to view the detailed reports.';
        }
    },

    // Load report
    async loadReport() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }
        
        document.getElementById('reportLoading').style.display = 'block';
        document.getElementById('reportContent').style.display = 'none';

        try {
            const response = await fetch(`${this.API_BASE}/report?id=${this.state.reportId}`, { credentials: 'include' });
            
            if (!response.ok) throw new Error('Failed to load report');
            
            const reportHtml = await response.text();
            
            // Extract styles and body content
            const parser = new DOMParser();
            const doc = parser.parseFromString(reportHtml, 'text/html');
            
            // Extract CSS from style tags
            const styles = doc.querySelectorAll('style');
            const styleContent = Array.from(styles).map(s => s.innerHTML).join('\n');
            
            // Create a container with the styles
            const bodyContent = doc.body.innerHTML;
            const styledContent = `<style>${styleContent}</style>${bodyContent}`;
            
            document.getElementById('reportContent').innerHTML = styledContent;

            // Extract and execute scripts
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.innerHTML) {
                    // Create a new script element and execute it
                    const newScript = document.createElement('script');
                    newScript.textContent = script.innerHTML;
                    document.getElementById('reportContent').appendChild(newScript);
                }
            });
            
            document.getElementById('reportLoading').style.display = 'none';
            document.getElementById('reportContent').style.display = 'block';
            
        } catch (error) {
            console.error('Error loading report:', error);
            alert('Failed to load report: ' + error.message);
            this.navigate('summary');
        }
    },

    // Load annotated manuscript
    async loadAnnotated() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }
        
        document.getElementById('annotatedLoading').style.display = 'block';
        document.getElementById('annotatedContent').style.display = 'none';

        try {
            const response = await fetch(`${this.API_BASE}/annotated?id=${this.state.reportId}`, { credentials: 'include' });
            
            if (!response.ok) throw new Error('Failed to load annotated manuscript');
            
            const annotatedHtml = await response.text();
            
            // Extract styles and body content
            const parser = new DOMParser();
            const doc = parser.parseFromString(annotatedHtml, 'text/html');
            
            // Extract CSS from style tags
            const styles = doc.querySelectorAll('style');
            const styleContent = Array.from(styles).map(s => s.innerHTML).join('\n');
            
            // Get body content
            const bodyContent = doc.body.innerHTML;
            
            // Create container with styles
            const styledContent = `<style>${styleContent}</style>${bodyContent}`;
            
            document.getElementById('annotatedContent').innerHTML = styledContent;

            // Extract and execute scripts
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.innerHTML) {
                    // Create a new script element and execute it
                    const newScript = document.createElement('script');
                    newScript.textContent = script.innerHTML;
                    document.getElementById('annotatedContent').appendChild(newScript);
                }
            });
            
            document.getElementById('annotatedLoading').style.display = 'none';
            document.getElementById('annotatedContent').style.display = 'block';
            
        } catch (error) {
            console.error('Error loading annotated manuscript:', error);
            alert('Failed to load annotated manuscript: ' + error.message);
            this.navigate('summary');
        }
    },

    // Download reports
    downloadReports() {
        const report = {
            manuscriptKey: this.state.manuscriptKey,
            timestamp: new Date().toISOString(),
            developmental: this.state.analysisResults.developmental,
            lineEditing: this.state.analysisResults.lineEditing,
            copyEditing: this.state.analysisResults.copyEditing
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manuscript-analysis-${Date.now()}.json`;
        a.click();
    },

    // ASSET GENERATION FUNCTIONS

    // Generate marketing assets
    async generateAssets() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        console.log('Starting asset generation for report:', this.state.reportId);

        // Navigate to asset generation view
        this.navigate('assetGeneration');

        // Reset agent statuses
        this.updateAssetAgentStatus('bookDesc', 'running', 'Running...');
        this.updateAssetAgentStatus('keyword', 'running', 'Running...');
        this.updateAssetAgentStatus('category', 'running', 'Running...');
        this.updateAssetAgentStatus('authorBio', 'running', 'Running...');
        this.updateAssetAgentStatus('backMatter', 'running', 'Running...');
        this.updateAssetAgentStatus('coverDesign', 'running', 'Running...');
        this.updateAssetAgentStatus('seriesDescription', 'running', 'Running...');

        try {
            // Call the generate-assets endpoint
            const response = await fetch(`${this.API_BASE}/generate-assets`, {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    genre: document.getElementById('genre')?.value || 'general'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate assets');
            }

            const result = await response.json();
            console.log('Assets generated:', result);

            // Mark all agents as complete
            this.updateAssetAgentStatus('bookDesc', 'complete', 'Complete');
            this.updateAssetAgentStatus('keyword', 'complete', 'Complete');
            this.updateAssetAgentStatus('category', 'complete', 'Complete');
            this.updateAssetAgentStatus('authorBio', 'complete', 'Complete');
            this.updateAssetAgentStatus('backMatter', 'complete', 'Complete');
            this.updateAssetAgentStatus('coverDesign', 'complete', 'Complete');
            this.updateAssetAgentStatus('seriesDescription', 'complete', 'Complete');

            // Store assets in state
            this.state.generatedAssets = result.assets;

            // Wait a moment then show assets view
            setTimeout(() => {
                this.populateAssetsView(result.assets);
                this.navigate('assets');
            }, 1000);

        } catch (error) {
            console.error('Error generating assets:', error);
            alert('Failed to generate assets: ' + error.message);

            // Mark agents as failed
            this.updateAssetAgentStatus('bookDesc', 'pending', 'Failed');
            this.updateAssetAgentStatus('keyword', 'pending', 'Failed');
            this.updateAssetAgentStatus('category', 'pending', 'Failed');
            this.updateAssetAgentStatus('authorBio', 'pending', 'Failed');
            this.updateAssetAgentStatus('backMatter', 'pending', 'Failed');
            this.updateAssetAgentStatus('coverDesign', 'pending', 'Failed');
            this.updateAssetAgentStatus('seriesDescription', 'pending', 'Failed');

            this.navigate('summary');
        }
    },

    // Update asset agent status
    updateAssetAgentStatus(agent, status, text) {
        const agentCard = document.getElementById(agent + 'Agent');
        const statusSpan = document.getElementById(agent + 'Status');

        if (agentCard && statusSpan) {
            agentCard.className = 'agent-card ' + status;
            statusSpan.className = 'agent-status status-' + status;
            statusSpan.textContent = text;
        }
    },

    // Populate assets view with generated data
    populateAssetsView(assets) {
        console.log('Populating assets view:', assets);

        // Book Description
        const bookDesc = assets.bookDescription;
        if (bookDesc) {
            const textarea = document.getElementById('bookDescription');
            textarea.value = bookDesc.medium;
            this.updateCharCount();

            // Add event listener for character count
            textarea.addEventListener('input', () => this.updateCharCount());

            // Store all versions for switching
            textarea.dataset.short = bookDesc.short;
            textarea.dataset.medium = bookDesc.medium;
            textarea.dataset.long = bookDesc.long;
        }

        // Keywords
        const keywords = assets.keywords;
        if (keywords && keywords.keywords) {
            const keywordsList = document.getElementById('keywordsList');
            keywordsList.innerHTML = keywords.keywords.map((kw, i) => `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-weight: 600; min-width: 30px;">${i + 1}.</span>
                    <input type="text"
                           value="${kw}"
                           maxlength="50"
                           style="flex: 1; padding: 10px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 16px;"
                           onchange="app.validateKeyword(this)" />
                    <span style="font-size: 14px; color: #666; min-width: 60px;">${kw.length}/50</span>
                </div>
            `).join('');
        }

        // Categories
        const categories = assets.categories;
        if (categories) {
            const categoriesList = document.getElementById('categoriesList');

            let html = '';

            if (categories.primary && categories.primary.length > 0) {
                html += '<h4 style="color: #4caf50; margin-top: 20px; margin-bottom: 10px;">Primary Categories</h4>';
                html += categories.primary.map(cat => `
                    <div style="padding: 15px; background: #f0f7f0; border-left: 4px solid #4caf50; margin-bottom: 10px; border-radius: 6px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${cat.code} - ${cat.name}</div>
                        <div style="font-size: 14px; color: #666;">${cat.rationale}</div>
                        <div style="font-size: 13px; color: #888; margin-top: 5px;">
                            Competition: ${cat.competitionLevel} | Potential: ${cat.estimatedRanking}
                        </div>
                    </div>
                `).join('');
            }

            if (categories.secondary && categories.secondary.length > 0) {
                html += '<h4 style="color: #2196f3; margin-top: 20px; margin-bottom: 10px;">Secondary Categories</h4>';
                html += categories.secondary.map(cat => `
                    <div style="padding: 15px; background: #f0f5ff; border-left: 4px solid #2196f3; margin-bottom: 10px; border-radius: 6px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${cat.code} - ${cat.name}</div>
                        <div style="font-size: 14px; color: #666;">${cat.rationale}</div>
                        <div style="font-size: 13px; color: #888; margin-top: 5px;">
                            Competition: ${cat.competitionLevel} | Potential: ${cat.estimatedRanking}
                        </div>
                    </div>
                `).join('');
            }

            if (categories.alternative && categories.alternative.length > 0) {
                html += '<h4 style="color: #ff9800; margin-top: 20px; margin-bottom: 10px;">Alternative Categories</h4>';
                html += categories.alternative.map(cat => `
                    <div style="padding: 15px; background: #fff8f0; border-left: 4px solid #ff9800; margin-bottom: 10px; border-radius: 6px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${cat.code} - ${cat.name}</div>
                        <div style="font-size: 14px; color: #666;">${cat.rationale}</div>
                        <div style="font-size: 13px; color: #888; margin-top: 5px;">
                            Competition: ${cat.competitionLevel} | Potential: ${cat.estimatedRanking}
                        </div>
                    </div>
                `).join('');
            }

            categoriesList.innerHTML = html;
        }

        // Author Bio
        const authorBio = assets.authorBio;
        if (authorBio) {
            const textarea = document.getElementById('authorBio');
            textarea.value = authorBio.medium;
            this.updateBioCharCount();

            // Add event listener for character count
            textarea.addEventListener('input', () => this.updateBioCharCount());

            // Store all versions for switching
            textarea.dataset.short = authorBio.short;
            textarea.dataset.medium = authorBio.medium;
            textarea.dataset.long = authorBio.long;
            textarea.dataset.socialMediaBio = authorBio.socialMediaBio;
        }

        // Back Matter
        const backMatter = assets.backMatter;
        if (backMatter) {
            // Store back matter data for switching formats
            const backMatterPreview = document.getElementById('backMatterPreview');
            backMatterPreview.dataset.plainText = backMatter.formatted.plainText;
            backMatterPreview.dataset.html = backMatter.formatted.html;

            // Display plain text by default
            backMatterPreview.textContent = backMatter.formatted.plainText;

            // Store raw data
            document.getElementById('backMatterRaw').textContent = JSON.stringify(backMatter, null, 2);
        }

        // ============================================================================
        // Cover Design Brief - Using RenderHelpers for clean, maintainable code
        // ============================================================================
        const coverBrief = assets.coverBrief;
        if (coverBrief && window.RenderHelpers) {
            const helpers = window.RenderHelpers;

            // Visual Concept - Shows main imagery, composition, and focal point
            const coverVisualConcept = document.getElementById('coverVisualConcept');
            if (coverVisualConcept && coverBrief.visualConcept) {
                coverVisualConcept.innerHTML = helpers.renderCoverVisualConcept(coverBrief.visualConcept);
            }

            // Color Palette - Primary, secondary, accent colors with hex codes
            const coverColorPalette = document.getElementById('coverColorPalette');
            if (coverColorPalette && coverBrief.colorPalette) {
                coverColorPalette.innerHTML = helpers.renderCoverColorPalette(coverBrief.colorPalette);
            }

            // Typography - Font recommendations for title, author name, etc.
            const coverTypography = document.getElementById('coverTypography');
            if (coverTypography && coverBrief.typography) {
                coverTypography.innerHTML = helpers.renderCoverTypography(coverBrief.typography);
            }

            // AI Art Prompts - Ready-to-use prompts for Midjourney, DALL-E, Stable Diffusion
            const coverAIPrompts = document.getElementById('coverAIPrompts');
            if (coverAIPrompts && coverBrief.aiArtPrompts) {
                coverAIPrompts.innerHTML = helpers.renderCoverAIPrompts(coverBrief.aiArtPrompts);
            }

            // Full Design Brief - Complete specifications for designers
            const coverDesignBriefFull = document.getElementById('coverDesignBriefFull');
            if (coverDesignBriefFull) {
                coverDesignBriefFull.innerHTML = helpers.renderFullCoverBrief(coverBrief);
            }
        }

        // ============================================================================
        // Series Description - Using RenderHelpers for clean, maintainable code
        // ============================================================================
        const seriesDescription = assets.seriesDescription;
        if (seriesDescription && window.RenderHelpers) {
            const helpers = window.RenderHelpers;

            // Series Tagline - One-sentence hook for the entire series
            const seriesTagline = document.getElementById('seriesTagline');
            if (seriesTagline && seriesDescription.seriesTagline) {
                seriesTagline.textContent = seriesDescription.seriesTagline;
            }

            // Series Description (short/long) - Store both versions for switching
            const seriesDescriptionText = document.getElementById('seriesDescriptionText');
            if (seriesDescriptionText) {
                seriesDescriptionText.dataset.short = seriesDescription.shortSeriesDescription || '';
                seriesDescriptionText.dataset.long = seriesDescription.longSeriesDescription || '';

                // Display short version by default
                seriesDescriptionText.textContent = seriesDescription.shortSeriesDescription || 'N/A';
            }

            // Book-by-Book Arc - Shows each book's purpose, cliffhanger, resolution
            const seriesBookArc = document.getElementById('seriesBookArc');
            if (seriesBookArc && seriesDescription.bookByBookArc) {
                seriesBookArc.innerHTML = helpers.renderSeriesBookArc(seriesDescription.bookByBookArc);
            }

            // Complete Series Strategy - Full multi-book planning details
            const seriesStrategyFull = document.getElementById('seriesStrategyFull');
            if (seriesStrategyFull) {
                seriesStrategyFull.innerHTML = helpers.renderSeriesStrategy(seriesDescription);
            }
        }
    },

    // Switch description version
    switchDescriptionVersion() {
        const select = document.getElementById('descriptionVersion');
        const textarea = document.getElementById('bookDescription');
        const version = select.value;

        if (textarea.dataset[version]) {
            textarea.value = textarea.dataset[version];
            this.updateCharCount();
        }
    },

    // Switch bio version
    switchBioVersion() {
        const select = document.getElementById('bioVersion');
        const textarea = document.getElementById('authorBio');
        const version = select.value;

        if (textarea.dataset[version]) {
            textarea.value = textarea.dataset[version];
            this.updateBioCharCount();
        }
    },

    // Switch back matter format
    switchBackMatterFormat() {
        const select = document.getElementById('backMatterFormat');
        const preview = document.getElementById('backMatterPreview');
        const format = select.value;

        if (format === 'plainText' && preview.dataset.plainText) {
            preview.textContent = preview.dataset.plainText;
            preview.style.whiteSpace = 'pre-wrap';
        } else if (format === 'html' && preview.dataset.html) {
            preview.innerHTML = preview.dataset.html;
            preview.style.whiteSpace = 'normal';
        }
    },

    // Switch series description length
    switchSeriesDescLength() {
        const select = document.getElementById('seriesDescLength');
        const descDiv = document.getElementById('seriesDescriptionText');
        const length = select.value;

        if (descDiv.dataset[length]) {
            descDiv.textContent = descDiv.dataset[length];
        }
    },

    // Update character count
    updateCharCount() {
        const textarea = document.getElementById('bookDescription');
        const countSpan = document.getElementById('descCharCount');

        if (textarea && countSpan) {
            const length = textarea.value.length;
            countSpan.textContent = length;

            // Warn if over limit
            if (length > 4000) {
                countSpan.style.color = '#f44336';
                countSpan.style.fontWeight = 'bold';
            } else if (length > 3800) {
                countSpan.style.color = '#ff9800';
                countSpan.style.fontWeight = '600';
            } else {
                countSpan.style.color = '#666';
                countSpan.style.fontWeight = 'normal';
            }
        }
    },

    // Update bio character count
    updateBioCharCount() {
        const textarea = document.getElementById('authorBio');
        const countSpan = document.getElementById('bioCharCount');

        if (textarea && countSpan) {
            const length = textarea.value.length;
            countSpan.textContent = length;
        }
    },

    // Validate keyword length
    validateKeyword(input) {
        const parent = input.parentElement;
        const charCount = parent.querySelector('span:last-child');
        const length = input.value.length;

        charCount.textContent = `${length}/50`;

        if (length > 50) {
            input.value = input.value.substring(0, 50);
            charCount.textContent = '50/50';
            charCount.style.color = '#f44336';
        } else if (length > 45) {
            charCount.style.color = '#ff9800';
        } else {
            charCount.style.color = '#666';
        }
    },

    // Download assets as JSON
    downloadAssets() {
        if (!this.state.generatedAssets) {
            alert('No assets available to download');
            return;
        }

        // Get current values from the UI (in case user edited them)
        const currentAssets = {
            ...this.state.generatedAssets,
            bookDescription: {
                ...this.state.generatedAssets.bookDescription,
                selected: document.getElementById('descriptionVersion').value,
                current: document.getElementById('bookDescription').value
            },
            keywords: {
                ...this.state.generatedAssets.keywords,
                keywords: Array.from(document.querySelectorAll('#keywordsList input')).map(input => input.value)
            },
            authorBio: {
                ...this.state.generatedAssets.authorBio,
                selected: document.getElementById('bioVersion').value,
                current: document.getElementById('authorBio').value
            },
            backMatter: this.state.generatedAssets.backMatter
        };

        const blob = new Blob([JSON.stringify(currentAssets, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marketing-assets-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // Download assets as text files
    downloadAssetsText() {
        if (!this.state.generatedAssets) {
            alert('No assets available to download');
            return;
        }

        // Get current values
        const description = document.getElementById('bookDescription').value;
        const keywords = Array.from(document.querySelectorAll('#keywordsList input')).map(input => input.value);
        const categories = this.state.generatedAssets.categories;

        // Create text content
        let textContent = '=== BOOK DESCRIPTION ===\n\n';
        textContent += description + '\n\n\n';

        textContent += '=== KEYWORDS (7) ===\n\n';
        keywords.forEach((kw, i) => {
            textContent += `${i + 1}. ${kw}\n`;
        });
        textContent += '\n\n';

        textContent += '=== CATEGORIES ===\n\n';
        textContent += 'PRIMARY:\n';
        if (categories.primary) {
            categories.primary.forEach(cat => {
                textContent += `- ${cat.code}: ${cat.name}\n`;
                textContent += `  ${cat.rationale}\n\n`;
            });
        }

        textContent += '\nSECONDARY:\n';
        if (categories.secondary) {
            categories.secondary.forEach(cat => {
                textContent += `- ${cat.code}: ${cat.name}\n`;
                textContent += `  ${cat.rationale}\n\n`;
            });
        }

        if (categories.alternative && categories.alternative.length > 0) {
            textContent += '\nALTERNATIVE:\n';
            categories.alternative.forEach(cat => {
                textContent += `- ${cat.code}: ${cat.name}\n`;
                textContent += `  ${cat.rationale}\n\n`;
            });
        }

        // Author Bio
        textContent += '\n\n=== AUTHOR BIO ===\n\n';
        const authorBio = document.getElementById('authorBio').value;
        textContent += authorBio + '\n';

        // Back Matter
        const backMatter = this.state.generatedAssets.backMatter;
        if (backMatter) {
            textContent += '\n\n=== BACK MATTER (Plain Text) ===\n';
            textContent += backMatter.formatted.plainText;
        }

        // Download
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marketing-assets-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // FORMATTING FUNCTIONS (Phase 4)

    // Navigate to formatting view
    formatManuscript() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        // Pre-fill some default values
        const currentYear = new Date().getFullYear();
        document.getElementById('copyrightYear').value = currentYear;

        this.navigate('formatting');
    },

    // Start formatting process
    async startFormatting() {
        // Validate required fields
        const bookTitle = document.getElementById('bookTitle').value.trim();
        const authorName = document.getElementById('authorName').value.trim();

        if (!bookTitle || !authorName) {
            alert('Please enter book title and author name');
            return;
        }

        // Gather metadata
        const metadata = {
            title: bookTitle,
            author: authorName,
            copyrightYear: parseInt(document.getElementById('copyrightYear').value) || new Date().getFullYear(),
            isbn: document.getElementById('isbn').value.trim() || '',
            publisher: document.getElementById('publisher').value.trim() || '',
            language: document.getElementById('bookLanguage').value || 'en'
        };

        // Get trim size and bleed option
        const trimSize = document.getElementById('trimSize').value || '6x9';
        const includeBleed = document.getElementById('includeBleed').checked;

        console.log('Starting formatting with metadata:', metadata);

        // Navigate to formatting progress view
        this.navigate('formattingProgress');

        // Reset progress
        document.getElementById('formattingProgressBar').style.width = '0%';
        document.getElementById('formattingProgressText').textContent = 'Initializing formatter...';

        // Reset format status cards
        document.getElementById('epubCard').className = 'agent-card';
        document.getElementById('pdfCard').className = 'agent-card';
        document.getElementById('epubStatus').className = 'agent-status status-pending';
        document.getElementById('pdfStatus').className = 'agent-status status-pending';
        document.getElementById('epubStatus').textContent = 'Pending';
        document.getElementById('pdfStatus').textContent = 'Pending';
        document.getElementById('epubDetails').style.display = 'none';
        document.getElementById('pdfDetails').style.display = 'none';

        try {
            // Update progress
            document.getElementById('formattingProgressBar').style.width = '10%';
            document.getElementById('formattingProgressText').textContent = 'Preparing manuscript...';

            // Call the formatting API
            const response = await fetch(`${this.API_BASE}/format-manuscript`, {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    metadata: metadata,
                    trimSize: trimSize,
                    includeBleed: includeBleed
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Formatting failed');
            }

            const result = await response.json();
            console.log('Formatting complete:', result);

            // Update progress to 50%
            document.getElementById('formattingProgressBar').style.width = '50%';
            document.getElementById('formattingProgressText').textContent = 'Generating EPUB...';

            // Update EPUB status
            if (result.formats.epub) {
                document.getElementById('epubCard').className = 'agent-card running';
                document.getElementById('epubStatus').className = 'agent-status status-running';
                document.getElementById('epubStatus').textContent = 'Generating...';

                // Simulate progress
                await new Promise(resolve => setTimeout(resolve, 500));

                document.getElementById('epubCard').className = 'agent-card complete';
                document.getElementById('epubStatus').className = 'agent-status status-complete';
                document.getElementById('epubStatus').textContent = 'Complete';

                const epubInfo = `
                    <strong>✓ EPUB Generated</strong><br>
                    Size: ${result.formats.epub.sizeKB} KB<br>
                    Version: ${result.formats.epub.validation.version}<br>
                    KDP Compliant: ${result.formats.epub.validation.kdpCompliant ? 'Yes' : 'No'}
                `;
                document.getElementById('epubDetails').innerHTML = epubInfo;
                document.getElementById('epubDetails').style.display = 'block';
            }

            // Update progress to 75%
            document.getElementById('formattingProgressBar').style.width = '75%';
            document.getElementById('formattingProgressText').textContent = 'Generating PDF...';

            // Update PDF status
            if (result.formats.pdf) {
                document.getElementById('pdfCard').className = 'agent-card running';
                document.getElementById('pdfStatus').className = 'agent-status status-running';
                document.getElementById('pdfStatus').textContent = 'Generating...';

                // Simulate progress
                await new Promise(resolve => setTimeout(resolve, 500));

                document.getElementById('pdfCard').className = 'agent-card complete';
                document.getElementById('pdfStatus').className = 'agent-status status-complete';
                document.getElementById('pdfStatus').textContent = 'Complete';

                const pdfInfo = `
                    <strong>✓ PDF Generated</strong><br>
                    Size: ${result.formats.pdf.sizeKB} KB<br>
                    Pages: ${result.formats.pdf.pageCount}<br>
                    Trim Size: ${result.formats.pdf.trimSize}<br>
                    KDP Compliant: ${result.formats.pdf.validation.kdpCompliant ? 'Yes' : 'No'}
                `;
                document.getElementById('pdfDetails').innerHTML = pdfInfo;
                document.getElementById('pdfDetails').style.display = 'block';
            }

            // Complete!
            document.getElementById('formattingProgressBar').style.width = '100%';
            document.getElementById('formattingProgressText').textContent = 'Formatting complete! ✓';

            // Store formatting results
            this.state.formattingResults = result;

            // Wait a moment then show completion view
            setTimeout(() => {
                this.showFormattingComplete(result);
            }, 1000);

        } catch (error) {
            console.error('Formatting error:', error);
            alert('Formatting failed: ' + error.message);

            // Mark as failed
            document.getElementById('epubStatus').textContent = 'Failed';
            document.getElementById('pdfStatus').textContent = 'Failed';

            // Go back to formatting form
            setTimeout(() => {
                this.navigate('formatting');
            }, 2000);
        }
    },

    // Show formatting complete view
    showFormattingComplete(result) {
        // Populate file info
        if (result.formats.epub) {
            const epubInfo = `
                <p><strong>Format:</strong> EPUB 3.0</p>
                <p><strong>Size:</strong> ${result.formats.epub.sizeKB} KB</p>
                <p><strong>KDP Compliant:</strong> ✓ Yes</p>
                <p style="margin-top: 10px; color: #4caf50;">
                    <strong>✓ Ready for Kindle publishing</strong>
                </p>
            `;
            document.getElementById('epubFileInfo').innerHTML = epubInfo;
        }

        if (result.formats.pdf) {
            const pdfInfo = `
                <p><strong>Format:</strong> PDF</p>
                <p><strong>Size:</strong> ${result.formats.pdf.sizeKB} KB</p>
                <p><strong>Pages:</strong> ${result.formats.pdf.pageCount}</p>
                <p><strong>Trim Size:</strong> ${result.formats.pdf.trimSize}</p>
                <p><strong>KDP Compliant:</strong> ${result.formats.pdf.validation.kdpCompliant ? '✓ Yes' : '✗ No'}</p>
                ${result.formats.pdf.pageCount < 24 ? '<p style="color: #ff9800; margin-top: 10px;"><strong>⚠ Note:</strong> Amazon KDP requires minimum 24 pages</p>' : '<p style="margin-top: 10px; color: #4caf50;"><strong>✓ Ready for paperback publishing</strong></p>'}
            `;
            document.getElementById('pdfFileInfo').innerHTML = pdfInfo;
        }

        // Navigate to complete view
        this.navigate('formattingComplete');
    },

    // Download formatted file
    async downloadFormatted(format) {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        if (!format || !['epub', 'pdf'].includes(format)) {
            alert('Invalid format specified');
            return;
        }

        console.log(`Downloading ${format.toUpperCase()} file for report:`, this.state.reportId);

        try {
            // Fetch the formatted file
            const response = await fetch(
                `${this.API_BASE}/download-formatted?id=${this.state.reportId}&format=${format}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            // Get the blob
            const blob = await response.blob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `manuscript-${this.state.reportId}.${format}`;
            a.click();
            URL.revokeObjectURL(url);

            console.log(`${format.toUpperCase()} file downloaded successfully`);

        } catch (error) {
            console.error('Download error:', error);
            alert(`Failed to download ${format.toUpperCase()}: ` + error.message);
        }
    },

    // ====================
    // MARKET ANALYSIS (Phase 2)
    // ====================

    // Start market analysis
    async startMarketAnalysis() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        console.log('Starting market analysis for report:', this.state.reportId);

        // Navigate to progress view
        this.navigate('marketAnalysisProgress');

        // Update progress
        document.getElementById('marketAnalysisProgressBar').style.width = '10%';
        document.getElementById('marketAnalysisProgressText').textContent = 'Initializing market analysis...';

        try {
            // Call market analysis API
            const response = await fetch(`${this.API_BASE}/analyze-market`, {
                credentials: 'include',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    metadata: {
                        isSeries: false,
                        authorPlatform: 'New author',
                        previousBooks: 0
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Market analysis failed');
            }

            const result = await response.json();
            console.log('Market analysis initiated:', result);

            // Simulate progress for each component
            const components = [
                { id: 'genreAnalysis', name: 'Genre & Positioning', progress: 20 },
                { id: 'pricingAnalysis', name: 'Pricing Strategy', progress: 35 },
                { id: 'categoryAnalysis', name: 'Categories', progress: 50 },
                { id: 'keywordAnalysis', name: 'Keywords', progress: 65 },
                { id: 'audienceAnalysis', name: 'Target Audience', progress: 80 },
                { id: 'positioningAnalysis', name: 'Competitive Positioning', progress: 95 }
            ];

            for (const component of components) {
                document.getElementById(`${component.id}Status`).textContent = 'Running';
                document.getElementById(`${component.id}Status`).className = 'agent-status status-running';
                document.getElementById(`${component.id}Card`).className = 'agent-card running';
                document.getElementById('marketAnalysisProgressBar').style.width = `${component.progress}%`;
                document.getElementById('marketAnalysisProgressText').textContent = `Analyzing ${component.name}...`;

                await new Promise(resolve => setTimeout(resolve, 500));

                document.getElementById(`${component.id}Status`).textContent = 'Complete';
                document.getElementById(`${component.id}Status`).className = 'agent-status status-complete';
                document.getElementById(`${component.id}Card`).className = 'agent-card complete';
            }

            // Set progress to 100%
            document.getElementById('marketAnalysisProgressBar').style.width = '100%';
            document.getElementById('marketAnalysisProgressText').textContent = 'Market analysis complete!';

            // Wait a moment, then fetch and display results
            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.loadMarketAnalysisResults();

        } catch (error) {
            console.error('Market analysis error:', error);
            alert('Market analysis failed: ' + error.message);
            this.navigate('assets');
        }
    },

    // Load and display market analysis results
    async loadMarketAnalysisResults() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        console.log('Loading market analysis results...');

        try {
            // Fetch market analysis results
            const response = await fetch(
                `${this.API_BASE}/market-analysis?reportId=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load market analysis');
            }

            const data = await response.json();
            console.log('Market analysis results:', data);

            // Store in state
            this.state.marketAnalysis = data;

            // Display results
            this.displayMarketAnalysisResults(data);

            // Navigate to results view
            this.navigate('marketAnalysisResults');

        } catch (error) {
            console.error('Error loading market analysis:', error);
            alert('Failed to load market analysis results: ' + error.message);
            this.navigate('assets');
        }
    },

    // Display market analysis results
    displayMarketAnalysisResults(data) {
        const { report, analysis } = data;

        // Display summary cards
        const summaryCards = document.getElementById('marketSummaryCards');
        summaryCards.innerHTML = `
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">📚</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${report.summary.primaryGenre}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Primary Genre</div>
            </div>
            <div style="background: #fff8e1; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">💰</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #ffa726;">$${report.summary.recommendedEbookPrice}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Ebook Price</div>
            </div>
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">📄</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #4caf50;">$${report.summary.recommendedPaperbackPrice}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Paperback Price</div>
            </div>
            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">👥</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #9c27b0;">${report.summary.targetDemographic}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Target Age</div>
            </div>
        `;

        // Display detailed analysis
        const details = document.getElementById('marketAnalysisDetails');
        let detailsHtml = '';

        // Genre Analysis
        if (analysis.genreAnalysis) {
            const genre = analysis.genreAnalysis;
            detailsHtml += `
                <div style="background: #f8f9ff; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #667eea; margin-bottom: 20px;">🎯 Genre & Market Position</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>Primary Genre:</strong> ${genre.primaryGenre}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Sub-genres:</strong> ${genre.subGenres.join(', ')}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Market Position:</strong> ${genre.marketPosition}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Market Size:</strong> ${genre.marketSize} | <strong>Competition:</strong> ${genre.competition}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Tone:</strong> ${genre.tone} | <strong>Pacing:</strong> ${genre.pacing}
                    </div>
                    ${genre.comparableTitles && genre.comparableTitles.length > 0 ? `
                        <div>
                            <strong>Comparable Titles:</strong>
                            <ul style="margin-top: 10px; padding-left: 20px;">
                                ${genre.comparableTitles.slice(0, 5).map(title => `<li>${title}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Pricing Strategy
        if (analysis.pricingStrategy) {
            const pricing = analysis.pricingStrategy;
            detailsHtml += `
                <div style="background: #fff8e1; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #ffa726; margin-bottom: 20px;">💰 Pricing Strategy</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <h4 style="margin-bottom: 10px;">Ebook Pricing</h4>
                            <div style="font-size: 2em; font-weight: bold; color: #ffa726;">$${pricing.ebook.recommended}</div>
                            <div style="margin-top: 10px; color: #666;">
                                Range: $${pricing.ebook.range.min} - $${pricing.ebook.range.max}
                            </div>
                            <div style="margin-top: 10px; font-size: 0.9em;">
                                ${pricing.ebook.reasoning}
                            </div>
                        </div>
                        <div>
                            <h4 style="margin-bottom: 10px;">Paperback Pricing</h4>
                            <div style="font-size: 2em; font-weight: bold; color: #ffa726;">$${pricing.paperback.recommended}</div>
                            <div style="margin-top: 10px; color: #666;">
                                Range: $${pricing.paperback.range.min} - $${pricing.paperback.range.max}
                            </div>
                            <div style="margin-top: 10px; font-size: 0.9em;">
                                ${pricing.paperback.reasoning}
                            </div>
                        </div>
                    </div>
                    ${pricing.launchStrategy ? `
                        <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
                            <strong>Launch Strategy:</strong> Start at $${pricing.launchStrategy.initialPrice} for ${pricing.launchStrategy.duration}, then $${pricing.launchStrategy.normalPrice}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Categories
        if (analysis.categoryRecommendations && analysis.categoryRecommendations.primary) {
            const categories = analysis.categoryRecommendations;
            detailsHtml += `
                <div style="background: #e8f5e9; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #4caf50; margin-bottom: 20px;">📁 Recommended Categories</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>Top Categories:</strong>
                    </div>
                    ${categories.primary.slice(0, 5).map((cat, i) => `
                        <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #4caf50;">${i + 1}. ${cat.name}</div>
                            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                                BISAC: ${cat.bisac} | Competition: ${cat.competitiveness}
                            </div>
                            <div style="font-size: 0.85em; margin-top: 5px;">${cat.reasoning}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Keywords
        if (analysis.keywordStrategy && analysis.keywordStrategy.keywords) {
            const keywords = analysis.keywordStrategy;
            detailsHtml += `
                <div style="background: #f3e5f5; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #9c27b0; margin-bottom: 20px;">🔍 Keyword Strategy</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>7 Recommended Keywords:</strong>
                    </div>
                    ${keywords.keywords.slice(0, 7).map((kw, i) => `
                        <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #9c27b0;">${i + 1}. "${kw.phrase}"</div>
                            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                                Search Volume: ${kw.searchVolume} | Competition: ${kw.competition} | Relevance: ${kw.relevance}
                            </div>
                            <div style="font-size: 0.85em; margin-top: 5px;">${kw.reasoning}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Target Audience
        if (analysis.audienceProfile && analysis.audienceProfile.primaryAudience) {
            const audience = analysis.audienceProfile;
            detailsHtml += `
                <div style="background: #e1f5fe; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #0288d1; margin-bottom: 20px;">👥 Target Audience</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>Primary Audience:</strong>
                    </div>
                    <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 15px;">
                        <div><strong>Age Range:</strong> ${audience.primaryAudience.ageRange}</div>
                        <div style="margin-top: 10px;"><strong>Gender:</strong> ${audience.primaryAudience.gender}</div>
                        <div style="margin-top: 10px;"><strong>Demographics:</strong> ${audience.primaryAudience.demographics}</div>
                        <div style="margin-top: 10px;"><strong>Reading Habits:</strong> ${audience.primaryAudience.readingHabits}</div>
                    </div>
                    ${audience.readerMotivations && audience.readerMotivations.length > 0 ? `
                        <div style="margin-top: 15px;">
                            <strong>Reader Motivations:</strong>
                            <ul style="margin-top: 10px; padding-left: 20px;">
                                ${audience.readerMotivations.map(m => `<li>${m}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Competitive Positioning
        if (analysis.competitivePositioning) {
            const positioning = analysis.competitivePositioning;
            detailsHtml += `
                <div style="background: #fce4ec; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #c2185b; margin-bottom: 20px;">🎯 Competitive Positioning</h3>
                    <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 15px;">
                        <div style="font-weight: bold; color: #c2185b; margin-bottom: 10px;">Positioning Statement:</div>
                        <div style="font-size: 1.1em;">"${positioning.positioningStatement}"</div>
                    </div>
                    ${positioning.marketGap ? `
                        <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 15px;">
                            <div style="font-weight: bold; margin-bottom: 10px;">Market Gap:</div>
                            <div>${positioning.marketGap.description}</div>
                        </div>
                    ` : ''}
                    ${positioning.launchStrategy ? `
                        <div style="padding: 15px; background: white; border-radius: 8px;">
                            <div style="font-weight: bold; margin-bottom: 10px;">Launch Strategy:</div>
                            <div><strong>Approach:</strong> ${positioning.launchStrategy.approach}</div>
                            <div style="margin-top: 10px;">${positioning.launchStrategy.reasoning}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        details.innerHTML = detailsHtml;
    },

    // Download market analysis
    async downloadMarketAnalysis() {
        if (!this.state.marketAnalysis) {
            alert('No market analysis data available');
            return;
        }

        const dataStr = JSON.stringify(this.state.marketAnalysis, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `market-analysis-${this.state.reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ====================
    // SOCIAL MEDIA MARKETING (Phase 5)
    // ====================

    // Start social media marketing generation
    async startSocialMediaGeneration() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        console.log('Starting social media marketing generation for report:', this.state.reportId);

        // Navigate to progress view
        this.navigate('socialMediaProgress');

        // Reset progress
        document.getElementById('socialMediaProgressBar').style.width = '0%';
        document.getElementById('socialMediaProgressText').textContent = 'Initializing marketing kit generation...';

        // Reset all agent cards
        const agentIds = ['socialPosts', 'emails', 'calendar', 'trailer', 'magnets'];
        agentIds.forEach(id => {
            document.getElementById(`${id}Card`).className = 'agent-card';
            document.getElementById(`${id}Status`).className = 'agent-status status-pending';
            document.getElementById(`${id}Status`).textContent = 'Pending';
        });

        try {
            // Update progress
            document.getElementById('socialMediaProgressBar').style.width = '10%';
            document.getElementById('socialMediaProgressText').textContent = 'Generating marketing materials...';

            // Call the API
            const response = await fetch(`${this.API_BASE}/generate-social-media`, {
                credentials: 'include',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    metadata: {
                        title: 'Your Book',
                        author: 'Author Name'
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Social media generation failed');
            }

            const result = await response.json();
            console.log('Social media generation initiated:', result);

            // Simulate progress for each component (5 agents running in parallel)
            const components = [
                { id: 'socialPosts', name: 'Social Media Posts', progress: 20 },
                { id: 'emails', name: 'Launch Emails', progress: 40 },
                { id: 'calendar', name: 'Content Calendar', progress: 60 },
                { id: 'trailer', name: 'Book Trailer Script', progress: 80 },
                { id: 'magnets', name: 'Reader Magnets', progress: 95 }
            ];

            for (const component of components) {
                document.getElementById(`${component.id}Status`).textContent = 'Running';
                document.getElementById(`${component.id}Status`).className = 'agent-status status-running';
                document.getElementById(`${component.id}Card`).className = 'agent-card running';
                document.getElementById('socialMediaProgressBar').style.width = `${component.progress}%`;
                document.getElementById('socialMediaProgressText').textContent = `Generating ${component.name}...`;

                await new Promise(resolve => setTimeout(resolve, 800));

                document.getElementById(`${component.id}Status`).textContent = 'Complete';
                document.getElementById(`${component.id}Status`).className = 'agent-status status-complete';
                document.getElementById(`${component.id}Card`).className = 'agent-card complete';
            }

            // Set progress to 100%
            document.getElementById('socialMediaProgressBar').style.width = '100%';
            document.getElementById('socialMediaProgressText').textContent = 'Marketing kit complete!';

            // Wait a moment, then load and display results
            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.loadSocialMediaResults();

        } catch (error) {
            console.error('Social media generation error:', error);
            alert('Marketing kit generation failed: ' + error.message);

            // Mark agents as failed
            agentIds.forEach(id => {
                document.getElementById(`${id}Status`).textContent = 'Failed';
                document.getElementById(`${id}Status`).className = 'agent-status status-pending';
            });

            this.navigate('assets');
        }
    },

    // Load and display social media marketing results
    async loadSocialMediaResults() {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        console.log('Loading social media marketing results...');

        try {
            // Fetch social media results
            const response = await fetch(
                `${this.API_BASE}/social-media?reportId=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load social media marketing');
            }

            const data = await response.json();
            console.log('Social media marketing results:', data);

            // Store in state
            this.state.socialMedia = data;

            // Display results
            this.displaySocialMediaResults(data);

            // Navigate to results view
            this.navigate('socialMediaResults');

        } catch (error) {
            console.error('Error loading social media marketing:', error);
            alert('Failed to load marketing kit: ' + error.message);
            this.navigate('assets');
        }
    },

    // Display social media marketing results
    displaySocialMediaResults(data) {
        const { marketingPackage } = data;

        // Display summary cards
        const summaryCards = document.getElementById('socialMediaSummaryCards');

        const totalPosts = this.countSocialMediaPosts(marketingPackage.socialMediaPosts);
        const emailCount = Object.keys(marketingPackage.launchEmails || {}).length;
        const calendarDays = marketingPackage.contentCalendar?.calendar?.length || 30;
        const trailerDuration = marketingPackage.bookTrailerScript?.duration || '60 seconds';
        const magnetIdeas = this.countReaderMagnetIdeas(marketingPackage.readerMagnets);

        summaryCards.innerHTML = `
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">📱</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${totalPosts}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Social Posts</div>
            </div>
            <div style="background: #fff8e1; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">📧</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #ffa726;">${emailCount}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Email Templates</div>
            </div>
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">📅</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #4caf50;">${calendarDays}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Days Planned</div>
            </div>
            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">🎬</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #9c27b0;">${trailerDuration}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Trailer Script</div>
            </div>
            <div style="background: #fce4ec; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">🎁</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #c2185b;">${magnetIdeas}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Magnet Ideas</div>
            </div>
        `;

        // Display detailed results
        const details = document.getElementById('socialMediaDetails');
        let detailsHtml = '';

        // Social Media Posts
        if (marketingPackage.socialMediaPosts) {
            const posts = marketingPackage.socialMediaPosts;
            detailsHtml += `
                <div style="background: #f8f9ff; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #667eea; margin-bottom: 20px;">📱 Social Media Posts</h3>
                    ${this.renderSocialPosts(posts)}
                </div>
            `;
        }

        // Launch Emails
        if (marketingPackage.launchEmails) {
            const emails = marketingPackage.launchEmails;
            detailsHtml += `
                <div style="background: #fff8e1; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #ffa726; margin-bottom: 20px;">📧 Launch Email Templates</h3>
                    ${this.renderLaunchEmails(emails)}
                </div>
            `;
        }

        // Content Calendar
        if (marketingPackage.contentCalendar) {
            const calendar = marketingPackage.contentCalendar;
            detailsHtml += `
                <div style="background: #e8f5e9; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #4caf50; margin-bottom: 20px;">📅 30-Day Content Calendar</h3>
                    ${this.renderContentCalendar(calendar)}
                </div>
            `;
        }

        // Book Trailer Script
        if (marketingPackage.bookTrailerScript) {
            const trailer = marketingPackage.bookTrailerScript;
            detailsHtml += `
                <div style="background: #f3e5f5; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #9c27b0; margin-bottom: 20px;">🎬 Book Trailer Script (${trailer.duration})</h3>
                    ${this.renderBookTrailer(trailer)}
                </div>
            `;
        }

        // Reader Magnets
        if (marketingPackage.readerMagnets) {
            const magnets = marketingPackage.readerMagnets;
            detailsHtml += `
                <div style="background: #fce4ec; padding: 25px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="color: #c2185b; margin-bottom: 20px;">🎁 Reader Magnet Ideas</h3>
                    ${this.renderReaderMagnets(magnets)}
                </div>
            `;
        }

        details.innerHTML = detailsHtml;
    },

    // Helper: Count social media posts
    countSocialMediaPosts(posts) {
        let count = 0;
        for (const platform in posts) {
            if (Array.isArray(posts[platform])) {
                count += posts[platform].length;
            }
        }
        return count;
    },

    // Helper: Count reader magnet ideas
    countReaderMagnetIdeas(magnets) {
        let count = 0;
        for (const category in magnets) {
            if (Array.isArray(magnets[category])) {
                count += magnets[category].length;
            } else if (typeof magnets[category] === 'object') {
                count += 1;
            }
        }
        return count;
    },

    // Helper: Render social media posts
    renderSocialPosts(posts) {
        let html = '';

        if (posts.twitter && posts.twitter.length > 0) {
            html += '<h4 style="color: #1da1f2; margin-top: 20px;">Twitter/X</h4>';
            posts.twitter.forEach(post => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0; border-left: 4px solid #1da1f2;">
                        <div style="margin-bottom: 10px;"><strong>${post.type || 'Post'}</strong> (${post.timing || 'Launch day'})</div>
                        <div style="font-size: 1.1em; margin-bottom: 10px;">${post.content}</div>
                        ${post.hashtags ? `<div style="color: #1da1f2; font-size: 0.9em;">${post.hashtags.map(h => '#' + h).join(' ')}</div>` : ''}
                        ${post.engagement_tip ? `<div style="margin-top: 10px; font-size: 0.85em; color: #666;"><strong>Tip:</strong> ${post.engagement_tip}</div>` : ''}
                        <button onclick="navigator.clipboard.writeText('${post.content.replace(/'/g, "\\'")}'); alert('Copied to clipboard!')"
                                style="margin-top: 10px; padding: 5px 15px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📋 Copy
                        </button>
                    </div>
                `;
            });
        }

        if (posts.facebook && posts.facebook.length > 0) {
            html += '<h4 style="color: #4267B2; margin-top: 20px;">Facebook</h4>';
            posts.facebook.forEach(post => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0; border-left: 4px solid #4267B2;">
                        <div style="margin-bottom: 10px;"><strong>${post.type || 'Post'}</strong> (${post.timing || 'Launch day'})</div>
                        <div style="font-size: 1.1em; margin-bottom: 10px; white-space: pre-wrap;">${post.content}</div>
                        ${post.cta ? `<div style="margin-top: 10px; padding: 10px; background: #f0f2f5; border-radius: 4px;"><strong>CTA:</strong> ${post.cta}</div>` : ''}
                        <button onclick="navigator.clipboard.writeText(\`${post.content.replace(/`/g, '\\`')}\`); alert('Copied to clipboard!')"
                                style="margin-top: 10px; padding: 5px 15px; background: #4267B2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📋 Copy
                        </button>
                    </div>
                `;
            });
        }

        if (posts.instagram && posts.instagram.length > 0) {
            html += '<h4 style="color: #E1306C; margin-top: 20px;">Instagram</h4>';
            posts.instagram.forEach(post => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0; border-left: 4px solid #E1306C;">
                        <div style="margin-bottom: 10px;"><strong>${post.type || 'Post'}</strong> (${post.timing || 'Launch day'})</div>
                        ${post.imageIdea ? `<div style="padding: 10px; background: #fce4ec; border-radius: 4px; margin-bottom: 10px;"><strong>Image Idea:</strong> ${post.imageIdea}</div>` : ''}
                        <div style="font-size: 1.1em; margin-bottom: 10px; white-space: pre-wrap;">${post.caption}</div>
                        ${post.hashtags ? `<div style="color: #E1306C; font-size: 0.9em;">${post.hashtags.map(h => '#' + h).join(' ')}</div>` : ''}
                        <button onclick="navigator.clipboard.writeText(\`${post.caption.replace(/`/g, '\\`')}\`); alert('Copied to clipboard!')"
                                style="margin-top: 10px; padding: 5px 15px; background: #E1306C; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📋 Copy
                        </button>
                    </div>
                `;
            });
        }

        if (posts.tiktok && posts.tiktok.length > 0) {
            html += '<h4 style="color: #000000; margin-top: 20px;">TikTok</h4>';
            posts.tiktok.forEach(post => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0; border-left: 4px solid #000000;">
                        <div style="margin-bottom: 10px;"><strong>${post.type || 'Video'}</strong> (${post.timing || 'Launch day'})</div>
                        <div style="font-size: 1.1em; margin-bottom: 10px; white-space: pre-wrap;"><strong>Script:</strong><br>${post.script}</div>
                        ${post.visualCues ? `<div style="padding: 10px; background: #f5f5f5; border-radius: 4px; margin: 10px 0;"><strong>Visual Cues:</strong> ${post.visualCues}</div>` : ''}
                        ${post.soundSuggestion ? `<div style="font-size: 0.9em; color: #666;"><strong>Sound:</strong> ${post.soundSuggestion}</div>` : ''}
                        <button onclick="navigator.clipboard.writeText(\`${post.script.replace(/`/g, '\\`')}\`); alert('Copied to clipboard!')"
                                style="margin-top: 10px; padding: 5px 15px; background: #000000; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📋 Copy
                        </button>
                    </div>
                `;
            });
        }

        return html || '<p>No social media posts generated.</p>';
    },

    // Helper: Render launch emails
    renderLaunchEmails(emails) {
        let html = '';

        for (const emailType in emails) {
            const email = emails[emailType];
            const titles = {
                preLaunchTeaser: 'Pre-Launch Teaser',
                launchAnnouncement: 'Launch Day Announcement',
                postLaunchThankYou: 'Post-Launch Thank You',
                newsletterSignup: 'Newsletter Welcome'
            };

            html += `
                <div style="padding: 20px; background: white; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #ffa726; margin-bottom: 15px;">${titles[emailType] || emailType}</h4>
                    ${email.subjectLines ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Subject Line Options:</strong>
                            <ul style="margin-top: 5px; padding-left: 20px;">
                                ${email.subjectLines.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${email.subject ? `<div style="margin-bottom: 10px;"><strong>Subject:</strong> ${email.subject}</div>` : ''}
                    ${email.preheader ? `<div style="margin-bottom: 15px; font-style: italic; color: #666;"><strong>Preview:</strong> ${email.preheader}</div>` : ''}
                    ${email.bodyPlainText ? `
                        <div style="padding: 15px; background: #f5f5f5; border-radius: 4px; margin: 10px 0; white-space: pre-wrap; font-family: monospace;">
                            ${email.bodyPlainText}
                        </div>
                    ` : ''}
                    ${email.body ? `
                        <div style="padding: 15px; background: #f5f5f5; border-radius: 4px; margin: 10px 0; white-space: pre-wrap;">
                            ${email.body}
                        </div>
                    ` : ''}
                    ${email.cta ? `
                        <div style="margin-top: 15px; padding: 15px; background: #fff8e1; border-radius: 4px;">
                            <strong>Call to Action:</strong> ${email.cta.text}
                        </div>
                    ` : ''}
                    ${email.timing ? `<div style="margin-top: 10px; font-size: 0.9em; color: #666;"><strong>Timing:</strong> ${email.timing}</div>` : ''}
                    ${email.incentive ? `<div style="margin-top: 10px;"><strong>Incentive:</strong> ${email.incentive}</div>` : ''}
                    <button onclick="navigator.clipboard.writeText(\`${(email.bodyPlainText || email.body || '').replace(/`/g, '\\`')}\`); alert('Copied to clipboard!')"
                            style="margin-top: 10px; padding: 5px 15px; background: #ffa726; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📋 Copy Email
                    </button>
                </div>
            `;
        }

        return html || '<p>No email templates generated.</p>';
    },

    // Helper: Render content calendar
    renderContentCalendar(calendar) {
        let html = '';

        if (calendar.overview) {
            html += `
                <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 15px;">
                    <h4>Overview</h4>
                    <p><strong>Total Posts:</strong> ${calendar.overview.totalPosts || 'N/A'}</p>
                    <p><strong>Platforms:</strong> ${(calendar.overview.platforms || []).join(', ')}</p>
                    <p><strong>Strategy:</strong> ${calendar.overview.strategy || 'Build anticipation, launch, maintain momentum'}</p>
                </div>
            `;
        }

        if (calendar.calendar && calendar.calendar.length > 0) {
            html += '<h4 style="margin-top: 20px;">Daily Schedule</h4>';
            calendar.calendar.slice(0, 10).forEach(day => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0; border-left: 4px solid #4caf50;">
                        <div style="font-weight: bold; color: #4caf50;">Day ${day.day} (${day.date || 'relative to launch'})</div>
                        <div style="margin-top: 10px;"><strong>Platform:</strong> ${day.platform}</div>
                        <div><strong>Content Type:</strong> ${day.contentType}</div>
                        <div style="margin-top: 10px;">${day.postIdea}</div>
                        ${day.hashtags ? `<div style="margin-top: 5px; color: #4caf50; font-size: 0.9em;">${day.hashtags.join(' ')}</div>` : ''}
                        ${day.timing ? `<div style="font-size: 0.85em; color: #666; margin-top: 5px;"><strong>Best time:</strong> ${day.timing}</div>` : ''}
                    </div>
                `;
            });

            if (calendar.calendar.length > 10) {
                html += `<p style="text-align: center; color: #666; margin-top: 15px;">... and ${calendar.calendar.length - 10} more days</p>`;
            }
        }

        return html || '<p>No content calendar generated.</p>';
    },

    // Helper: Render book trailer
    renderBookTrailer(trailer) {
        let html = '';

        if (trailer.script && trailer.script.length > 0) {
            html += '<h4>Script Timeline</h4>';
            trailer.script.forEach(scene => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
                        <div style="font-weight: bold; color: #9c27b0;">${scene.timestamp}</div>
                        ${scene.narration ? `<div style="margin-top: 10px;"><strong>Narration:</strong> "${scene.narration}"</div>` : ''}
                        ${scene.visual ? `<div style="margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 4px;"><strong>Visual:</strong> ${scene.visual}</div>` : ''}
                        ${scene.text_overlay ? `<div style="margin-top: 5px;"><strong>Text Overlay:</strong> "${scene.text_overlay}"</div>` : ''}
                        ${scene.music ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;"><strong>Music:</strong> ${scene.music}</div>` : ''}
                    </div>
                `;
            });
        }

        if (trailer.callToAction) {
            html += `
                <div style="padding: 15px; background: #f3e5f5; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #9c27b0;">Call to Action</h4>
                    <div style="margin-top: 10px;"><strong>${trailer.callToAction.text}</strong></div>
                    ${trailer.callToAction.visual ? `<div style="margin-top: 5px; color: #666;">${trailer.callToAction.visual}</div>` : ''}
                </div>
            `;
        }

        if (trailer.productionTips) {
            html += `
                <div style="padding: 15px; background: white; border-radius: 8px; margin: 15px 0;">
                    <h4>Production Tips</h4>
                    <p><strong>Budget:</strong> ${trailer.productionTips.budget || 'Flexible'}</p>
                    <p><strong>DIY Feasibility:</strong> ${trailer.productionTips.diyFeasibility || 'Depends on resources'}</p>
                    ${trailer.productionTips.estimatedCost ? `<p><strong>Estimated Cost:</strong> ${trailer.productionTips.estimatedCost}</p>` : ''}
                    ${trailer.productionTips.toolsNeeded ? `<p><strong>Tools:</strong> ${trailer.productionTips.toolsNeeded.join(', ')}</p>` : ''}
                </div>
            `;
        }

        return html || '<p>No book trailer script generated.</p>';
    },

    // Helper: Render reader magnets
    renderReaderMagnets(magnets) {
        let html = '';

        if (magnets.bonusContent && magnets.bonusContent.length > 0) {
            html += '<h4 style="margin-top: 20px;">Bonus Content Ideas</h4>';
            magnets.bonusContent.forEach(item => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
                        <div style="font-weight: bold; color: #c2185b;">${item.title || item.type}</div>
                        <div style="margin-top: 10px;">${item.description}</div>
                        ${item.format ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;"><strong>Format:</strong> ${item.format}</div>` : ''}
                        ${item.creationEffort ? `<div style="font-size: 0.9em; color: #666;"><strong>Effort:</strong> ${item.creationEffort}</div>` : ''}
                    </div>
                `;
            });
        }

        if (magnets.arcProgram) {
            const arc = magnets.arcProgram;
            html += `
                <h4 style="margin-top: 20px;">ARC (Advance Reader Copy) Program</h4>
                <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
                    <p><strong>Concept:</strong> ${arc.concept || 'Build early buzz with advance readers'}</p>
                    <p style="margin-top: 10px;"><strong>Benefits:</strong> ${arc.benefits}</p>
                    <p style="margin-top: 10px;"><strong>Requirements:</strong> ${arc.requirements}</p>
                    ${arc.platform ? `<p style="margin-top: 10px;"><strong>Platform:</strong> ${arc.platform}</p>` : ''}
                    ${arc.timeline ? `<p style="margin-top: 10px;"><strong>Timeline:</strong> ${arc.timeline}</p>` : ''}
                </div>
            `;
        }

        if (magnets.contestIdeas && magnets.contestIdeas.length > 0) {
            html += '<h4 style="margin-top: 20px;">Contest Ideas</h4>';
            magnets.contestIdeas.forEach(contest => {
                html += `
                    <div style="padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
                        <div style="font-weight: bold; color: #c2185b;">${contest.type}</div>
                        <div style="margin-top: 10px;"><strong>Entry Method:</strong> ${contest.entryMethod}</div>
                        <div style="margin-top: 5px;"><strong>Prize:</strong> ${contest.prize}</div>
                        ${contest.duration ? `<div style="margin-top: 5px;"><strong>Duration:</strong> ${contest.duration}</div>` : ''}
                        ${contest.viralPotential ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;"><strong>Viral Potential:</strong> ${contest.viralPotential}</div>` : ''}
                    </div>
                `;
            });
        }

        return html || '<p>No reader magnet ideas generated.</p>';
    },

    // Download social media marketing kit
    async downloadSocialMedia() {
        if (!this.state.socialMedia) {
            alert('No social media marketing data available');
            return;
        }

        const dataStr = JSON.stringify(this.state.socialMedia, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marketing-kit-${this.state.reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============================================================================
    // PHASE 2: MARKET ANALYSIS
    // ============================================================================

    /**
     * Load Market Analysis View
     * Checks if analysis already exists and displays appropriate UI state
     */
    loadMarketAnalysisView() {
        console.log('Loading market analysis view...');

        if (!this.state.reportId) {
            alert('No report ID available. Please complete manuscript analysis first.');
            this.navigate('library');
            return;
        }

        const marketStart = document.getElementById('marketStart');
        const marketLoading = document.getElementById('marketLoading');
        const marketContent = document.getElementById('marketContent');

        // Check if we already have market analysis data
        if (this.state.marketAnalysis && this.state.marketAnalysis.status === 'complete') {
            // Already have data, display it
            marketStart.style.display = 'none';
            marketLoading.style.display = 'none';
            marketContent.style.display = 'block';
            this.displayMarketAnalysis(this.state.marketAnalysis);
        } else {
            // Try to fetch existing market analysis
            this.fetchMarketAnalysis();
        }
    },

    /**
     * Fetch existing market analysis data
     */
    async fetchMarketAnalysis() {
        console.log('Fetching market analysis for reportId:', this.state.reportId);

        try {
            const response = await fetch(
                `${this.API_BASE}/market-analysis?id=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Market analysis data:', data);

                if (data.analysis && data.analysis.status === 'complete') {
                    // We have complete market analysis
                    this.state.marketAnalysis = data.analysis;
                    this.displayMarketAnalysis(data.analysis);
                } else if (data.analysis && data.analysis.status === 'processing') {
                    // Analysis is in progress
                    document.getElementById('marketStart').style.display = 'none';
                    document.getElementById('marketLoading').style.display = 'block';
                    document.getElementById('marketContent').style.display = 'none';
                    this.pollMarketAnalysis();
                } else {
                    // No analysis found, show start button
                    document.getElementById('marketStart').style.display = 'block';
                    document.getElementById('marketLoading').style.display = 'none';
                    document.getElementById('marketContent').style.display = 'none';
                }
            } else {
                // No analysis found, show start button
                document.getElementById('marketStart').style.display = 'block';
                document.getElementById('marketLoading').style.display = 'none';
                document.getElementById('marketContent').style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching market analysis:', error);
            document.getElementById('marketStart').style.display = 'block';
            document.getElementById('marketLoading').style.display = 'none';
            document.getElementById('marketContent').style.display = 'none';
        }
    },

    /**
     * Start Market Analysis
     * Triggers the market analysis job and starts polling for completion
     */
    async startMarketAnalysis() {
        console.log('Starting market analysis for reportId:', this.state.reportId);

        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        try {
            // Show loading state
            document.getElementById('marketStart').style.display = 'none';
            document.getElementById('marketLoading').style.display = 'block';
            document.getElementById('marketContent').style.display = 'none';

            // Trigger market analysis
            const response = await fetch(`${this.API_BASE}/analyze-market`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start market analysis');
            }

            const result = await response.json();
            console.log('Market analysis started:', result);

            // Start polling for completion
            await this.pollMarketAnalysis();

        } catch (error) {
            console.error('Error starting market analysis:', error);
            alert('Failed to start market analysis: ' + error.message);

            // Reset UI
            document.getElementById('marketStart').style.display = 'block';
            document.getElementById('marketLoading').style.display = 'none';
            document.getElementById('marketContent').style.display = 'none';
        }
    },

    /**
     * Poll Market Analysis Status
     * Periodically checks if market analysis is complete
     */
    async pollMarketAnalysis() {
        console.log('Polling market analysis status...');

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/market-analysis?id=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    console.error('Failed to fetch market analysis status');
                    clearInterval(pollInterval);
                    document.getElementById('marketLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Analysis Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                Market analysis encountered an error. Please try again.
                            </p>
                            <button class="btn" onclick="app.navigate('market')">Try Again</button>
                        </div>
                    `;
                    return;
                }

                const data = await response.json();
                console.log('Market analysis poll result:', data);

                if (data.analysis && data.analysis.status === 'complete') {
                    // Analysis complete!
                    clearInterval(pollInterval);
                    this.state.marketAnalysis = data.analysis;

                    // Hide loading, show content
                    document.getElementById('marketLoading').style.display = 'none';
                    document.getElementById('marketContent').style.display = 'block';

                    // Display the results
                    this.displayMarketAnalysis(data.analysis);
                } else if (data.analysis && data.analysis.status === 'failed') {
                    // Analysis failed
                    clearInterval(pollInterval);
                    document.getElementById('marketLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Analysis Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                ${data.analysis.error || 'Market analysis encountered an error.'}
                            </p>
                            <button class="btn" onclick="app.navigate('market')">Try Again</button>
                        </div>
                    `;
                }
                // If status is still 'processing', keep polling
            } catch (error) {
                console.error('Error polling market analysis:', error);
                clearInterval(pollInterval);
            }
        }, 5000); // Poll every 5 seconds
    },

    /**
     * Display Market Analysis Results
     * Renders the market analysis data in a formatted view
     */
    displayMarketAnalysis(analysis) {
        console.log('Displaying market analysis:', analysis);

        const contentDiv = document.getElementById('marketContent');

        if (!analysis || !analysis.data) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">No Analysis Data</h3>
                    <p style="color: #999;">Market analysis data is not available.</p>
                </div>
            `;
            return;
        }

        const data = analysis.data;

        // Build HTML for market analysis results
        let html = `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">📊 Market Overview</h3>
                <div style="background: #f8f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    ${data.market_overview ? `<p style="line-height: 1.6; color: #333;">${data.market_overview}</p>` : '<p style="color: #999;">No market overview available</p>'}
                </div>
            </div>
        `;

        // Genre Positioning
        if (data.genre_positioning) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">🎯 Genre Positioning</h3>
                    <div style="background: #f8f9ff; border-radius: 8px; padding: 20px;">
                        ${data.genre_positioning}
                    </div>
                </div>
            `;
        }

        // Comparable Titles
        if (data.comparable_titles && data.comparable_titles.length > 0) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">📚 Comparable Titles</h3>
            `;

            data.comparable_titles.forEach((book, index) => {
                html += `
                    <div style="background: white; border-left: 4px solid #4caf50; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <h4 style="color: #333; margin-bottom: 10px;">${index + 1}. ${book.title || 'Unknown Title'}</h4>
                        ${book.author ? `<p style="color: #666; margin-bottom: 10px;"><strong>Author:</strong> ${book.author}</p>` : ''}
                        ${book.year ? `<p style="color: #666; margin-bottom: 10px;"><strong>Published:</strong> ${book.year}</p>` : ''}
                        ${book.reason ? `<p style="color: #666; line-height: 1.6;"><strong>Why it's comparable:</strong> ${book.reason}</p>` : ''}
                    </div>
                `;
            });

            html += `</div>`;
        }

        // Target Audience
        if (data.target_audience) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">👥 Target Audience</h3>
                    <div style="background: #f8f9ff; border-radius: 8px; padding: 20px;">
                        ${data.target_audience}
                    </div>
                </div>
            `;
        }

        // Market Opportunities
        if (data.market_opportunities) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">💡 Market Opportunities</h3>
                    <div style="background: #e8f5e9; border-radius: 8px; padding: 20px;">
                        ${data.market_opportunities}
                    </div>
                </div>
            `;
        }

        // Competitive Analysis
        if (data.competitive_analysis) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">⚔️ Competitive Analysis</h3>
                    <div style="background: #fff8e1; border-radius: 8px; padding: 20px;">
                        ${data.competitive_analysis}
                    </div>
                </div>
            `;
        }

        // Pricing Recommendations
        if (data.pricing_recommendations) {
            html += `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">💰 Pricing Recommendations</h3>
                    <div style="background: #f3e5f5; border-radius: 8px; padding: 20px;">
                        ${data.pricing_recommendations}
                    </div>
                </div>
            `;
        }

        // Add download button
        html += `
            <div style="text-align: center; margin-top: 40px;">
                <button class="btn" onclick="app.downloadMarketAnalysis()">
                    📥 Download Market Analysis (JSON)
                </button>
            </div>
        `;

        contentDiv.innerHTML = html;
    },

    /**
     * Download Market Analysis as JSON
     */
    downloadMarketAnalysis() {
        if (!this.state.marketAnalysis) {
            alert('No market analysis data available');
            return;
        }

        const dataStr = JSON.stringify(this.state.marketAnalysis, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `market-analysis-${this.state.reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============================================================================
    // PHASE 3: MARKETING ASSETS
    // ============================================================================

    /**
     * Load Marketing Assets View
     * Checks if assets already exist and displays appropriate UI state
     */
    loadAssetsView() {
        console.log('Loading marketing assets view...');

        if (!this.state.reportId) {
            alert('No report ID available. Please complete manuscript analysis first.');
            this.navigate('library');
            return;
        }

        const assetsStart = document.getElementById('assetsStart');
        const assetsLoading = document.getElementById('assetsLoading');
        const assetsContent = document.getElementById('assetsContent');

        // Check if we already have assets data
        if (this.state.assetResults && Object.keys(this.state.assetResults).some(key => this.state.assetResults[key])) {
            // Already have data, display it
            assetsStart.style.display = 'none';
            assetsLoading.style.display = 'none';
            assetsContent.style.display = 'block';
            this.displayAssets(this.state.assetResults);
        } else {
            // Try to fetch existing assets
            this.fetchAssets();
        }
    },

    /**
     * Fetch existing marketing assets data
     */
    async fetchAssets() {
        console.log('Fetching marketing assets for reportId:', this.state.reportId);

        try {
            const response = await fetch(
                `${this.API_BASE}/assets?id=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Marketing assets data:', data);

                if (data.assets && Object.keys(data.assets).length > 0) {
                    // We have assets
                    this.state.assetResults = data.assets;
                    document.getElementById('assetsStart').style.display = 'none';
                    document.getElementById('assetsLoading').style.display = 'none';
                    document.getElementById('assetsContent').style.display = 'block';
                    this.displayAssets(data.assets);
                } else if (data.status === 'processing') {
                    // Assets are being generated
                    document.getElementById('assetsStart').style.display = 'none';
                    document.getElementById('assetsLoading').style.display = 'block';
                    document.getElementById('assetsContent').style.display = 'none';
                    this.pollAssetGeneration();
                } else {
                    // No assets found, show start button
                    document.getElementById('assetsStart').style.display = 'block';
                    document.getElementById('assetsLoading').style.display = 'none';
                    document.getElementById('assetsContent').style.display = 'none';
                }
            } else {
                // No assets found, show start button
                document.getElementById('assetsStart').style.display = 'block';
                document.getElementById('assetsLoading').style.display = 'none';
                document.getElementById('assetsContent').style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching marketing assets:', error);
            document.getElementById('assetsStart').style.display = 'block';
            document.getElementById('assetsLoading').style.display = 'none';
            document.getElementById('assetsContent').style.display = 'none';
        }
    },

    /**
     * Start Marketing Assets Generation
     * Triggers the asset generation job and starts polling for completion
     */
    async startAssetGeneration() {
        console.log('Starting marketing asset generation for reportId:', this.state.reportId);

        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        try {
            // Show loading state
            document.getElementById('assetsStart').style.display = 'none';
            document.getElementById('assetsLoading').style.display = 'block';
            document.getElementById('assetsContent').style.display = 'none';

            // Trigger asset generation
            const response = await fetch(`${this.API_BASE}/generate-assets`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start asset generation');
            }

            const result = await response.json();
            console.log('Asset generation started:', result);

            // Start polling for completion
            await this.pollAssetGeneration();

        } catch (error) {
            console.error('Error starting asset generation:', error);
            alert('Failed to start asset generation: ' + error.message);

            // Reset UI
            document.getElementById('assetsStart').style.display = 'block';
            document.getElementById('assetsLoading').style.display = 'none';
            document.getElementById('assetsContent').style.display = 'none';
        }
    },

    /**
     * Poll Asset Generation Status
     * Periodically checks if asset generation is complete
     */
    async pollAssetGeneration() {
        console.log('Polling asset generation status...');

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/assets/status?id=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    console.error('Failed to fetch asset generation status');
                    clearInterval(pollInterval);
                    document.getElementById('assetsLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Generation Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                Asset generation encountered an error. Please try again.
                            </p>
                            <button class="btn" onclick="app.navigate('assets')">Try Again</button>
                        </div>
                    `;
                    return;
                }

                const data = await response.json();
                console.log('Asset generation poll result:', data);

                if (data.status === 'complete' && data.assets) {
                    // Generation complete!
                    clearInterval(pollInterval);
                    this.state.assetResults = data.assets;

                    // Hide loading, show content
                    document.getElementById('assetsLoading').style.display = 'none';
                    document.getElementById('assetsContent').style.display = 'block';

                    // Display the results
                    this.displayAssets(data.assets);
                } else if (data.status === 'failed') {
                    // Generation failed
                    clearInterval(pollInterval);
                    document.getElementById('assetsLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Generation Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                ${data.error || 'Asset generation encountered an error.'}
                            </p>
                            <button class="btn" onclick="app.navigate('assets')">Try Again</button>
                        </div>
                    `;
                }
                // If status is still 'processing', keep polling
            } catch (error) {
                console.error('Error polling asset generation:', error);
                clearInterval(pollInterval);
            }
        }, 5000); // Poll every 5 seconds
    },

    /**
     * Display Marketing Assets Results
     * Renders the marketing assets in a formatted view
     */
    displayAssets(assets) {
        console.log('Displaying marketing assets:', assets);

        const contentDiv = document.getElementById('assetsContent');

        if (!assets || Object.keys(assets).length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">No Assets Data</h3>
                    <p style="color: #999;">Marketing assets data is not available.</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; gap: 25px;">';

        // Book Description
        if (assets.bookDescription) {
            html += this.renderAssetCard(
                '📖 Book Description',
                assets.bookDescription,
                'A compelling book description optimized for retailer platforms like Amazon.',
                '#667eea'
            );
        }

        // Keywords
        if (assets.keywords) {
            const keywordsList = Array.isArray(assets.keywords)
                ? assets.keywords.join(', ')
                : assets.keywords;
            html += this.renderAssetCard(
                '🔑 Keywords',
                keywordsList,
                'Search keywords to improve discoverability on book retail platforms.',
                '#4caf50'
            );
        }

        // Categories
        if (assets.categories) {
            const categoriesList = Array.isArray(assets.categories)
                ? assets.categories.join(', ')
                : assets.categories;
            html += this.renderAssetCard(
                '📚 Categories',
                categoriesList,
                'Amazon and retail platform categories for optimal placement.',
                '#ffa726'
            );
        }

        // Author Bio
        if (assets.authorBio) {
            html += this.renderAssetCard(
                '✍️ Author Bio',
                assets.authorBio,
                'Professional author biography for your book\'s back matter and author page.',
                '#9c27b0'
            );
        }

        // Back Matter
        if (assets.backMatter) {
            html += this.renderAssetCard(
                '📄 Back Matter',
                assets.backMatter,
                'Additional content to include at the end of your book (author note, acknowledgments, etc.).',
                '#00bcd4'
            );
        }

        // Cover Design Brief
        if (assets.coverBrief) {
            html += this.renderAssetCard(
                '🎨 Cover Design Brief',
                assets.coverBrief,
                'Detailed specifications for your cover designer based on genre conventions.',
                '#f44336'
            );
        }

        // Series Description
        if (assets.seriesDescription) {
            html += this.renderAssetCard(
                '📚 Series Description',
                assets.seriesDescription,
                'Series overview for positioning this book within a larger series.',
                '#795548'
            );
        }

        // Show errors if any
        if (assets.errors && Object.keys(assets.errors).length > 0) {
            html += `
                <div style="background: #ffebee; border-left: 4px solid #f44336; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #d32f2f; margin-bottom: 15px;">⚠️ Generation Errors</h3>
                    <p style="color: #666; margin-bottom: 10px;">Some assets could not be generated:</p>
                    <ul style="margin-left: 20px; color: #666;">
            `;
            Object.entries(assets.errors).forEach(([key, error]) => {
                html += `<li><strong>${key}:</strong> ${error}</li>`;
            });
            html += `
                    </ul>
                </div>
            `;
        }

        html += '</div>';

        // Add action buttons
        html += `
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 40px; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="app.downloadAssets()">
                    📥 Download All Assets (JSON)
                </button>
                <button class="btn btn-secondary" onclick="app.copyAllAssets()">
                    📋 Copy All to Clipboard
                </button>
                <button class="btn" onclick="app.navigate('formatting')">
                    📚 Continue to Formatting →
                </button>
            </div>
        `;

        contentDiv.innerHTML = html;
    },

    /**
     * Helper function to render individual asset cards
     */
    renderAssetCard(title, content, description, color) {
        return `
            <div style="background: white; border-left: 4px solid ${color}; border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <h3 style="color: ${color}; margin: 0;">${title}</h3>
                    <button
                        onclick="app.copyAsset(this, '${title.replace(/'/g, "\\'")}', '${this.escapeForJS(content)}')"
                        style="background: ${color}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: opacity 0.2s;"
                        onmouseover="this.style.opacity='0.8'"
                        onmouseout="this.style.opacity='1'"
                    >
                        📋 Copy
                    </button>
                </div>
                <p style="color: #999; font-size: 0.9em; margin-bottom: 15px; font-style: italic;">
                    ${description}
                </p>
                <div style="background: #f8f9fa; border-radius: 6px; padding: 15px; line-height: 1.6; color: #333; white-space: pre-wrap; word-wrap: break-word;">
${content}
                </div>
            </div>
        `;
    },

    /**
     * Escape content for use in JavaScript strings
     */
    escapeForJS(str) {
        if (!str) return '';
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    },

    /**
     * Copy individual asset to clipboard
     */
    async copyAsset(button, title, content) {
        try {
            // Decode escaped content
            const decodedContent = content
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, '\\');

            await navigator.clipboard.writeText(decodedContent);

            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.style.background = '#4caf50';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            alert('Failed to copy to clipboard. Please try again.');
        }
    },

    /**
     * Copy all assets to clipboard as formatted text
     */
    async copyAllAssets() {
        if (!this.state.assetResults) {
            alert('No assets to copy');
            return;
        }

        try {
            let text = '=== MARKETING ASSETS ===\n\n';

            const sections = [
                { key: 'bookDescription', title: 'BOOK DESCRIPTION' },
                { key: 'keywords', title: 'KEYWORDS' },
                { key: 'categories', title: 'CATEGORIES' },
                { key: 'authorBio', title: 'AUTHOR BIO' },
                { key: 'backMatter', title: 'BACK MATTER' },
                { key: 'coverBrief', title: 'COVER DESIGN BRIEF' },
                { key: 'seriesDescription', title: 'SERIES DESCRIPTION' }
            ];

            sections.forEach(section => {
                if (this.state.assetResults[section.key]) {
                    const content = Array.isArray(this.state.assetResults[section.key])
                        ? this.state.assetResults[section.key].join(', ')
                        : this.state.assetResults[section.key];
                    text += `${section.title}\n${'='.repeat(section.title.length)}\n${content}\n\n`;
                }
            });

            await navigator.clipboard.writeText(text);
            alert('All assets copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy all assets:', error);
            alert('Failed to copy to clipboard. Please try again.');
        }
    },

    /**
     * Download Marketing Assets as JSON
     */
    downloadAssets() {
        if (!this.state.assetResults) {
            alert('No assets data available');
            return;
        }

        const dataStr = JSON.stringify(this.state.assetResults, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marketing-assets-${this.state.reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============================================================================
    // PHASE 4: MANUSCRIPT FORMATTING
    // ============================================================================

    /**
     * Load Formatting View
     * Checks if formatted files already exist and displays appropriate UI state
     */
    loadFormattingView() {
        console.log('Loading formatting view...');

        if (!this.state.reportId) {
            alert('No report ID available. Please complete manuscript analysis first.');
            this.navigate('library');
            return;
        }

        const formattingStart = document.getElementById('formattingStart');
        const formattingLoading = document.getElementById('formattingLoading');
        const formattingContent = document.getElementById('formattingContent');

        // Check if we already have formatting state
        if (this.state.formattedFiles && (this.state.formattedFiles.epub || this.state.formattedFiles.pdf)) {
            // Already have formatted files, display them
            formattingStart.style.display = 'none';
            formattingLoading.style.display = 'none';
            formattingContent.style.display = 'block';
            this.displayFormattedFiles(this.state.formattedFiles);
        } else {
            // Try to fetch existing formatted files
            this.fetchFormattedFiles();
        }
    },

    /**
     * Fetch existing formatted files
     */
    async fetchFormattedFiles() {
        console.log('Fetching formatted files for reportId:', this.state.reportId);

        try {
            const response = await fetch(
                `${this.API_BASE}/download-formatted?id=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Formatted files data:', data);

                if (data.files && (data.files.epub || data.files.pdf)) {
                    // We have formatted files
                    this.state.formattedFiles = data.files;
                    document.getElementById('formattingStart').style.display = 'none';
                    document.getElementById('formattingLoading').style.display = 'none';
                    document.getElementById('formattingContent').style.display = 'block';
                    this.displayFormattedFiles(data.files);
                } else if (data.status === 'processing') {
                    // Formatting is in progress
                    document.getElementById('formattingStart').style.display = 'none';
                    document.getElementById('formattingLoading').style.display = 'block';
                    document.getElementById('formattingContent').style.display = 'none';
                    this.pollFormatting();
                } else {
                    // No formatted files found, show start button
                    document.getElementById('formattingStart').style.display = 'block';
                    document.getElementById('formattingLoading').style.display = 'none';
                    document.getElementById('formattingContent').style.display = 'none';
                }
            } else {
                // No formatted files found, show start button
                document.getElementById('formattingStart').style.display = 'block';
                document.getElementById('formattingLoading').style.display = 'none';
                document.getElementById('formattingContent').style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching formatted files:', error);
            document.getElementById('formattingStart').style.display = 'block';
            document.getElementById('formattingLoading').style.display = 'none';
            document.getElementById('formattingContent').style.display = 'none';
        }
    },

    /**
     * Start Manuscript Formatting
     * Triggers the formatting job to generate EPUB and PDF
     */
    async startFormatting() {
        console.log('Starting manuscript formatting for reportId:', this.state.reportId);

        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        try {
            // Show loading state
            document.getElementById('formattingStart').style.display = 'none';
            document.getElementById('formattingLoading').style.display = 'block';
            document.getElementById('formattingContent').style.display = 'none';

            // Trigger formatting
            const response = await fetch(`${this.API_BASE}/format-manuscript`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    formats: ['epub', 'pdf'] // Request both formats
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start formatting');
            }

            const result = await response.json();
            console.log('Formatting started:', result);

            // Start polling for completion
            await this.pollFormatting();

        } catch (error) {
            console.error('Error starting formatting:', error);
            alert('Failed to start formatting: ' + error.message);

            // Reset UI
            document.getElementById('formattingStart').style.display = 'block';
            document.getElementById('formattingLoading').style.display = 'none';
            document.getElementById('formattingContent').style.display = 'none';
        }
    },

    /**
     * Poll Formatting Status
     * Periodically checks if formatting is complete
     */
    async pollFormatting() {
        console.log('Polling formatting status...');

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/download-formatted?id=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    console.error('Failed to fetch formatting status');
                    clearInterval(pollInterval);
                    document.getElementById('formattingLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Formatting Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                Manuscript formatting encountered an error. Please try again.
                            </p>
                            <button class="btn" onclick="app.navigate('formatting')">Try Again</button>
                        </div>
                    `;
                    return;
                }

                const data = await response.json();
                console.log('Formatting poll result:', data);

                if (data.status === 'complete' && data.files) {
                    // Formatting complete!
                    clearInterval(pollInterval);
                    this.state.formattedFiles = data.files;

                    // Hide loading, show content
                    document.getElementById('formattingLoading').style.display = 'none';
                    document.getElementById('formattingContent').style.display = 'block';

                    // Display the results
                    this.displayFormattedFiles(data.files);
                } else if (data.status === 'failed') {
                    // Formatting failed
                    clearInterval(pollInterval);
                    document.getElementById('formattingLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Formatting Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                ${data.error || 'Manuscript formatting encountered an error.'}
                            </p>
                            <button class="btn" onclick="app.navigate('formatting')">Try Again</button>
                        </div>
                    `;
                }
                // If status is still 'processing', keep polling
            } catch (error) {
                console.error('Error polling formatting:', error);
                clearInterval(pollInterval);
            }
        }, 5000); // Poll every 5 seconds
    },

    /**
     * Display Formatted Files
     * Shows download links for EPUB and PDF files
     */
    displayFormattedFiles(files) {
        console.log('Displaying formatted files:', files);

        const contentDiv = document.getElementById('formattingContent');

        if (!files || (!files.epub && !files.pdf)) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">No Formatted Files</h3>
                    <p style="color: #999;">Formatted files are not available.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <div style="font-size: 3em; margin-bottom: 15px;">✅</div>
                <h2 style="margin-bottom: 15px;">Formatting Complete!</h2>
                <p style="font-size: 1.1em; opacity: 0.9;">
                    Your manuscript has been professionally formatted for publishing.
                </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 40px;">
        `;

        // EPUB Card
        if (files.epub) {
            html += `
                <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">📕</div>
                    <h3 style="color: #667eea; margin-bottom: 10px;">EPUB Format</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                        Standard ebook format for Amazon Kindle, Apple Books, Google Play Books, and most e-readers.
                    </p>
                    <div style="background: #f8f9ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">File Size</div>
                        <div style="color: #333; font-weight: 600;">${files.epub.size ? this.formatFileSize(files.epub.size) : 'N/A'}</div>
                    </div>
                    <button
                        class="btn"
                        onclick="app.downloadFormattedFile('epub', '${files.epub.url || ''}')"
                        style="width: 100%; margin: 5px 0;"
                    >
                        📥 Download EPUB
                    </button>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                        <div style="color: #999; font-size: 0.85em; margin-bottom: 8px;">Best for:</div>
                        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                            <span style="background: #e8f5e9; color: #4caf50; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Amazon KDP</span>
                            <span style="background: #e3f2fd; color: #2196f3; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Apple Books</span>
                            <span style="background: #fce4ec; color: #e91e63; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Google Play</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // PDF Card
        if (files.pdf) {
            html += `
                <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">📄</div>
                    <h3 style="color: #f44336; margin-bottom: 10px;">PDF Format</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                        Professional print-ready PDF for paperback publishing, direct sales, and premium distribution.
                    </p>
                    <div style="background: #fff8f8; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">File Size</div>
                        <div style="color: #333; font-weight: 600;">${files.pdf.size ? this.formatFileSize(files.pdf.size) : 'N/A'}</div>
                    </div>
                    <button
                        class="btn"
                        onclick="app.downloadFormattedFile('pdf', '${files.pdf.url || ''}')"
                        style="width: 100%; margin: 5px 0; background: #f44336;"
                    >
                        📥 Download PDF
                    </button>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                        <div style="color: #999; font-size: 0.85em; margin-bottom: 8px;">Best for:</div>
                        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                            <span style="background: #fff3e0; color: #ff9800; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Print Books</span>
                            <span style="background: #f3e5f5; color: #9c27b0; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Direct Sales</span>
                            <span style="background: #e0f2f1; color: #009688; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Archive</span>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        // Publishing Platform Guide
        html += `
            <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                <h3 style="color: #333; margin-bottom: 20px;">📚 Publishing Platform Guide</h3>
                <div style="display: grid; gap: 20px;">
                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #4caf50;">
                        <h4 style="color: #4caf50; margin-bottom: 10px;">Amazon Kindle Direct Publishing (KDP)</h4>
                        <p style="color: #666; margin-bottom: 10px; line-height: 1.6;">
                            <strong>For Ebook:</strong> Upload your EPUB file to KDP. Amazon will automatically convert it to their Kindle format (AZW3).
                        </p>
                        <p style="color: #666; line-height: 1.6;">
                            <strong>For Paperback:</strong> Upload your PDF file to KDP Print. Ensure it meets their trim size requirements.
                        </p>
                        <a href="https://kdp.amazon.com" target="_blank" style="color: #4caf50; text-decoration: none; font-weight: 600; margin-top: 10px; display: inline-block;">
                            → Go to Amazon KDP
                        </a>
                    </div>

                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #2196f3;">
                        <h4 style="color: #2196f3; margin-bottom: 10px;">Apple Books</h4>
                        <p style="color: #666; margin-bottom: 10px; line-height: 1.6;">
                            Upload your EPUB file to Apple Books Connect. The EPUB format is natively supported.
                        </p>
                        <a href="https://books.apple.com/us/publisher" target="_blank" style="color: #2196f3; text-decoration: none; font-weight: 600; margin-top: 10px; display: inline-block;">
                            → Go to Apple Books Connect
                        </a>
                    </div>

                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #ff9800;">
                        <h4 style="color: #ff9800; margin-bottom: 10px;">IngramSpark (Wide Distribution)</h4>
                        <p style="color: #666; margin-bottom: 10px; line-height: 1.6;">
                            Upload EPUB for ebook distribution and PDF for print-on-demand. IngramSpark distributes to over 40,000 retailers worldwide.
                        </p>
                        <a href="https://www.ingramspark.com" target="_blank" style="color: #ff9800; text-decoration: none; font-weight: 600; margin-top: 10px; display: inline-block;">
                            → Go to IngramSpark
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Action buttons
        html += `
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="app.navigate('social')">
                    📱 Continue to Social Media Content →
                </button>
                <button class="btn" onclick="app.navigate('summary')">
                    ← Back to Summary
                </button>
            </div>
        `;

        contentDiv.innerHTML = html;
    },

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (!bytes) return 'N/A';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * Download formatted file
     */
    async downloadFormattedFile(format, url) {
        console.log('Downloading formatted file:', format, url);

        if (!url) {
            alert('Download URL not available');
            return;
        }

        try {
            // If it's a full URL, use it directly
            if (url.startsWith('http')) {
                window.open(url, '_blank');
            } else {
                // Otherwise, construct the URL with API base
                const downloadUrl = `${this.API_BASE}${url}`;
                window.open(downloadUrl, '_blank');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download file. Please try again.');
        }
    },

    // ============================================================================
    // PHASE 5: SOCIAL MEDIA CONTENT
    // ============================================================================

    /**
     * Load Social Media View
     * Checks if social media content already exists and displays appropriate UI state
     */
    loadSocialView() {
        console.log('Loading social media view...');

        if (!this.state.reportId) {
            alert('No report ID available. Please complete manuscript analysis first.');
            this.navigate('library');
            return;
        }

        const socialStart = document.getElementById('socialStart');
        const socialLoading = document.getElementById('socialLoading');
        const socialContent = document.getElementById('socialContent');

        // Check if we already have social media data
        if (this.state.socialMedia && Object.keys(this.state.socialMedia).length > 0) {
            // Already have data, display it
            socialStart.style.display = 'none';
            socialLoading.style.display = 'none';
            socialContent.style.display = 'block';
            this.displaySocialMedia(this.state.socialMedia);
        } else {
            // Try to fetch existing social media content
            this.fetchSocialMedia();
        }
    },

    /**
     * Fetch existing social media content
     */
    async fetchSocialMedia() {
        console.log('Fetching social media content for reportId:', this.state.reportId);

        try {
            const response = await fetch(
                `${this.API_BASE}/social-media?id=${this.state.reportId}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Social media data:', data);

                if (data.socialMedia && Object.keys(data.socialMedia).length > 0) {
                    // We have social media content
                    this.state.socialMedia = data.socialMedia;
                    document.getElementById('socialStart').style.display = 'none';
                    document.getElementById('socialLoading').style.display = 'none';
                    document.getElementById('socialContent').style.display = 'block';
                    this.displaySocialMedia(data.socialMedia);
                } else if (data.status === 'processing') {
                    // Content is being generated
                    document.getElementById('socialStart').style.display = 'none';
                    document.getElementById('socialLoading').style.display = 'block';
                    document.getElementById('socialContent').style.display = 'none';
                    this.pollSocialMedia();
                } else {
                    // No content found, show start button
                    document.getElementById('socialStart').style.display = 'block';
                    document.getElementById('socialLoading').style.display = 'none';
                    document.getElementById('socialContent').style.display = 'none';
                }
            } else {
                // No content found, show start button
                document.getElementById('socialStart').style.display = 'block';
                document.getElementById('socialLoading').style.display = 'none';
                document.getElementById('socialContent').style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching social media content:', error);
            document.getElementById('socialStart').style.display = 'block';
            document.getElementById('socialLoading').style.display = 'none';
            document.getElementById('socialContent').style.display = 'none';
        }
    },

    /**
     * Start Social Media Content Generation
     * Triggers the generation job for all social platforms
     */
    async startSocialMedia() {
        console.log('Starting social media content generation for reportId:', this.state.reportId);

        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        try {
            // Show loading state
            document.getElementById('socialStart').style.display = 'none';
            document.getElementById('socialLoading').style.display = 'block';
            document.getElementById('socialContent').style.display = 'none';

            // Trigger social media generation
            const response = await fetch(`${this.API_BASE}/generate-social-media`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start social media generation');
            }

            const result = await response.json();
            console.log('Social media generation started:', result);

            // Start polling for completion
            await this.pollSocialMedia();

        } catch (error) {
            console.error('Error starting social media generation:', error);
            alert('Failed to start social media generation: ' + error.message);

            // Reset UI
            document.getElementById('socialStart').style.display = 'block';
            document.getElementById('socialLoading').style.display = 'none';
            document.getElementById('socialContent').style.display = 'none';
        }
    },

    /**
     * Poll Social Media Generation Status
     * Periodically checks if generation is complete
     */
    async pollSocialMedia() {
        console.log('Polling social media generation status...');

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/social-media?id=${this.state.reportId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    console.error('Failed to fetch social media status');
                    clearInterval(pollInterval);
                    document.getElementById('socialLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Generation Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                Social media content generation encountered an error. Please try again.
                            </p>
                            <button class="btn" onclick="app.navigate('social')">Try Again</button>
                        </div>
                    `;
                    return;
                }

                const data = await response.json();
                console.log('Social media poll result:', data);

                if (data.status === 'complete' && data.socialMedia) {
                    // Generation complete!
                    clearInterval(pollInterval);
                    this.state.socialMedia = data.socialMedia;

                    // Hide loading, show content
                    document.getElementById('socialLoading').style.display = 'none';
                    document.getElementById('socialContent').style.display = 'block';

                    // Display the results
                    this.displaySocialMedia(data.socialMedia);
                } else if (data.status === 'failed') {
                    // Generation failed
                    clearInterval(pollInterval);
                    document.getElementById('socialLoading').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                            <h3 style="color: #f44336; margin-bottom: 15px;">Generation Failed</h3>
                            <p style="color: #666; margin-bottom: 30px;">
                                ${data.error || 'Social media content generation encountered an error.'}
                            </p>
                            <button class="btn" onclick="app.navigate('social')">Try Again</button>
                        </div>
                    `;
                }
                // If status is still 'processing', keep polling
            } catch (error) {
                console.error('Error polling social media generation:', error);
                clearInterval(pollInterval);
            }
        }, 5000); // Poll every 5 seconds
    },

    /**
     * Display Social Media Content
     * Renders platform-specific social media posts
     */
    displaySocialMedia(socialMedia) {
        console.log('Displaying social media content:', socialMedia);

        const contentDiv = document.getElementById('socialContent');

        if (!socialMedia || Object.keys(socialMedia).length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">No Social Media Content</h3>
                    <p style="color: #999;">Social media content is not available.</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; gap: 25px;">';

        // Platform configurations with icons and colors
        const platforms = [
            { key: 'twitter', name: 'Twitter / X', icon: '𝕏', color: '#1DA1F2', charLimit: '280 characters' },
            { key: 'facebook', name: 'Facebook', icon: '📘', color: '#1877F2', charLimit: '63,206 characters' },
            { key: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F', charLimit: '2,200 characters' },
            { key: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0A66C2', charLimit: '3,000 characters' },
            { key: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000', charLimit: '2,200 characters' }
        ];

        platforms.forEach(platform => {
            if (socialMedia[platform.key]) {
                const content = socialMedia[platform.key];
                html += this.renderSocialCard(
                    platform.icon,
                    platform.name,
                    content,
                    platform.color,
                    platform.charLimit
                );
            }
        });

        html += '</div>';

        // Tips Section
        html += `
            <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-top: 30px;">
                <h3 style="color: #333; margin-bottom: 20px;">💡 Social Media Marketing Tips</h3>
                <div style="display: grid; gap: 15px;">
                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #1DA1F2;">
                        <h4 style="color: #1DA1F2; margin-bottom: 10px;">Best Posting Times</h4>
                        <ul style="color: #666; line-height: 1.8; margin-left: 20px;">
                            <li><strong>Twitter/X:</strong> Wednesday & Friday, 9 AM - 3 PM</li>
                            <li><strong>Facebook:</strong> Tuesday, Wednesday & Friday, 9 AM - 1 PM</li>
                            <li><strong>Instagram:</strong> Monday, Tuesday & Friday, 11 AM - 2 PM</li>
                            <li><strong>LinkedIn:</strong> Tuesday - Thursday, 9 AM - 12 PM</li>
                            <li><strong>TikTok:</strong> Tuesday, Thursday & Friday, 6 PM - 10 PM</li>
                        </ul>
                    </div>

                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #4caf50;">
                        <h4 style="color: #4caf50; margin-bottom: 10px;">Engagement Strategies</h4>
                        <ul style="color: #666; line-height: 1.8; margin-left: 20px;">
                            <li>Use 3-5 relevant hashtags on Twitter and Instagram</li>
                            <li>Include a compelling call-to-action in every post</li>
                            <li>Respond to comments within the first hour</li>
                            <li>Share behind-the-scenes content about your writing process</li>
                            <li>Cross-post content but customize for each platform</li>
                        </ul>
                    </div>

                    <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #ff9800;">
                        <h4 style="color: #ff9800; margin-bottom: 10px;">Content Variety</h4>
                        <ul style="color: #666; line-height: 1.8; margin-left: 20px;">
                            <li>Mix promotional posts with value-added content (80/20 rule)</li>
                            <li>Share reader testimonials and reviews</li>
                            <li>Create character spotlights and world-building posts</li>
                            <li>Post writing tips related to your book's theme</li>
                            <li>Run polls and ask questions to boost engagement</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        // Action buttons
        html += `
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 40px; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="app.downloadSocialMedia()">
                    📥 Download All Posts (JSON)
                </button>
                <button class="btn btn-secondary" onclick="app.copyAllSocialMedia()">
                    📋 Copy All to Clipboard
                </button>
                <button class="btn" onclick="app.navigate('summary')">
                    ← Back to Summary
                </button>
            </div>
        `;

        contentDiv.innerHTML = html;
    },

    /**
     * Render individual social media platform card
     */
    renderSocialCard(icon, platformName, content, color, charLimit) {
        const characterCount = content.length;
        const isWithinLimit = platformName.includes('Twitter') ? characterCount <= 280 : true;

        return `
            <div style="background: white; border-left: 4px solid ${color}; border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h3 style="color: ${color}; margin: 0 0 5px 0; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5em;">${icon}</span>
                            ${platformName}
                        </h3>
                        <div style="font-size: 0.85em; color: ${isWithinLimit ? '#4caf50' : '#f44336'}; font-weight: 600;">
                            ${characterCount} / ${charLimit}
                            ${!isWithinLimit ? ' ⚠️ Over limit!' : ' ✓'}
                        </div>
                    </div>
                    <button
                        onclick="app.copySocialPost(this, '${platformName.replace(/'/g, "\\'")}', '${this.escapeForJS(content)}')"
                        style="background: ${color}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: opacity 0.2s;"
                        onmouseover="this.style.opacity='0.8'"
                        onmouseout="this.style.opacity='1'"
                    >
                        📋 Copy
                    </button>
                </div>
                <div style="background: #f8f9fa; border-radius: 6px; padding: 15px; line-height: 1.6; color: #333; white-space: pre-wrap; word-wrap: break-word;">
${content}
                </div>
            </div>
        `;
    },

    /**
     * Copy individual social media post to clipboard
     */
    async copySocialPost(button, platformName, content) {
        try {
            // Decode escaped content
            const decodedContent = content
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, '\\');

            await navigator.clipboard.writeText(decodedContent);

            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.style.background = '#4caf50';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            alert('Failed to copy to clipboard. Please try again.');
        }
    },

    /**
     * Copy all social media posts to clipboard as formatted text
     */
    async copyAllSocialMedia() {
        if (!this.state.socialMedia) {
            alert('No social media content to copy');
            return;
        }

        try {
            let text = '=== SOCIAL MEDIA CONTENT ===\n\n';

            const platforms = [
                { key: 'twitter', name: 'TWITTER / X' },
                { key: 'facebook', name: 'FACEBOOK' },
                { key: 'instagram', name: 'INSTAGRAM' },
                { key: 'linkedin', name: 'LINKEDIN' },
                { key: 'tiktok', name: 'TIKTOK' }
            ];

            platforms.forEach(platform => {
                if (this.state.socialMedia[platform.key]) {
                    text += `${platform.name}\n${'='.repeat(platform.name.length)}\n${this.state.socialMedia[platform.key]}\n\n`;
                }
            });

            await navigator.clipboard.writeText(text);
            alert('All social media content copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy all social media content:', error);
            alert('Failed to copy to clipboard. Please try again.');
        }
    },

    /**
     * Download Social Media Content as JSON
     */
    downloadSocialMedia() {
        if (!this.state.socialMedia) {
            alert('No social media content available');
            return;
        }

        const dataStr = JSON.stringify(this.state.socialMedia, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `social-media-${this.state.reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============================================================================
    // AI COVER GENERATION
    // ============================================================================

    /**
     * Start AI cover generation with DALL-E 3
     */
    async startCoverGeneration() {
        // Get input values
        const title = document.getElementById('coverTitle')?.value?.trim();
        const authorName = document.getElementById('coverAuthor')?.value?.trim();
        const numVariations = parseInt(document.getElementById('coverVariations')?.value || '3');

        // Validate inputs
        if (!title) {
            alert('Please enter a book title');
            return;
        }

        if (!authorName) {
            alert('Please enter an author name');
            return;
        }

        if (!this.state.reportId) {
            alert('No report ID available. Please analyze a manuscript first.');
            return;
        }

        console.log('Starting cover generation:', { title, authorName, numVariations });

        // Show loading state
        document.getElementById('coversForm').style.display = 'none';
        document.getElementById('coversLoading').style.display = 'block';
        document.getElementById('coversContent').style.display = 'none';

        try {
            // Call the generate-covers endpoint
            const response = await fetch(`${this.API_BASE}/generate-covers`, {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: this.state.reportId,
                    title: title,
                    authorName: authorName,
                    numVariations: numVariations
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Cover generation failed');
            }

            console.log('Covers generated successfully:', result);

            // Store cover data
            this.state.covers = result.covers;

            // Display results
            this.displayCovers(result.covers);

            // Hide loading, show content
            document.getElementById('coversLoading').style.display = 'none';
            document.getElementById('coversContent').style.display = 'block';

        } catch (error) {
            console.error('Cover generation error:', error);
            alert(`Cover generation failed: ${error.message}`);

            // Show form again
            document.getElementById('coversForm').style.display = 'block';
            document.getElementById('coversLoading').style.display = 'none';
        }
    },

    /**
     * Display generated cover images
     */
    displayCovers(coversData) {
        const container = document.getElementById('coversContent');
        if (!container) return;

        const coverImages = coversData.coverImages || [];

        let html = `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; margin-bottom: 10px;">✅ Cover Images Generated!</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    ${coverImages.length} cover variation${coverImages.length !== 1 ? 's' : ''} created.
                    Click download to get the full-size version.
                </p>
            </div>
        `;

        // Grid of cover images
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">';

        coverImages.forEach((cover, index) => {
            html += `
                <div style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white;">
                    <div style="aspect-ratio: 1024/1792; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: white;">
                            <p style="font-size: 1.2em; margin-bottom: 10px;">Variation ${cover.variationNumber}</p>
                            <button
                                onclick="app.downloadCover(${cover.variationNumber})"
                                style="background: white; color: #667eea; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                📥 Download
                            </button>
                        </div>
                    </div>
                    <div style="padding: 15px;">
                        <p style="font-size: 0.9em; color: #666; margin-bottom: 5px;">
                            <strong>Model:</strong> ${cover.size || 'DALL-E 3'}
                        </p>
                        <p style="font-size: 0.85em; color: #999; margin-bottom: 10px;">
                            ${cover.revisedPrompt ? cover.revisedPrompt.substring(0, 100) + '...' : 'AI-generated cover design'}
                        </p>
                        ${cover.duration ? `<p style="font-size: 0.8em; color: #999;">Generated in ${(cover.duration / 1000).toFixed(1)}s</p>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';

        // Error reporting
        if (coversData.errors && coversData.errors.length > 0) {
            html += `
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <p style="color: #856404; font-weight: 600; margin-bottom: 10px;">⚠️ Some variations failed:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #856404;">
                        ${coversData.errors.map(e => `<li>Variation ${e.variation}: ${e.error}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Summary
        html += `
            <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #333;">📊 Generation Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div>
                        <p style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Requested</p>
                        <p style="color: #333; font-size: 1.2em; font-weight: 600;">${coversData.requested} variations</p>
                    </div>
                    <div>
                        <p style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Generated</p>
                        <p style="color: #333; font-size: 1.2em; font-weight: 600;">${coversData.generated} successful</p>
                    </div>
                </div>
            </div>
        `;

        // Generate more button
        html += `
            <button class="btn btn-secondary" onclick="app.navigate('covers'); document.getElementById('coversForm').style.display = 'block'; document.getElementById('coversContent').style.display = 'none';">
                🎨 Generate More Covers
            </button>
        `;

        container.innerHTML = html;
    },

    /**
     * Download a specific cover variation
     */
    async downloadCover(variationNumber) {
        if (!this.state.reportId) {
            alert('No report ID available');
            return;
        }

        try {
            const url = `${this.API_BASE}/covers/download?reportId=${this.state.reportId}&variation=${variationNumber}`;

            // Open in new window to trigger download
            window.open(url, '_blank');

        } catch (error) {
            console.error('Download error:', error);
            alert(`Download failed: ${error.message}`);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

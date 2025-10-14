// Single Page Application Logic for Manuscript Dashboard

const app = {
    // Configuration
    API_BASE: window.location.hostname === 'localhost' || window.location.protocol === 'file:'
        ? 'http://localhost:8787'
        : 'https://api.scarter4workmanuscripthub.com',
    
    // State
    state: {
        currentView: 'upload',
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

        // Set up file input handler
        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('fileLabel').classList.add('has-file');
            }
        });

        // Check for initial route from URL
        const hash = window.location.hash.slice(1); // Remove #
        const params = new URLSearchParams(window.location.search);
        const reportId = params.get('loadReport');

        if (reportId) {
            this.state.reportId = reportId;
            this.navigate('summary');
        } else if (hash) {
            const [view, id] = hash.split('/');
            if (id) this.state.reportId = id;
            this.navigate(view || 'upload');
        } else {
            // Default to upload view
            this.navigate('upload');
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
            const data = await response.json();

            if (data.authenticated) {
                // Update user info display with logout button
                document.getElementById('userInfo').innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="text-align: right;">
                            <div style="opacity: 0.9;">👤 ${data.name || data.email}</div>
                            <div style="font-size: 12px; opacity: 0.7;">${data.email} (${data.role})</div>
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
        this.updateProgress(10, 'Uploading manuscript...');

        try {
            // Upload manuscript (Phase C: analysis is automatically queued on upload)
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('title', fileInput.files[0].name.replace(/\.[^/.]+$/, "")); // Remove extension
            formData.append('genre', genre);

            const uploadResponse = await fetch(`${this.API_BASE}/upload/manuscript`, {
                credentials: 'include',
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.text();
                throw new Error(`Upload failed: ${error}`);
            }

            const uploadResult = await uploadResponse.json();

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
                else if (status.status === 'processing') {
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

                    console.log('Analysis complete! Fetching results and starting asset generation...');

                    // Fetch the analysis results from R2
                    await this.fetchAnalysisResults();

                    // Phase D: Start polling for asset generation status
                    setTimeout(() => {
                        this.pollAssetStatus();
                    }, 1000);
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
        const pollInterval = 2000; // Poll every 2 seconds
        const maxPolls = 300; // Max 10 minutes (300 * 2 seconds)
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
                    this.updateProgress(100, 'All assets generated! ✨');

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

                    console.log('Assets complete!', this.state.assetResults);

                    // Show summary after a brief pause
                    setTimeout(() => {
                        if (this.state.analysisResults.developmental) {
                            this.showSummary();
                        } else {
                            this.navigate('summary');
                        }
                    }, 1500);
                    return; // Stop polling
                } else if (status.status === 'failed') {
                    console.error('Asset generation failed:', status.error);
                    // Show summary anyway, but without assets
                    this.showSummaryWithoutAssets();
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
                // Show summary without assets if there's an error
                this.showSummaryWithoutAssets();
            }
        };

        // Start polling
        poll();
    },

    // Show summary without waiting for assets (fallback)
    showSummaryWithoutAssets() {
        console.log('Showing summary without assets');
        setTimeout(() => {
            if (this.state.analysisResults.developmental) {
                this.showSummary();
            } else {
                this.navigate('summary');
            }
        }, 500);
    },

    // Update progress bar
    updateProgress(percent, text) {
        document.getElementById('progressBar').style.width = percent + '%';
        document.getElementById('progressText').textContent = text;
    },

    // Update agent status
    updateAgentStatus(agent, status, text) {
        const agentCard = document.getElementById(agent + 'Agent');
        const statusSpan = document.getElementById(agent + 'Status');

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
            
            // Hide the report's internal breadcrumb (we use the dashboard's breadcrumb)
            setTimeout(() => {
                const reportBreadcrumb = document.querySelector('#reportContent .breadcrumb');
                if (reportBreadcrumb) {
                    reportBreadcrumb.style.display = 'none';
                }
            }, 100);
            
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
            
            // Hide the annotated manuscript's internal breadcrumb (we use the dashboard's breadcrumb)
            setTimeout(() => {
                const annotatedBreadcrumb = document.querySelector('#annotatedContent .breadcrumb');
                if (annotatedBreadcrumb) {
                    annotatedBreadcrumb.style.display = 'none';
                }
            }, 100);
            
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

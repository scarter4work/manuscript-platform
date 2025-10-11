// Single Page Application Logic for Manuscript Dashboard

const app = {
    // Configuration
    API_BASE: window.location.hostname === 'localhost' || window.location.protocol === 'file:'
        ? 'http://localhost:8787'
        : 'https://api.scarter4workmanuscripthub.com',
    
    // State
    state: {
        currentView: 'upload',
        manuscriptKey: null,
        reportId: null,
        analysisResults: {
            developmental: null,
            lineEditing: null,
            copyEditing: null
        }
    },

    // Initialize app
    async init() {
        console.log('Initializing SPA...');
        
        // Load user info
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
            const response = await fetch(`${this.API_BASE}/auth/me`);
            const data = await response.json();
            
            if (data.authenticated) {
                document.getElementById('userInfo').innerHTML = `
                    <div style="opacity: 0.9;">👤 ${data.name || data.email}</div>
                    <div style="font-size: 12px; opacity: 0.7;">${data.email}</div>
                `;
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
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
            if (view === 'report') {
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
        
        if (view === 'upload') {
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
        
        if (!fileInput.files[0]) {
            alert('Please select a manuscript file');
            return;
        }

        // Navigate to analysis view
        this.navigate('analysis');
        this.updateProgress(10, 'Uploading manuscript...');

        try {
            // Upload manuscript
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('manuscriptId', `ms-${Date.now()}`);

            const uploadResponse = await fetch(`${this.API_BASE}/upload/manuscript`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }

            const uploadResult = await uploadResponse.json();
            this.state.manuscriptKey = uploadResult.key;
            this.state.reportId = uploadResult.reportId;
            
            this.updateProgress(20, 'Upload complete! Starting analysis...');

            // Start async analysis
            const startResponse = await fetch(`${this.API_BASE}/analyze/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manuscriptKey: this.state.manuscriptKey,
                    reportId: this.state.reportId,
                    genre: genre,
                    styleGuide: styleGuide
                })
            });

            if (!startResponse.ok) {
                throw new Error('Failed to start analysis');
            }

            // Poll for status updates
            await this.pollAnalysisStatus();

        } catch (error) {
            console.error('Error:', error);
            alert('Analysis failed: ' + error.message);
            this.navigate('upload', true);
        }
    },

    // Poll for analysis status
    async pollAnalysisStatus() {
        const pollInterval = 2000; // Poll every 2 seconds
        const maxPolls = 300; // Max 10 minutes (300 * 2 seconds)
        let pollCount = 0;

        const poll = async () => {
            try {
                const response = await fetch(
                    `${this.API_BASE}/analyze/status?reportId=${this.state.reportId}`
                );

                if (!response.ok) {
                    throw new Error('Failed to get status');
                }

                const status = await response.json();
                console.log('Status:', status);

                // Update UI based on status
                if (status.status === 'queued') {
                    this.updateProgress(25, 'Analysis queued...');
                    this.updateAgentStatus('dev', 'pending', 'Queued');
                    this.updateAgentStatus('line', 'pending', 'Queued');
                    this.updateAgentStatus('copy', 'pending', 'Queued');
                } else if (status.status === 'running') {
                    // Update progress based on percentage
                    const progress = 25 + (status.progress * 0.75); // Scale from 25-100
                    this.updateProgress(progress, status.message || 'Running analysis...');

                    // Update agent statuses based on progress
                    if (status.progress < 33) {
                        this.updateAgentStatus('dev', 'running', 'Running...');
                        this.updateAgentStatus('line', 'pending', 'Pending');
                        this.updateAgentStatus('copy', 'pending', 'Pending');
                    } else if (status.progress < 66) {
                        this.updateAgentStatus('dev', 'complete', 'Complete');
                        this.updateAgentStatus('line', 'running', 'Running...');
                        this.updateAgentStatus('copy', 'pending', 'Pending');
                    } else {
                        this.updateAgentStatus('dev', 'complete', 'Complete');
                        this.updateAgentStatus('line', 'complete', 'Complete');
                        this.updateAgentStatus('copy', 'running', 'Running...');
                    }
                } else if (status.status === 'complete') {
                    // All done!
                    this.updateProgress(100, 'All analyses complete!');
                    this.updateAgentStatus('dev', 'complete', 'Complete');
                    this.updateAgentStatus('line', 'complete', 'Complete');
                    this.updateAgentStatus('copy', 'complete', 'Complete');

                    // Check if status includes the results
                    if (status.results) {
                        console.log('Got results from status:', status.results);
                        this.state.analysisResults.developmental = status.results.developmental;
                        this.state.analysisResults.lineEditing = status.results.lineEditing;
                        this.state.analysisResults.copyEditing = status.results.copyEditing;

                        // Display in agent cards
                        if (status.results.developmental) {
                            this.displayDevelopmentalResults(status.results.developmental);
                        }
                        if (status.results.lineEditing) {
                            this.displayLineEditingResults(status.results.lineEditing);
                        }
                        if (status.results.copyEditing) {
                            this.displayCopyEditingResults(status.results.copyEditing);
                        }
                    } else {
                        // Try fetching results separately
                        await this.fetchAnalysisResults();
                    }

                    // Show summary with data
                    setTimeout(() => {
                        if (this.state.analysisResults.developmental) {
                            this.showSummary();
                        } else {
                            // Fall back to limited summary if no data
                            this.navigate('summary');
                        }
                    }, 1000);
                    return; // Stop polling
                } else if (status.status === 'error') {
                    throw new Error(status.message || 'Analysis failed');
                }

                // Continue polling if not complete
                pollCount++;
                if (pollCount < maxPolls) {
                    setTimeout(poll, pollInterval);
                } else {
                    throw new Error('Analysis timeout - please try again');
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

            // Fetch all three analysis results
            const [devResponse, lineResponse, copyResponse] = await Promise.all([
                fetch(`${this.API_BASE}/analyze/developmental/result?reportId=${this.state.reportId}`),
                fetch(`${this.API_BASE}/analyze/line-editing/result?reportId=${this.state.reportId}`),
                fetch(`${this.API_BASE}/analyze/copy-editing/result?reportId=${this.state.reportId}`)
            ]);

            if (devResponse.ok) {
                this.state.analysisResults.developmental = await devResponse.json();
                this.displayDevelopmentalResults(this.state.analysisResults.developmental);
            }

            if (lineResponse.ok) {
                this.state.analysisResults.lineEditing = await lineResponse.json();
                this.displayLineEditingResults(this.state.analysisResults.lineEditing);
            }

            if (copyResponse.ok) {
                this.state.analysisResults.copyEditing = await copyResponse.json();
                this.displayCopyEditingResults(this.state.analysisResults.copyEditing);
            }

            console.log('Analysis results fetched successfully');

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
            const response = await fetch(`${this.API_BASE}/report?id=${this.state.reportId}`);

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
            const response = await fetch(`${this.API_BASE}/report?id=${this.state.reportId}`);
            
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
            const response = await fetch(`${this.API_BASE}/annotated?id=${this.state.reportId}`);
            
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

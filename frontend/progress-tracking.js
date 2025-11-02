// Progress Tracking Dashboard JavaScript
// Handles manuscript progress tracking UI and interactions

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : 'https://api.scarter4workmanuscripthub.com';

let currentManuscriptId = null;
let progressData = null;

const PLATFORM_NAMES = {
    kdp: 'Amazon KDP',
    draft2digital: 'Draft2Digital',
    ingramspark: 'IngramSpark',
    apple_books: 'Apple Books'
};

const PLATFORMS = ['kdp', 'draft2digital', 'ingramspark', 'apple_books'];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadManuscripts();

    document.getElementById('manuscriptSelect').addEventListener('change', async (e) => {
        currentManuscriptId = e.target.value;
        if (currentManuscriptId) {
            await loadProgress();
        }
    });
});

/**
 * Load manuscripts for selector
 */
async function loadManuscripts() {
    try {
        const response = await fetch(`${API_BASE}/manuscripts`, {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/index.html';
                return;
            }
            throw new Error('Failed to load manuscripts');
        }

        const manuscripts = await response.json();
        const select = document.getElementById('manuscriptSelect');

        if (!manuscripts || manuscripts.length === 0) {
            select.innerHTML = '<option value="">No manuscripts found</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a manuscript...</option>' +
            manuscripts.map(m => `<option value="${m.id}">${m.title}</option>`).join('');

    } catch (error) {
        console.error('Error loading manuscripts:', error);
        showError('Failed to load manuscripts. Please refresh the page.');
    }
}

/**
 * Load progress for selected manuscript
 */
async function loadProgress() {
    if (!currentManuscriptId) return;

    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/manuscripts/${currentManuscriptId}/progress`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load progress');
        }

        const data = await response.json();
        progressData = data;

        renderProgress();
    } catch (error) {
        console.error('Error loading progress:', error);
        showError('Failed to load progress data. Please try again.');
        hideLoading();
    }
}

/**
 * Render progress dashboard
 */
function renderProgress() {
    hideLoading();

    const grid = document.getElementById('platformGrid');
    const emptyState = document.getElementById('emptyState');

    if (!progressData || !progressData.platforms || progressData.platforms.length === 0) {
        // Show empty state with init buttons
        emptyState.style.display = 'block';
        grid.innerHTML = PLATFORMS.map(platform => createInitCard(platform)).join('');
        return;
    }

    emptyState.style.display = 'none';

    // Create map of existing platforms
    const platformMap = {};
    progressData.platforms.forEach(p => {
        platformMap[p.platform] = p;
    });

    // Render all platforms (existing + available to init)
    grid.innerHTML = PLATFORMS.map(platform => {
        if (platformMap[platform]) {
            return createPlatformCard(platformMap[platform]);
        } else {
            return createInitCard(platform);
        }
    }).join('');

    // Attach event listeners
    attachChecklistListeners();
}

/**
 * Create platform card with progress
 */
function createPlatformCard(platform) {
    const statusClass = `status-${platform.status.replace('_', '-')}`;
    const completion = platform.overallCompletion || 0;

    // Group checklist by category
    const categories = {};
    platform.checklist.forEach(item => {
        const cat = item.category || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
    });

    const checklistHTML = Object.entries(categories).map(([category, items]) => `
        <div class="checklist-category">
            <div class="category-title">${formatCategory(category)}</div>
            ${items.map(item => `
                <div class="checklist-item ${item.isCompleted ? 'completed' : ''}"
                     data-platform="${platform.platform}"
                     data-item-key="${item.key}">
                    <input type="checkbox"
                           id="${platform.platform}-${item.key}"
                           ${item.isCompleted ? 'checked' : ''}
                           data-platform="${platform.platform}"
                           data-item-key="${item.key}">
                    <label for="${platform.platform}-${item.key}">${item.label}</label>
                </div>
            `).join('')}
        </div>
    `).join('');

    return `
        <div class="platform-card">
            <div class="platform-header">
                <div class="platform-name">${PLATFORM_NAMES[platform.platform]}</div>
                <div class="platform-status">
                    <span class="status-badge ${statusClass}">
                        ${formatStatus(platform.status)}
                    </span>
                </div>
            </div>

            <div class="completion-bar">
                <div class="completion-fill" style="width: ${completion}%"></div>
            </div>
            <div class="completion-text">${completion}% Complete</div>

            ${platform.nextActionRecommendation ? `
                <div class="next-action">
                    <strong>Next:</strong> ${platform.nextActionRecommendation}
                </div>
            ` : ''}

            ${checklistHTML}

            ${platform.startedAt ? `
                <div class="timestamps">
                    <div>Started: ${formatTimestamp(platform.startedAt)}</div>
                    ${platform.uploadedAt ? `<div>Uploaded: ${formatTimestamp(platform.uploadedAt)}</div>` : ''}
                    ${platform.publishedAt ? `<div>Published: ${formatTimestamp(platform.publishedAt)}</div>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Create init card for platform not yet started
 */
function createInitCard(platform) {
    return `
        <div class="platform-card">
            <div class="platform-header">
                <div class="platform-name">${PLATFORM_NAMES[platform]}</div>
                <div class="platform-status">
                    <span class="status-badge status-not-started">Not Started</span>
                </div>
            </div>
            <div class="completion-bar">
                <div class="completion-fill" style="width: 0%"></div>
            </div>
            <div class="completion-text">0% Complete</div>
            <button class="init-button" onclick="initializePlatform('${platform}')">
                Start Publishing to ${PLATFORM_NAMES[platform]}
            </button>
        </div>
    `;
}

/**
 * Initialize progress tracking for a platform
 */
async function initializePlatform(platform) {
    if (!currentManuscriptId) return;

    try {
        const response = await fetch(`${API_BASE}/manuscripts/${currentManuscriptId}/progress/${platform}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to initialize progress');
        }

        // Reload progress
        await loadProgress();
    } catch (error) {
        console.error('Error initializing platform:', error);
        showError(`Failed to initialize ${PLATFORM_NAMES[platform]}: ${error.message}`);
    }
}

/**
 * Attach event listeners to checklist items
 */
function attachChecklistListeners() {
    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const platform = e.target.dataset.platform;
            const itemKey = e.target.dataset.itemKey;
            const isCompleted = e.target.checked;

            await updateChecklistItem(platform, itemKey, isCompleted);
        });
    });
}

/**
 * Update a checklist item
 */
async function updateChecklistItem(platform, itemKey, isCompleted) {
    try {
        const response = await fetch(
            `${API_BASE}/manuscripts/${currentManuscriptId}/progress/${platform}/checklist/${itemKey}`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isCompleted })
            }
        );

        if (!response.ok) {
            throw new Error('Failed to update checklist item');
        }

        // Reload progress to get updated completion percentage and status
        await loadProgress();
    } catch (error) {
        console.error('Error updating checklist:', error);
        showError('Failed to update checklist item. Please try again.');
        // Reload to revert checkbox state
        await loadProgress();
    }
}

/**
 * Utility functions
 */
function formatStatus(status) {
    return status.replace('_', ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatCategory(category) {
    return category.replace('_', ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('platformGrid').innerHTML = '';
    document.getElementById('emptyState').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

function showError(message) {
    const errorEl = document.getElementById('errorState');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('errorState').style.display = 'none';
}

// Make initializePlatform available globally for onclick
window.initializePlatform = initializePlatform;

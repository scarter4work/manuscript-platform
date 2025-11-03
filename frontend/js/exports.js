// Export Packages JavaScript - API Integration
// Handles creation, listing, and management of multi-platform export packages

const API_BASE = window.location.origin;
let currentFilter = 'all';
let allPackages = [];
let manuscripts = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadManuscripts();
    await loadAllPackages();
});

// ====================
// MANUSCRIPT LOADING
// ====================

async function loadManuscripts() {
    try {
        const response = await fetch(`${API_BASE}/list`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load manuscripts');
        }

        const data = await response.json();
        manuscripts = data.manuscripts || [];

        // Populate manuscript dropdown
        const select = document.getElementById('manuscript-select');
        if (manuscripts.length === 0) {
            select.innerHTML = '<option value="">No manuscripts available</option>';
        } else {
            select.innerHTML = '<option value="">Select a manuscript...</option>' +
                manuscripts.map(m =>
                    `<option value="${m.id}">${m.title || 'Untitled'} by ${m.authorName || 'Unknown'}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error loading manuscripts:', error);
        showError('Failed to load manuscripts');
    }
}

// ====================
// PACKAGE LOADING
// ====================

async function loadAllPackages() {
    const platforms = ['draft2digital', 'ingramspark', 'apple_books'];
    allPackages = [];

    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('packages-grid').innerHTML = '';
    document.getElementById('empty-state').classList.add('hidden');

    try {
        // Load packages from all platforms in parallel
        const packagePromises = platforms.map(platform =>
            fetch(`${API_BASE}/exports/${platform}`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : { packages: [] })
                .then(data => (data.packages || []).map(p => ({ ...p, platform })))
                .catch(() => [])
        );

        const results = await Promise.all(packagePromises);
        allPackages = results.flat();

        displayPackages();
    } catch (error) {
        console.error('Error loading packages:', error);
        showError('Failed to load export packages');
    } finally {
        document.getElementById('loading-state').classList.add('hidden');
    }
}

function displayPackages() {
    const filtered = currentFilter === 'all'
        ? allPackages
        : allPackages.filter(p => p.platform === currentFilter);

    const grid = document.getElementById('packages-grid');
    const emptyState = document.getElementById('empty-state');

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = filtered.map(pkg => createPackageCard(pkg)).join('');
}

function createPackageCard(pkg) {
    const platformName = {
        'draft2digital': 'Draft2Digital',
        'ingramspark': 'IngramSpark',
        'apple_books': 'Apple Books'
    }[pkg.platform] || pkg.platform;

    const platformClass = {
        'draft2digital': 'platform-badge-d2d',
        'ingramspark': 'platform-badge-ingramspark',
        'apple_books': 'platform-badge-apple'
    }[pkg.platform] || 'platform-badge-d2d';

    const statusClass = `status-${pkg.status || 'ready'}`;
    const statusText = (pkg.status || 'ready').replace('_', ' ').toUpperCase();

    const createdDate = pkg.created_at ? new Date(pkg.created_at * 1000).toLocaleDateString() : 'Unknown';
    const expiresDate = pkg.expires_at ? new Date(pkg.expires_at * 1000).toLocaleDateString() : 'Never';

    const manuscriptTitle = pkg.manuscript_title || 'Unknown Manuscript';
    const author = pkg.author_name || 'Unknown Author';

    return `
        <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition p-6">
            <div class="flex justify-between items-start mb-4">
                <span class="${platformClass} text-white text-xs px-3 py-1 rounded-full font-medium">
                    ${platformName}
                </span>
                <span class="${statusClass} text-white text-xs px-3 py-1 rounded-full font-medium">
                    ${statusText}
                </span>
            </div>

            <h3 class="text-lg font-semibold text-gray-900 mb-1">${manuscriptTitle}</h3>
            <p class="text-sm text-gray-600 mb-4">by ${author}</p>

            <div class="text-sm text-gray-500 mb-4 space-y-1">
                <div><i class="fas fa-calendar mr-2"></i>Created: ${createdDate}</div>
                <div><i class="fas fa-clock mr-2"></i>Expires: ${expiresDate}</div>
            </div>

            <div class="flex space-x-2">
                <button onclick="viewPackageDetails('${pkg.platform}', '${pkg.id}')"
                        class="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm">
                    <i class="fas fa-eye mr-2"></i>View Details
                </button>
                <button onclick="downloadPackage('${pkg.platform}', '${pkg.id}')"
                        class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deletePackage('${pkg.platform}', '${pkg.id}')"
                        class="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// ====================
// FILTERING
// ====================

function filterPlatform(platform) {
    currentFilter = platform;

    // Update tab styling
    document.querySelectorAll('.platform-tab').forEach(tab => {
        tab.classList.remove('border-indigo-600', 'text-indigo-600', 'active');
        tab.classList.add('border-transparent', 'text-gray-500');
    });

    event.target.classList.remove('border-transparent', 'text-gray-500');
    event.target.classList.add('border-indigo-600', 'text-indigo-600', 'active');

    displayPackages();
}

// ====================
// CREATE PACKAGE MODAL
// ====================

function showCreateModal() {
    document.getElementById('create-modal').classList.remove('hidden');
    document.getElementById('step-manuscript').classList.remove('hidden');
    document.getElementById('step-options').classList.add('hidden');
}

function hideCreateModal() {
    document.getElementById('create-modal').classList.add('hidden');
    document.getElementById('create-export-form').reset();
}

function showPlatformOptions() {
    const platform = document.querySelector('input[name="platform"]:checked');
    if (!platform) {
        alert('Please select a platform');
        return;
    }

    // Hide all option divs
    document.getElementById('options-draft2digital').classList.add('hidden');
    document.getElementById('options-ingramspark').classList.add('hidden');
    document.getElementById('options-apple_books').classList.add('hidden');

    // Show selected platform options
    document.getElementById(`options-${platform.value}`).classList.remove('hidden');

    // Switch to options step
    document.getElementById('step-manuscript').classList.add('hidden');
    document.getElementById('step-options').classList.remove('hidden');
}

function showManuscriptStep() {
    document.getElementById('step-manuscript').classList.remove('hidden');
    document.getElementById('step-options').classList.add('hidden');
}

// ====================
// CREATE PACKAGE
// ====================

async function createExportPackage(event) {
    event.preventDefault();

    const manuscriptId = document.getElementById('manuscript-select').value;
    const platform = document.querySelector('input[name="platform"]:checked').value;

    if (!manuscriptId || !platform) {
        alert('Please select a manuscript and platform');
        return;
    }

    // Collect platform-specific options
    const options = getPlatformOptions(platform);

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';

    try {
        const response = await fetch(`${API_BASE}/exports/${platform}/${manuscriptId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(options)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create export package');
        }

        const data = await response.json();

        showSuccess('Export package created successfully!');
        hideCreateModal();
        await loadAllPackages();

    } catch (error) {
        console.error('Error creating package:', error);
        showError(error.message || 'Failed to create export package');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function getPlatformOptions(platform) {
    switch (platform) {
        case 'draft2digital':
            return {
                price: parseFloat(document.getElementById('d2d-price').value) || undefined,
                includeEPUB: document.getElementById('d2d-epub').checked,
                includeDOCX: document.getElementById('d2d-docx').checked
            };

        case 'ingramspark':
            return {
                trimSize: document.getElementById('is-trim-size').value,
                pageCount: parseInt(document.getElementById('is-page-count').value) || undefined,
                paperType: document.getElementById('is-paper-type').value,
                isbn: document.getElementById('is-isbn').value || undefined
            };

        case 'apple_books':
            return {
                ageRating: document.getElementById('apple-age-rating').value,
                explicitContent: document.getElementById('apple-explicit').checked
            };

        default:
            return {};
    }
}

// ====================
// PACKAGE DETAILS
// ====================

async function viewPackageDetails(platform, packageId) {
    try {
        const response = await fetch(`${API_BASE}/exports/${platform}/${packageId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load package details');
        }

        const data = await response.json();
        const pkg = data.package;

        const platformName = {
            'draft2digital': 'Draft2Digital',
            'ingramspark': 'IngramSpark',
            'apple_books': 'Apple Books'
        }[platform] || platform;

        const filesHTML = (pkg.files || []).map(file => `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-file text-gray-400 mr-3"></i>
                    <div>
                        <div class="font-medium text-gray-900">${file.name}</div>
                        <div class="text-sm text-gray-500">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button onclick="downloadFile('${platform}', '${packageId}', '${file.type}')"
                        class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm">
                    <i class="fas fa-download mr-2"></i>Download
                </button>
            </div>
        `).join('');

        const content = `
            <div class="space-y-6">
                <div>
                    <h4 class="text-lg font-semibold text-gray-900 mb-2">${pkg.manuscript_title || 'Untitled'}</h4>
                    <p class="text-gray-600">Platform: <span class="font-medium">${platformName}</span></p>
                    <p class="text-gray-600">Status: <span class="font-medium capitalize">${pkg.status || 'ready'}</span></p>
                </div>

                <div>
                    <h5 class="font-medium text-gray-900 mb-3">Files</h5>
                    <div class="space-y-2">
                        ${filesHTML || '<p class="text-gray-500">No files available</p>'}
                    </div>
                </div>

                <div class="flex space-x-4">
                    <button onclick="downloadPackage('${platform}', '${packageId}')"
                            class="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition">
                        <i class="fas fa-download mr-2"></i>Download Complete Package (ZIP)
                    </button>
                    <button onclick="regeneratePackage('${platform}', '${packageId}')"
                            class="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition">
                        <i class="fas fa-sync mr-2"></i>Regenerate
                    </button>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 class="font-medium text-blue-900 mb-2">
                        <i class="fas fa-info-circle mr-2"></i>Upload Instructions
                    </h5>
                    <p class="text-sm text-blue-800">${getUploadInstructions(platform)}</p>
                </div>
            </div>
        `;

        document.getElementById('package-details-content').innerHTML = content;
        document.getElementById('details-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading package details:', error);
        showError('Failed to load package details');
    }
}

function hideDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
}

function getUploadInstructions(platform) {
    const instructions = {
        'draft2digital': '1. Log in to Draft2Digital.com\n2. Click "Add a New Book"\n3. Upload the EPUB or DOCX file\n4. Upload the cover image\n5. Complete the metadata form\n6. Select distribution channels\n7. Publish',
        'ingramspark': '1. Log in to IngramSpark.com\n2. Click "Add a Title"\n3. Enter ISBN and complete title setup\n4. Upload interior PDF\n5. Upload cover PDF (with spine)\n6. Set pricing and distribution\n7. Submit for review',
        'apple_books': '1. Log in to Apple Books Connect\n2. Click "Add a Book"\n3. Upload the EPUB file\n4. Upload the cover image\n5. Complete metadata and pricing\n6. Submit for review'
    };
    return instructions[platform] || 'Follow platform-specific upload instructions';
}

// ====================
// DOWNLOAD & DELETE
// ====================

async function downloadPackage(platform, packageId) {
    try {
        const response = await fetch(`${API_BASE}/exports/${platform}/${packageId}/zip`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to download package');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${platform}-${packageId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess('Package downloaded successfully!');
    } catch (error) {
        console.error('Error downloading package:', error);
        showError('Failed to download package');
    }
}

async function downloadFile(platform, packageId, fileType) {
    try {
        const response = await fetch(`${API_BASE}/exports/${platform}/${packageId}/${fileType}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileType}.${getFileExtension(fileType)}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess('File downloaded successfully!');
    } catch (error) {
        console.error('Error downloading file:', error);
        showError('Failed to download file');
    }
}

async function deletePackage(platform, packageId) {
    if (!confirm('Are you sure you want to delete this export package?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/exports/${platform}/${packageId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to delete package');
        }

        showSuccess('Package deleted successfully!');
        await loadAllPackages();
    } catch (error) {
        console.error('Error deleting package:', error);
        showError('Failed to delete package');
    }
}

async function regeneratePackage(platform, packageId) {
    if (!confirm('Regenerate this export package? This will create a new version.')) {
        return;
    }

    // For now, just show a message - regeneration would require knowing the manuscript ID
    showError('Regeneration feature coming soon. Please create a new export package instead.');
}

// ====================
// UTILITIES
// ====================

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileExtension(fileType) {
    const extensions = {
        'epub': 'epub',
        'pdf': 'pdf',
        'docx': 'docx',
        'cover': 'jpg',
        'interior': 'pdf',
        'readme': 'txt'
    };
    return extensions[fileType] || 'bin';
}

function showSuccess(message) {
    // Simple alert for now - could be replaced with toast notification
    alert('✓ ' + message);
}

function showError(message) {
    // Simple alert for now - could be replaced with toast notification
    alert('✗ ' + message);
}

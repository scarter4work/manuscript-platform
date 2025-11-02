/**
 * Main entry point for the homepage
 * Demonstrates TypeScript usage with the new build system
 */

// Type definitions for better type safety
interface Stats {
  manuscriptsAnalyzed: number;
  authorsServed: number;
}

// Utility function to animate counters
function animateCounter(element: HTMLElement | null, target: number, duration: number = 2000): void {
  if (!element) return;

  const start = 0;
  const startTime = performance.now();

  function update(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(start + (target - start) * easeOutQuart);

    if (element) {
      element.textContent = current.toLocaleString();
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// Fetch stats from API
async function fetchStats(): Promise<Stats> {
  try {
    // In a real implementation, this would call the API
    // For now, return mock data
    return {
      manuscriptsAnalyzed: 1247,
      authorsServed: 892,
    };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return {
      manuscriptsAnalyzed: 0,
      authorsServed: 0,
    };
  }
}

// Initialize page
async function init(): Promise<void> {
  console.log('Initializing homepage with modern build system...');

  // Fetch and display stats
  const stats = await fetchStats();

  const manuscriptsEl = document.getElementById('manuscriptsAnalyzed');
  const authorsEl = document.getElementById('authorsServed');

  animateCounter(manuscriptsEl, stats.manuscriptsAnalyzed);
  animateCounter(authorsEl, stats.authorsServed);

  // Set up event listeners
  const getStartedBtn = document.getElementById('getStartedBtn');
  const learnMoreBtn = document.getElementById('learnMoreBtn');
  const ctaBtn = document.getElementById('ctaBtn');

  const handleGetStarted = (): void => {
    window.location.href = '/register.html';
  };

  const handleLearnMore = (): void => {
    window.location.href = '/help/index.html';
  };

  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', handleGetStarted);
  }

  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', handleLearnMore);
  }

  if (ctaBtn) {
    ctaBtn.addEventListener('click', handleGetStarted);
  }

  // Log successful initialization
  console.log('✅ Homepage initialized successfully');
  console.log('📊 Stats:', stats);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for potential use in other modules
export { fetchStats, animateCounter };

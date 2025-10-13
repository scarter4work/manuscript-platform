/**
 * Billing Integration Module
 * Handles subscription checks and payment gates for manuscript uploads
 */

const API_BASE = 'https://api.scarter4workmanuscripthub.com';

class BillingIntegration {
  constructor() {
    this.subscription = null;
    this.initialized = false;
  }

  /**
   * Initialize billing integration
   */
  async init() {
    if (this.initialized) return;

    try {
      await this.loadSubscription();
      this.addSubscriptionBadgeToUI();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize billing:', error);
    }
  }

  /**
   * Load current subscription details
   */
  async loadSubscription() {
    try {
      const response = await fetch(`${API_BASE}/payments/subscription`, {
        credentials: 'include'
      });

      if (response.ok) {
        this.subscription = await response.json();
        return this.subscription;
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
    return null;
  }

  /**
   * Check if user can upload a manuscript
   */
  async canUpload() {
    try {
      const response = await fetch(`${API_BASE}/payments/can-upload`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Failed to check upload permission:', error);
    }
    return { canUpload: false, error: 'Failed to check limits' };
  }

  /**
   * Show upgrade modal when limit is reached
   */
  showUpgradeModal(usage) {
    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const planName = usage.planType || 'free';
    const used = usage.manuscriptsUsed || 0;
    const limit = usage.monthlyLimit || 1;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="font-size: 28px; color: #333; margin-bottom: 15px;">📊 Monthly Limit Reached</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          You've used <strong>${used} of ${limit}</strong> manuscripts this month on your <strong>${planName.toUpperCase()}</strong> plan.
        </p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="font-size: 18px; color: #333; margin-bottom: 15px;">Choose an option:</h3>

          <button onclick="window.location.href='pricing.html'" style="
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 12px;
          ">
            ⬆️ Upgrade Plan (More Manuscripts)
          </button>

          ${planName === 'free' ? `
            <button onclick="billing.purchaseOneTime()" style="
              width: 100%;
              padding: 16px;
              background: white;
              color: #667eea;
              border: 2px solid #667eea;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              margin-bottom: 12px;
            ">
              💳 Pay $10 (One-Time Analysis)
            </button>
          ` : ''}

          <button onclick="document.getElementById('upgradeModal').remove()" style="
            width: 100%;
            padding: 16px;
            background: transparent;
            color: #666;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            Cancel
          </button>
        </div>

        <p style="font-size: 13px; color: #888; text-align: center;">
          Your current manuscripts and analyses remain accessible
        </p>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Handle one-time purchase for a manuscript
   */
  async purchaseOneTime() {
    // Close the upgrade modal
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.remove();

    // Show processing message
    alert('Redirecting to payment... This feature will be available after you set up Stripe test mode.');

    // TODO: Implement one-time purchase flow
    // This would create a payment intent and open a Stripe Elements modal
    // For now, redirect to pricing page
    window.location.href = 'pricing.html';
  }

  /**
   * Add subscription badge to UI
   */
  addSubscriptionBadgeToUI() {
    if (!this.subscription) return;

    const header = document.querySelector('header') || document.querySelector('.header');
    if (!header) return;

    const planType = this.subscription.planType || 'free';
    const used = this.subscription.manuscriptsThisPeriod || 0;
    const limit = this.subscription.monthlyLimit || 1;

    let badgeColor = '#4338ca';
    if (planType === 'pro') badgeColor = '#1e40af';
    if (planType === 'enterprise') badgeColor = '#92400e';

    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      cursor: pointer;
    `;

    badge.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div>
          <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Plan</div>
          <div style="font-size: 16px; font-weight: 700; color: ${badgeColor};">${planType.toUpperCase()}</div>
        </div>
        <div style="border-left: 2px solid #f0f0f0; padding-left: 12px;">
          <div style="font-size: 12px; color: #888;">This Month</div>
          <div style="font-size: 16px; font-weight: 700; color: #333;">${used}/${limit === 999999 ? '∞' : limit}</div>
        </div>
      </div>
    `;

    badge.onclick = () => window.location.href = 'billing.html';
    document.body.appendChild(badge);
  }

  /**
   * Check before manuscript upload
   */
  async checkBeforeUpload() {
    const check = await this.canUpload();

    if (!check.canUpload) {
      this.showUpgradeModal(check);
      return false;
    }

    return true;
  }
}

// Create global instance
const billing = new BillingIntegration();

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => billing.init());
} else {
  billing.init();
}

// Export for use in other scripts
window.billing = billing;

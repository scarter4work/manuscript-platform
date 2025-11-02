/**
 * Button Component
 * Reusable button component with variants
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline';

export interface ButtonOptions {
  variant?: ButtonVariant;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Create a button element with specified options
 */
export function createButton(options: ButtonOptions): HTMLButtonElement {
  const {
    variant = 'primary',
    text,
    onClick,
    disabled = false,
    className = '',
  } = options;

  const button = document.createElement('button');

  // Apply Tailwind classes based on variant
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
  };

  button.className = `${variantClasses[variant]} ${className}`.trim();
  button.textContent = text;
  button.disabled = disabled;

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  if (disabled) {
    button.classList.add('opacity-50', 'cursor-not-allowed');
  }

  return button;
}

/**
 * Create a loading button (shows spinner)
 */
export function createLoadingButton(text: string = 'Loading...'): HTMLButtonElement {
  const button = createButton({
    variant: 'primary',
    text,
    disabled: true,
  });

  // Add loading spinner
  const spinner = document.createElement('span');
  spinner.className = 'inline-block animate-spin mr-2';
  spinner.innerHTML = '⏳';

  button.prepend(spinner);

  return button;
}

/**
 * Update button to loading state
 */
export function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  if (loading) {
    button.disabled = true;
    button.classList.add('opacity-50', 'cursor-not-allowed');

    const spinner = document.createElement('span');
    spinner.className = 'inline-block animate-spin mr-2 button-spinner';
    spinner.innerHTML = '⏳';
    button.prepend(spinner);
  } else {
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');

    const spinner = button.querySelector('.button-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
}

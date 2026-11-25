import { Icon } from './Icon.jsx';

export function QtyStepper({ value, onChange, max, label, size = 'md' }) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className={`stepper stepper-${size}`} role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" aria-label={`Remove one ${label}`} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={16} strokeWidth={2.6} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={atMax ? `No more ${label} in stock` : `Add one ${label}`}
        onClick={() => !atMax && onChange(value + 1)}
        aria-disabled={atMax}
        className={atMax ? 'is-maxed' : ''}
      >
        <Icon name="plus" size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}

const variants = {
  condition: {
    new: { label: 'New', className: 'bg-primary text-white' },
    like_new: { label: 'Like New', className: 'bg-primary-light text-white' },
    good: { label: 'Gently used', className: 'bg-accent text-white' },
    fair: { label: 'Well used', className: 'bg-gray-400 text-white' },
  },
  status: {
    active: { label: 'Active', className: 'bg-success text-white' },
    sold: { label: 'Sold', className: 'bg-accent-dark text-white' },
    archived: { label: 'Archived', className: 'bg-gray-400 text-white' },
  },
};

export default function Badge({ type = 'condition', value, className = '' }) {
  const config = variants[type]?.[value];
  if (!config) return null;

  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}

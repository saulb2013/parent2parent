import { Link } from 'react-router-dom';

export default function CategoryPill({ name, slug, emoji, count }) {
  return (
    <Link
      to={`/browse?category=${slug}`}
      className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border border-border hover:border-primary-light hover:shadow-md transition-all duration-200 group"
    >
      <span className="text-3xl group-hover:scale-110 transition-transform">{emoji}</span>
      <span className="text-sm font-semibold text-center text-gray-700 group-hover:text-primary">{name}</span>
      {count !== undefined && (
        <span className="text-xs text-gray-400">{count} items</span>
      )}
    </Link>
  );
}

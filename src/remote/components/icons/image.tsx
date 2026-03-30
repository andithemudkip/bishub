export const ImageIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM5 19V5h14v14H5z"
      fill="currentColor"
    />
    <path
      d="M10 14l-3 4h10l-4-5-3 4-2-3z"
      fill="currentColor"
    />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
  </svg>
);

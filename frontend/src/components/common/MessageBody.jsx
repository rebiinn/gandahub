import { Link } from 'react-router-dom';

/**
 * Renders chat message text with clickable http(s) links. Same-origin URLs use SPA navigation.
 */
export default function MessageBody({ text, linkClassName }) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) {
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    }

    try {
      const url = new URL(part);
      const path = `${url.pathname}${url.search}${url.hash}`;
      if (url.origin === window.location.origin) {
        return (
          <Link key={i} to={path} className={linkClassName}>
            {part}
          </Link>
        );
      }
    } catch {
      /* fall through */
    }

    return (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {part}
      </a>
    );
  });
}

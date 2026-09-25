import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import styles from './ScrollToTopBottom.module.css';

// Verbatim port of the old app's ScrollToTopBottom.jsx: watches the passed
// scroll container (not window) via a ResizeObserver, since lazy-loaded
// widget content changes the scrollable height after mount.
export function ScrollToTopBottom({ scrollRef }) {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setAtTop(el.scrollTop < 80);
      setAtBottom(el.scrollTop + el.clientHeight > el.scrollHeight - 80);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollRef]);

  if (atTop && atBottom) return null;

  return (
    <div className={styles.wrapper}>
      {!atTop && (
        <button
          className={styles.btn}
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Jump to top"
          aria-label="Jump to top"
        >
          <ChevronUp size={18} />
        </button>
      )}
      {!atBottom && (
        <button
          className={styles.btn}
          onClick={() =>
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
          }
          title="Jump to bottom"
          aria-label="Jump to bottom"
        >
          <ChevronDown size={18} />
        </button>
      )}
    </div>
  );
}

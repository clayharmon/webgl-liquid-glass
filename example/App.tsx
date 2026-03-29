import { useState, useCallback, useRef, useEffect } from 'react';
import { LiquidGlassNav } from '../src';
import type { NavItem } from '../src';

// --- SVG Icons ---
const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const HomeIcon = () => <Icon d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z M9 21V12h6v9" />;
const SearchIcon = () => <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35" />;
const HeartIcon = () => <Icon d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />;
const UserIcon = () => <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;

const ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'search', label: 'Search', icon: <SearchIcon /> },
  { id: 'favorites', label: 'Favorites', icon: <HeartIcon /> },
  { id: 'profile', label: 'Profile', icon: <UserIcon /> },
];

const INLINE_STYLE = {
  position: 'relative' as const,
  bottom: 'auto' as const,
  left: 'auto' as const,
  transform: 'none' as const,
  zIndex: 1 as const,
};

// --- Toast ---
function useToast() {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string) => {
    clearTimeout(timeoutRef.current);
    setToast({ text, key: Date.now() });
    timeoutRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return { toast, show };
}

function Toast({ text, id }: { text: string; id: number }) {
  return (
    <div key={id} className="toast">
      {text}
    </div>
  );
}

// --- Variant ---
function Variant({
  title,
  description,
  bg,
  navStyle,
  activeColor,
  inactiveColor,
}: {
  title: string;
  description: string;
  bg: string;
  navStyle?: React.CSSProperties;
  activeColor?: string;
  inactiveColor?: string;
}) {
  const [active, setActive] = useState('home');
  const { toast, show } = useToast();

  const handleChange = useCallback(
    (id: string) => {
      setActive(id);
      const label = ITEMS.find((i) => i.id === id)?.label ?? id;
      show(`Navigated to ${label}`);
    },
    [show],
  );

  return (
    <div className="variant" style={{ background: bg }}>
      <div className="variant-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <LiquidGlassNav
        items={ITEMS}
        activeItem={active}
        onItemChange={handleChange}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
        style={{ ...INLINE_STYLE, ...navStyle }}
      />
      {toast && <Toast text={toast.text} id={toast.key} />}
    </div>
  );
}

export function App() {
  return (
    <div className="app">
      <div className="bg" />

      <div className="content">
        <header className="hero">
          <h1>Liquid Glass</h1>
          <p>WebGL-powered navbar for the web</p>
        </header>

        <div className="variants">
          <Variant
            title="Dark Mode"
            description="Default glass on dark background"
            bg="linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)"
          />

          <Variant
            title="Colored Active"
            description="Blue icons & text when selected"
            bg="linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #1b2838 100%)"
            activeColor="#60a5fa"
            inactiveColor="rgba(255, 255, 255, 0.5)"
          />

          <Variant
            title="Colored Default, White Active"
            description="Blue icons normally, white when selected"
            bg="linear-gradient(135deg, #162033 0%, #1a1a3e 50%, #0f1e2e 100%)"
            activeColor="rgba(255, 255, 255, 0.95)"
            inactiveColor="#818cf8"
          />

          <Variant
            title="Warm Tones"
            description="Orange active on dark surface"
            bg="linear-gradient(135deg, #1a1412 0%, #2d1f1b 50%, #1e1518 100%)"
            activeColor="#fb923c"
            inactiveColor="rgba(255, 255, 255, 0.45)"
          />

          <Variant
            title="Light Background"
            description="Glass effect over bright content"
            bg="linear-gradient(135deg, #c9d6ff 0%, #e2e2e2 50%, #ddd6f3 100%)"
            navStyle={{
              background: 'rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 0 0 0.5px rgba(255, 255, 255, 0.4)',
            }}
            activeColor="rgba(0, 0, 0, 0.85)"
            inactiveColor="rgba(0, 0, 0, 0.4)"
          />
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

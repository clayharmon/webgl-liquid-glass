# webgl-liquid-glass

Apple's Liquid Glass navbar effect for the web. Built with WebGL shaders, CSS backdrop-filter, and spring physics.

**[Live Demo](https://clayharmon.github.io/webgl-liquid-glass/)**

- WebGL-powered specular highlights, chromatic aberration, and motion shimmer
- Real CSS `backdrop-filter` blur (sees through to actual page content)
- Spring-animated pill indicator with drag-to-switch
- Press-and-hold bubble morph with momentum-based deformation
- Pointer + gyroscope light tracking
- Zero dependencies beyond React

## Install

```bash
npm install webgl-liquid-glass
```

## Usage

```tsx
import { LiquidGlassNav } from 'webgl-liquid-glass';

function App() {
  const [active, setActive] = useState('home');

  return (
    <LiquidGlassNav
      items={[
        { id: 'home', label: 'Home', icon: <HomeIcon /> },
        { id: 'search', label: 'Search', icon: <SearchIcon /> },
        { id: 'favorites', label: 'Favorites', icon: <HeartIcon /> },
        { id: 'profile', label: 'Profile', icon: <UserIcon /> },
      ]}
      activeItem={active}
      onItemChange={setActive}
    />
  );
}
```

## API

### `<LiquidGlassNav>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `NavItem[]` | required | Tab items to render |
| `activeItem` | `string` | required | `id` of the currently active item |
| `onItemChange` | `(id: string) => void` | required | Called when a tab is selected (tap or drag release) |
| `activeColor` | `string` | `'rgba(255,255,255,0.95)'` | Color for the active tab's icon and label |
| `inactiveColor` | `string` | `'rgba(255,255,255,0.5)'` | Color for inactive tabs |
| `className` | `string` | — | CSS class for the nav container |
| `style` | `CSSProperties` | — | Style overrides (spread last, can override defaults) |

### `NavItem`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `label` | `string` | Display text |
| `icon` | `ReactNode` | Optional icon element |
| `onClick` | `() => void` | Optional per-item callback (fires alongside `onItemChange`) |

## Customization

### Colors

```tsx
// Colored icons when active
<LiquidGlassNav
  activeColor="#60a5fa"
  inactiveColor="rgba(255, 255, 255, 0.5)"
  {...props}
/>

// Light mode
<LiquidGlassNav
  activeColor="rgba(0, 0, 0, 0.85)"
  inactiveColor="rgba(0, 0, 0, 0.4)"
  style={{
    background: 'rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(255,255,255,0.4)',
  }}
  {...props}
/>
```

### Positioning

The navbar is `position: fixed` at the bottom center by default. Override with `style`:

```tsx
// Inline (e.g. for a demo or stacked layout)
<LiquidGlassNav
  style={{ position: 'relative', bottom: 'auto', left: 'auto', transform: 'none' }}
  {...props}
/>
```

## React Native Web

This component works with React Native for web via `@react-navigation/bottom-tabs`. Create a custom tab bar wrapper:

```tsx
// components/LiquidGlassTabBar.web.tsx
import { LiquidGlassNav } from 'webgl-liquid-glass';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const items = state.routes.map((route) => {
    const { options } = descriptors[route.key];
    return {
      id: route.name,
      label: (options.tabBarLabel as string) ?? options.title ?? route.name,
      icon: options.tabBarIcon?.({ focused: state.index === state.routes.indexOf(route), color: '', size: 22 }),
    };
  });

  return (
    <LiquidGlassNav
      items={items}
      activeItem={state.routes[state.index].name}
      onItemChange={(id) => {
        const route = state.routes.find((r) => r.name === id);
        if (route) {
          navigation.navigate(route.name);
        }
      }}
    />
  );
}

// For native, fall back to the default tab bar:
// components/LiquidGlassTabBar.tsx
export { BottomTabBar as LiquidGlassTabBar } from '@react-navigation/bottom-tabs';
```

Then use it in your navigator:

```tsx
import { LiquidGlassTabBar } from './components/LiquidGlassTabBar';

<Tab.Navigator tabBar={(props) => <LiquidGlassTabBar {...props} />}>
  <Tab.Screen name="Home" component={HomeScreen} />
  <Tab.Screen name="Search" component={SearchScreen} />
</Tab.Navigator>
```

## Interactions

- **Click** a tab to switch
- **Press and hold** the active tab's pill to inflate it into a bubble
- **Drag** the bubble to another tab and release to switch
- The bubble has spring-based momentum — it stretches, skews, and wobbles based on drag velocity

## How it works

The glass effect is composited from three layers:

1. **CSS `backdrop-filter: blur(40px)`** on the nav container — provides the real frosted glass blur, seeing through to actual page content
2. **CSS pill element** with `backdrop-filter: brightness(1.2) saturate(1.4)` — creates a refraction-like lens effect by enhancing the blurred content in the active pill area
3. **WebGL canvas overlay** — renders SDF-based edge highlights, directional specular, chromatic aberration at pill edges, and motion shimmer during drag

Spring physics drive the pill position, bubble morph (inflate/deflate), and skew/stretch deformation. Pointer tracking and `DeviceOrientationEvent` shift the specular light position.

## Development

```bash
npm install
npm run dev     # Vite dev server with example app
npm run build   # Build the library with tsup
```

## License

MIT

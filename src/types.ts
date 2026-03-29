import type { ReactNode, CSSProperties } from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface LiquidGlassNavProps {
  items: NavItem[];
  activeItem: string;
  onItemChange: (id: string) => void;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
  style?: CSSProperties;
}

export interface SpringState {
  current: number;
  target: number;
  velocity: number;
}

export interface RenderParams {
  time: number;
  lightPos: [number, number];
  pillX: number;
  pillWidth: number;
  pillHeight: number;
  navRadius: number;
  transitionVel: number;
  pressAmt: number;
  tintColor: [number, number, number];
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
};

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="6" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 9h7M13 9v3M16 9v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 9l14-6-5 14-3-6-6-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2l6 2.4v4.2c0 4-2.6 6.8-6 7.4-3.4-.6-6-3.4-6-7.4V4.4L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 2v4M9 12v4M2 9h4M12 9h4M4.5 4.5l2.8 2.8M10.7 10.7l2.8 2.8M13.5 4.5l-2.8 2.8M7.3 10.7l-2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPulse({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M2 9h3l2-5 4 10 2-5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 3v5M4 11v4M9 3v2M9 8v7M14 3v9M14 15v0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="6.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="14" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// Placeholder routes — point these at your real page paths once the
// corresponding pages exist. These are plain <Link>s, no API calls.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/identity", label: "Identity", icon: IconKey },
  { href: "/payment", label: "Payment", icon: IconSend },
  { href: "/privacy", label: "Privacy", icon: IconShield },
  { href: "/coach", label: "AI Coach", icon: IconSpark },
  { href: "/activity", label: "Activity", icon: IconPulse },
  { href: "/settings", label: "Settings", icon: IconSliders },
];

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`app-sidebar ${isOpen ? "app-sidebar--open" : ""}`}>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${active ? "sidebar-link--active" : ""}`}
                onClick={onClose}
              >
                <Icon className="sidebar-link-icon" />
                <span>{label}</span>
                {active && <span className="sidebar-link-marker" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-label">build</span>
          <span className="sidebar-footer-value">hackathon · v0.1</span>
        </div>
      </aside>
    </>
  );
}
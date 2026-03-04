/**
 * NavMobile.tsx — Mobile hamburger + side drawer.
 *
 * React island (client:visible). Matches HBS mobile nav exactly:
 * - Hamburger 3-line → X animation
 * - Slide-in side menu from left
 * - Accordion sub-menus with chevron rotation
 * - Shade overlay
 * - Close on Escape / outside click
 *
 * WHY React: needs interactive state (open/close, accordion toggles).
 * WHY client:visible: only hydrates when the hamburger enters viewport,
 * which at desktop (>1150px) never happens — zero JS shipped on desktop.
 */

import { useState, useCallback, useEffect } from 'react';
import { plural } from '@core/config';
import { openLogin } from '@features/auth/store';

/* ─── Data passed from Astro parent ─── */
interface NavMobileProps {
  games: Array<{ title: string; url: string }>;
  guides: Array<{ category: string; items: Array<{ title: string; url: string }> }>;
  brands: Array<{ category: string; items: Array<{ brand: string; slug: string; url: string }> }>;
  hubs: Array<{ category: string }>;
}

export default function NavMobile({ games, guides, brands, hubs }: NavMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setOpenMenus(new Set());
  }, []);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) closeMenu();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeMenu]);

  /* Close on resize above 1150px */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 1150 && isOpen) closeMenu();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, closeMenu]);

  /* WHY: prevent background scroll while drawer is open — standard mobile nav UX */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* Toggle accordion sub-menu */
  const toggleSubmenu = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* ─── Hamburger button ─── */}
      <div
        className="mobile-hamburger-menu-icon"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        onClick={toggleMenu}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); } }}
      >
        <div className={`hamburger-menu-icon${isOpen ? ' open' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 7L4 7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 12L4 12" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 17L4 17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ─── Side menu drawer ─── */}
      <div
        className={`side-menu${isOpen ? ' active' : ''}`}
        aria-label="Mobile navigation"
      >
        <ul className="main-menu">
          <li className="menu-item1"><a href="/" onClick={closeMenu}>Home</a></li>
          <li className="menu-item1"><a href="/news" onClick={closeMenu}>News</a></li>
          <li className="menu-item1"><a href="/reviews" onClick={closeMenu}>Reviews</a></li>

          {/* Games */}
          {games.length > 0 && (
            <li className={`menu-item1${openMenus.has('games') ? ' sub-open' : ''}`}>
              <a href="#" onClick={(e) => toggleSubmenu('games', e)}>Games</a>
              <ul className={`side-sub-menu${openMenus.has('games') ? ' active' : ''}`}>
                <li className="menu-item3">
                  <a href="/games" className="explore-all-link" onClick={closeMenu}>Explore All</a>
                </li>
                {games.map((g) => (
                  <li key={g.url} className="menu-item3">
                    <a href={g.url} onClick={closeMenu}>{g.title}</a>
                  </li>
                ))}
              </ul>
            </li>
          )}

          {/* Guides */}
          {guides.length > 0 && (
            <li className={`menu-item1${openMenus.has('guides') ? ' sub-open' : ''}`}>
              <a href="#" onClick={(e) => toggleSubmenu('guides', e)}>Guides</a>
              <ul className={`side-sub-menu${openMenus.has('guides') ? ' active' : ''}`}>
                <li className="menu-item3">
                  <a href="/guides" className="explore-all-link" onClick={closeMenu}>Explore All</a>
                </li>
                {guides.map((cat) => (
                  <li key={cat.category} className={`menu-item2${openMenus.has(`guides-${cat.category}`) ? ' sub-open' : ''}`}>
                    <a href="#" onClick={(e) => toggleSubmenu(`guides-${cat.category}`, e)}>
                      <span className={`category-icon icon-${cat.category}`} />
                      {plural(cat.category)}
                    </a>
                    <ul className={`side-sub-menu${openMenus.has(`guides-${cat.category}`) ? ' active' : ''}`}>
                      <li className="menu-item3">
                        <a href={`/guides/${cat.category}`} className="explore-all-link" onClick={closeMenu}>Explore All</a>
                      </li>
                      {cat.items.map((item) => (
                        <li key={item.url} className="menu-item3">
                          <a href={item.url} onClick={closeMenu}>{item.title}</a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          )}

          {/* Brands */}
          {brands.length > 0 && (
            <li className={`menu-item1${openMenus.has('brands') ? ' sub-open' : ''}`}>
              <a href="#" onClick={(e) => toggleSubmenu('brands', e)}>Brands</a>
              <ul className={`side-sub-menu${openMenus.has('brands') ? ' active' : ''}`}>
                <li className="menu-item3">
                  <a href="/brands" className="explore-all-link" onClick={closeMenu}>Explore All</a>
                </li>
                {brands.map((cat) => (
                  <li key={cat.category} className={`menu-item2${openMenus.has(`brands-${cat.category}`) ? ' sub-open' : ''}`}>
                    <a href="#" onClick={(e) => toggleSubmenu(`brands-${cat.category}`, e)}>
                      <span className={`category-icon icon-${cat.category}`} />
                      {plural(cat.category)}
                    </a>
                    <ul className={`side-sub-menu${openMenus.has(`brands-${cat.category}`) ? ' active' : ''}`}>
                      <li className="menu-item3">
                        <a href={`/brands/${cat.category}`} className="explore-all-link" onClick={closeMenu}>Explore All</a>
                      </li>
                      {cat.items.map((item) => (
                        <li key={item.url} className="menu-item3">
                          <a href={item.url} onClick={closeMenu}>
                            <div className="brand-logo-container side-brand-logo-container">
                              <img
                                src={`/images/brands/${item.slug}/brand-logo-horizontal-mono-black_xs.png`}
                                alt={`${item.brand} logo`}
                                className="brand-logo side-brand-logo"
                                loading="lazy"
                              />
                            </div>
                            {item.brand}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          )}

          {/* Hubs */}
          {hubs.length > 0 && (
            <li className={`menu-item1 hubs-dropdown${openMenus.has('hubs') ? ' sub-open' : ''}`}>
              <a href="#" onClick={(e) => toggleSubmenu('hubs', e)}>
                Hubs <span className="navbar-new-badge" data-neutral="true">&nbsp;New!</span>
              </a>
              <ul className={`side-sub-menu${openMenus.has('hubs') ? ' active' : ''}`}>
                <li className="menu-item3">
                  <a href="/hubs" className="explore-all-link" onClick={closeMenu}>Explore All</a>
                </li>
                {hubs.map((h) => (
                  <li key={h.category} className={`menu-item2 ${h.category}-color`}>
                    <a href={`/hubs/${h.category}`} onClick={closeMenu}>
                      <span className={`category-icon icon-${h.category} ${h.category}-color`} />
                      {h.category.charAt(0).toUpperCase() + h.category.slice(1)}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          )}

          <li className="menu-item1"><a href="/about" onClick={closeMenu}>About</a></li>
        </ul>

        {/* Auth footer */}
        <div className="side-auth-footer">
          <a
            href="#"
            className="side-auth-link side-auth-logged-hide"
            onClick={(e) => {
              e.preventDefault();
              closeMenu();
              openLogin();
            }}
          >Join for free or log&nbsp;in</a>
          <a href="/account" className="side-auth-link side-auth-logged-show">
            <img src="/images/favicons/icon-32.png" alt="" className="side-auth-avatar" />
            <span>My&nbsp;Profile</span>
          </a>
        </div>
      </div>

      {/* ─── Shade overlay ─── */}
      <div
        className={`shade-overlay${isOpen ? ' active' : ''}`}
        onClick={closeMenu}
      />
    </>
  );
}

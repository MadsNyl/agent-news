"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { authClient } from "~/server/better-auth/client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Login, Logout } from "~/components/icons";

export function NavBar() {
  const { data: session, isPending } = authClient.useSession();
  const isSuperAdmin = session?.user.isSuperAdmin === true;
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  return (
    <>
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8" style={{ zIndex: 10000 }}>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-heading text-lg font-black tracking-tight text-foreground"
          >
            Agent News
          </Link>
          <Link
            href="/articles"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Articles
          </Link>
          <Link
            href="/videos"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Videos
          </Link>
          <Link
            href="/companies"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Companies
          </Link>
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Desktop auth */}
          <div className="hidden sm:flex sm:items-center sm:gap-3">
            {isPending ? (
              <div className="h-8 w-16 animate-pulse rounded bg-secondary" />
            ) : session ? (
              <>
                <Link
                  href="/submit"
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus size={16} />
                  Submit
                </Link>
                <button
                  onClick={async () => {
                    await authClient.signOut();
                    router.refresh();
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Logout size={16} />
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Login size={16} />
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={toggleMenu}
            className="relative z-50 flex h-10 w-10 items-center justify-center sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <div className="flex w-5 flex-col gap-[5px]">
              <span
                className="block h-[1.5px] w-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform: menuOpen
                    ? "translateY(3.25px) rotate(45deg)"
                    : "none",
                }}
              />
              <span
                className="block h-[1.5px] w-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform: menuOpen
                    ? "translateY(-3.25px) rotate(-45deg)"
                    : "none",
                }}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile full-screen menu — portaled to body to escape stacking context */}
      {mounted &&
        createPortal(
          <div
            className="fixed inset-0 flex flex-col transition-[transform,visibility] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:hidden"
            style={{
              zIndex: 9999,
              background: "#1a1b1e",
              transform: menuOpen ? "translateY(0)" : "translateY(100%)",
              visibility: menuOpen ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="font-heading text-lg font-black tracking-tight text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              Agent News
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center"
              aria-label="Close menu"
            >
              <div className="flex w-5 flex-col gap-[5px]">
                <span
                  className="block h-[1.5px] w-full bg-foreground"
                  style={{ transform: "translateY(3.25px) rotate(45deg)" }}
                />
                <span
                  className="block h-[1.5px] w-full bg-foreground"
                  style={{ transform: "translateY(-3.25px) rotate(-45deg)" }}
                />
              </div>
            </button>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center gap-8 px-8">
              <Link
                href="/articles"
                className="font-heading text-4xl font-black text-foreground transition-colors hover:text-muted-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Articles
              </Link>
              <Link
                href="/videos"
                className="font-heading text-4xl font-black text-foreground transition-colors hover:text-muted-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Videos
              </Link>
              <Link
                href="/companies"
                className="font-heading text-4xl font-black text-foreground transition-colors hover:text-muted-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Companies
              </Link>
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="font-heading text-4xl font-black text-foreground transition-colors hover:text-muted-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              {!isPending && session && (
                <Link
                  href="/submit"
                  className="font-heading text-4xl font-black text-foreground transition-colors hover:text-muted-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  Submit
                </Link>
              )}
              <div className="mt-4 border-t border-[oklch(1_0_0/8%)] pt-8">
                {isPending ? null : session ? (
                  <button
                    onClick={async () => {
                      await authClient.signOut();
                      router.refresh();
                      setMenuOpen(false);
                    }}
                    className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

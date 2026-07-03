"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  _count: { articles: number };
}

export function CompanyCarousel({ companies }: { companies: Company[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [, setTick] = useState(0);

  const doubled = [...companies, ...companies];

  const speed = 0.5; // px per frame

  useEffect(() => {
    let raf: number;

    const step = () => {
      const track = trackRef.current;
      if (track && !pausedRef.current) {
        offsetRef.current += speed;
        const halfWidth = track.scrollWidth / 2;
        if (offsetRef.current >= halfWidth) {
          offsetRef.current -= halfWidth;
        }
        track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return (
    <div
      className="mt-6 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
      }}
    >
      <div ref={trackRef} className="flex w-max gap-4 will-change-transform">
        {doubled.map((company, i) => (
          <Link
            key={`${company.id}-${i}`}
            href={`/companies/${company.domain}`}
            className="group flex shrink-0 items-center gap-4 rounded-xl border border-[oklch(1_0_0/6%)] px-5 py-4 transition-colors hover:border-[oklch(1_0_0/12%)]"
          >
            <Image
              src={
                company.logoUrl ??
                `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`
              }
              alt=""
              width={36}
              height={36}
              className="rounded-md"
              unoptimized
            />
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[0.9375rem] font-medium text-foreground transition-colors group-hover:text-accent-foreground">
                {company.name}
              </p>
              <p className="whitespace-nowrap text-[0.8125rem] text-muted-foreground">
                {company._count.articles}{" "}
                {company._count.articles === 1 ? "article" : "articles"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

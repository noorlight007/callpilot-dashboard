'use client'

import { useEffect } from 'react'

/**
 * Global, logic-free visual effects:
 *  - cursor-following violet glow behind the page
 *  - click ripple on buttons
 *  - 3D tilt + spotlight on `.card-lift` cards
 */
export function MotionEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement

    const onMove = (e: PointerEvent) => {
      root.style.setProperty('--mx', `${e.clientX}px`)
      root.style.setProperty('--my', `${e.clientY}px`)
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card-lift')
      if (card) {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        card.style.setProperty('--sx', `${x * 100}%`)
        card.style.setProperty('--sy', `${y * 100}%`)
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 4}deg) translateY(-4px)`
      }
    }
    const onLeave = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card-lift')
      if (card) card.style.transform = ''
    }
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('button')
      if (!btn || (btn as HTMLButtonElement).disabled) return
      const r = btn.getBoundingClientRect()
      const d = Math.max(r.width, r.height) * 2
      const s = document.createElement('span')
      s.className = 'fx-ripple'
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
      btn.style.overflow = 'hidden'
      btn.appendChild(s)
      setTimeout(() => s.remove(), 650)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeave)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onLeave)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return <div aria-hidden className="fx-cursor-glow" />
}

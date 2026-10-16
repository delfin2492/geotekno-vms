import React from "react"

export function OwnShipIcon({
  className = "h-4 w-4",
  color = "#db4040",
  strokeWidth = 2.2,
}: {
  className?: string
  color?: string
  strokeWidth?: number
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Tiang / Mast atas */}
      <line x1="12" y1="2.5" x2="12" y2="5.5" />
      {/* Bridge / Kabin anjungan */}
      <path d="M7.5 9V5.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5V9" />
      {/* Hull / Lambung kapal tampak depan */}
      <path d="M3.5 12 12 9.5l8.5 2.5c.3 3-1.2 5.5-4 6.3L12 19.5l-4.5-1.2C4.7 17.5 3.2 15 3.5 12Z" />
      {/* Garis tengah haluan */}
      <line x1="12" y1="9.5" x2="12" y2="16.5" />
      {/* Gelombang ombak bawah */}
      <path d="M2 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
    </svg>
  )
}

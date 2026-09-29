import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 22, ...rest }: P, path: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {path}
    </svg>
  )
}

export const IconWallet = (p: P) => base(p, <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1" /><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" /><path d="M20 10h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" /></>)
export const IconCalendar = (p: P) => base(p, <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>)
export const IconBell = (p: P) => base(p, <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 21h4" /></>)
export const IconSettings = (p: P) => base(p, <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>)
export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />)
export const IconChevronL = (p: P) => base(p, <path d="m14.5 6-6 6 6 6" />)
export const IconChevronR = (p: P) => base(p, <path d="m9.5 6 6 6-6 6" />)
export const IconCheck = (p: P) => base(p, <path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconX = (p: P) => base(p, <path d="M6 6l12 12M18 6 6 18" />)
export const IconTrash = (p: P) => base(p, <><path d="M4.5 7h15M10 11v6M14 11v6" /><path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /></>)
export const IconNext = (p: P) => base(p, <><path d="M5 6v5a3 3 0 0 0 3 3h11" /><path d="m15 10 4 4-4 4" /></>)
export const IconShare = (p: P) => base(p, <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M6 12H5.5A1.5 1.5 0 0 0 4 13.5v5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-5a1.5 1.5 0 0 0-1.5-1.5H18" /></>)
export const IconLink = (p: P) => base(p, <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>)
export const IconSparkle = (p: P) => base(p, <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z" />)
export const IconCloud = (p: P) => base(p, <path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5Z" />)
export const IconBank = (p: P) => base(p, <><path d="m3.5 9 8.5-5 8.5 5M5 9v8M9.5 9v8M14.5 9v8M19 9v8M3.5 20h17" /></>)
export const IconUpload = (p: P) => base(p, <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></>)
export const IconUsers = (p: P) => base(p, <><circle cx="9" cy="8" r="3.5" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3a6 6 0 0 1 3 5.2" /></>)

import { useMemo } from 'react'
import {
  Box, Compass, History, Image as ImageIcon, LayoutGrid, ListChecks, LogIn, LogOut, Monitor, Moon, PenLine, RotateCcw, Sun, User,
} from 'lucide-react'
import { STUDIO_LINKS } from '../components/results/studioLinks'

const LANDING_SECTIONS = [
  { id: 'how-it-works', label: 'How it works', icon: ListChecks },
  { id: 'styles', label: 'Design styles', icon: LayoutGrid },
  { id: 'redesign', label: 'Plan my room', icon: PenLine, keywords: 'start form upload photo redesign' },
  { id: 'image-lab', label: 'Image lab', icon: ImageIcon, keywords: 'generate ai picture' },
]

/** The actions offered by the Cmd/Ctrl+K palette, given what's on screen right now. */
export default function useAppCommands({ studio, authRoute, user, logout, openDesigner, reset, goSection, looks, onRestoreLook, setTheme }) {
  return useMemo(() => {
    const cmds = []
    if (studio && !authRoute) {
      for (const l of STUDIO_LINKS) {
        cmds.push({ id: `studio-${l.id}`, group: 'Your results', label: `Go to ${l.label}`, icon: Compass, run: () => goSection(l.id) })
      }
    }
    for (const s of LANDING_SECTIONS) {
      cmds.push({ id: `section-${s.id}`, group: 'Go to', label: s.label, icon: s.icon, keywords: s.keywords, run: () => goSection(s.id) })
    }
    cmds.push({ id: 'designer', group: 'Actions', label: 'Open the 3D room designer', icon: Box, keywords: 'three furniture layout', run: openDesigner })
    if (studio) cmds.push({ id: 'reset', group: 'Actions', label: 'Start over', icon: RotateCcw, keywords: 'reset new clear', run: reset })
    for (const look of (looks ?? []).slice(0, 5)) {
      cmds.push({ id: `look-${look.id}`, group: 'Saved looks', label: `Restore “${look.title ?? 'Saved look'}”`, icon: History, run: () => onRestoreLook(look.id) })
    }
    cmds.push(
      { id: 'theme-light', group: 'Appearance', label: 'Light theme', icon: Sun, keywords: 'mode colour', run: () => setTheme('light') },
      { id: 'theme-dark', group: 'Appearance', label: 'Dark theme', icon: Moon, keywords: 'mode night colour', run: () => setTheme('dark') },
      { id: 'theme-system', group: 'Appearance', label: 'Match system theme', icon: Monitor, keywords: 'auto mode', run: () => setTheme('system') },
    )
    if (user) {
      cmds.push(
        { id: 'account', group: 'Account', label: 'Your account', icon: User, run: () => { window.location.hash = '#/account' } },
        { id: 'logout', group: 'Account', label: 'Log out', icon: LogOut, keywords: 'sign out', run: logout },
      )
    } else {
      cmds.push(
        { id: 'login', group: 'Account', label: 'Log in', icon: LogIn, keywords: 'sign in', run: () => { window.location.hash = '#/login' } },
        { id: 'signup', group: 'Account', label: 'Create an account', icon: User, keywords: 'sign up register', run: () => { window.location.hash = '#/signup' } },
      )
    }
    return cmds
  }, [studio, authRoute, user, logout, openDesigner, reset, goSection, looks, onRestoreLook, setTheme])
}

// FILE: account-research-ui/src/layouts/AppShell.tsx
import { Link } from 'react-router-dom'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '../components/ui/navigation-menu'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-primary"> {/* Use primary color (black) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-primary h-16"> {/* Adjusted height */}
        <div className="container flex h-16 max-w-screen-2xl items-center mx-auto px-4 sm:px-6 lg:px-8"> {/* Added padding and centering */}
          <div className="mr-4 flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <img src="/supervity_logo.png" alt="Supervity Logo" className="h-8 w-auto" />
              <span className="text-lg font-bold text-lime"> {/* Lime text */}
                Account Research AI Agent
              </span>
            </Link>
          </div>
          <NavigationMenu className="flex-grow justify-end"> {/* Pushed nav to right */}
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link to="/">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-white hover:text-lime hover:bg-navy")}> {/* Style adjustment */}
                    Home
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="/generate">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-white hover:text-lime hover:bg-navy")}> {/* Style adjustment */}
                    New Report
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="/history">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-white hover:text-lime hover:bg-navy")}> {/* Style adjustment */}
                    History
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* Added padding and centering to main content */}
        {children}
      </main>
    </div>
  )
}

// Add cn utility if not already present globally
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// FILE: account-research-ui/src/layouts/AppShell.tsx
import { Link, Outlet, useLocation } from 'react-router-dom'; // Import useLocation
import { motion, AnimatePresence } from 'framer-motion'; // Import motion and AnimatePresence
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '../components/ui/navigation-menu';
import { cn } from '../lib/utils'; // Use local cn util

// Define page transition variants
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  },
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation(); // Get location for AnimatePresence key

  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Use semantic background */}
      {/* Header */}
      <motion.header
        initial={{ y: -64, opacity: 0 }} // Start off-screen and transparent
        animate={{ y: 0, opacity: 1 }}     // Animate down and fade in
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 h-16" // Add backdrop blur
      >
        <div className="container flex h-full items-center justify-between"> {/* Use container & justify-between */}

          {/* Left Side: Logo and Title */}
          <Link to="/" className="flex items-center space-x-2 mr-6">
            <motion.img
              src="/supervity_logo.png"
              alt="Supervity Logo"
              className="h-8 w-auto" // Reduced logo size slightly
              whileHover={{ scale: 1.1, rotate: -5 }} // Add subtle hover effect
            />
            <span className="hidden sm:inline-block text-lg font-semibold text-foreground whitespace-nowrap"> {/* Use foreground, hide on xs */}
              Account Research <span className="text-lime">AI Agent</span>
            </span>
          </Link>

          {/* Right Side: Navigation */}
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link to="/">
                  {/* Apply hover effects directly for simplicity here */}
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-foreground hover:text-accent hover:bg-accent/10 transition-all duration-150")}>
                    Home
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="/generate">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-foreground hover:text-accent hover:bg-accent/10 transition-all duration-150")}>
                    New Report
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="/history">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "text-foreground hover:text-accent hover:bg-accent/10 transition-all duration-150")}>
                    History
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </motion.header>

      {/* Main Content Area with Page Transitions */}
      <AnimatePresence mode="wait">
         {/* Wrap Outlet/children in a motion.div for transitions */}
         <motion.main
            key={location.pathname} // Key based on the current route
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="flex-1 container py-8" // Keep container and padding
         >
            {children} {/* Render the actual page content */}
         </motion.main>
      </AnimatePresence>

      {/* Optional Footer */}
      <footer className="py-4 border-t border-border/40 mt-auto">
          <div className="container text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Supervity. All rights reserved.
          </div>
      </footer>
    </div>
  )
}
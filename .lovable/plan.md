
# Enlarge Logo in Header

## Summary
Increase the Namsan Korea logo size in the header navigation bar that appears on the Dashboard and all other pages after login.

## Current State
The logo in the header is currently set to `h-10` (40px height) which may appear small in the navigation bar.

## Proposed Change
Enlarge the logo from `h-10` to `h-12` (48px) or `h-14` (56px) for better visibility while maintaining proper header proportions.

---

## Technical Details

**File to modify:** `src/components/Header.tsx`

**Change:** Line 48
- Current: `className="h-10 w-auto"`
- New: `className="h-12 w-auto"` (or `h-14` for even larger)

This is a single-line CSS class change that will make the logo 20-40% larger in the header while keeping it properly scaled with `w-auto`.

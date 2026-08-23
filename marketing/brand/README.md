# Raqeb brand assets

    raqeb-wordmark.svg          full RAQEB wordmark for light backgrounds (ink letters, violet Q)
    raqeb-wordmark-white.svg    full RAQEB wordmark for dark backgrounds (white letters, violet Q)
    raqeb-q-icon.svg            the signature Q on its own, the app icon
    raqeb-q-icon-white.svg      the Q for dark backgrounds
    raqeb-logo-symbols.svg.html the two SVG symbols embedded inside index.html

The Q is a circle with a short stem below the baseline. It is the signature letter
of the wordmark and stands alone as the app icon.

## The violet, still to be decided

These wordmark files keep the Q in **#5053c8**, exactly as supplied in the original
logo file. Nothing about the artwork has been altered.

The website currently renders the Q in **#6657EE**, the interface accent, because the
two violets sat 22px apart in the header and read as an inconsistency rather than a
choice. That is a one line switch in index.html (the `--qv` variable on `.wordmark`).

Once the authoritative violet is confirmed, make both agree:
- if #5053c8 wins, set `--qv:#5053c8` in index.html
- if #6657EE wins, change the two Q path fills in the wordmark files above

The q-icon files use #6657EE to match the site as it stands today.

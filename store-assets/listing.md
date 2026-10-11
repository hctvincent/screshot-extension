# Chrome Web Store listing

Paste these into the Developer Dashboard → Store listing. The name and short description come from `extension/manifest.json`.

## Name (74/75)
Screshot – Private Screenshot Tool with Blur, Annotate & Full Page Capture

## Short description (124/132)
Private screenshot tool: capture area or full page, blur & annotate on your device. Share only by end-to-end encrypted link.

## Detailed description

Plain text only: the Chrome Web Store does not render Markdown, so no ** or # in this field.

```
Screshot – the private screenshot tool for Chrome

Your screenshots stay yours. Capture the visible part of a page or the entire page, blur anything sensitive and mark it up, all inside your browser: no account, no upload, no tracking. When you do want a link, the screenshot is end-to-end encrypted on your computer before it leaves, so only the people you choose can open it. Not even Screshot can see it.

NEW IN THIS VERSION
• Share by link, end-to-end encrypted: click Share in the editor and Screshot encrypts the screenshot on your computer, uploads only the encrypted file and copies the link. Our servers never have the key.
• You choose who can view: Only me (the default for every new link), Invited people (by email) or Anyone with the link. Change it at any time without uploading again. Remove someone and the link stops working for them.
• Sign in with Google, once. Signing in on the extension or on screshot.com signs you in on both, and signing out of either signs out of both.
• Unlock with a passkey (fingerprint, face or device PIN) or your personal recovery code. No passwords.
• Your dashboard on screshot.com: see every screenshot you've shared, rename, change who can view, restore from the trash or delete forever.
• Redesigned interface in a clean Fluent style: a compact toolbar, a Share panel that opens right under the Share button, clear progress while encrypting and uploading, and one place for notifications.
• Full-page captures can be shared too, straight from the full-page viewer.

HOW IT WORKS
1. Click the Screshot icon or press Ctrl+Shift+S.
2. Drag to keep only the area you need, or double-click to keep the whole capture.
3. Annotate and blur.
4. Copy to the clipboard, download a PNG, or click Share for an encrypted link.

FEATURES
• Capture the visible area in one click, or a full scrolling page
• Crop to exactly the region you need
• Arrows, lines, rectangles, ellipses, pencil, highlighter and text, in any color
• Blur to hide emails, names, API keys or card numbers. Blurred areas cannot be recovered.
• Unlimited undo and redo
• Copy to the clipboard and paste into Slack, Teams, Jira, GitHub, Gmail or Google Docs
• Download as PNG
• Share by end-to-end encrypted link, with 1 GB of encrypted storage free per account
• Sharp at full resolution on any display and zoom level

KEYBOARD SHORTCUTS
Capture
• Visible area: Ctrl+Shift+S (Mac: Cmd+Shift+S)
• Full page: Alt+Shift+S (Mac: Option+Shift+S)
• Cancel a full-page capture: Esc
Change these anytime at chrome://extensions/shortcuts

Editor (Mac: Control+Option instead of Ctrl+Alt)
• Ctrl+Alt+B blur · Ctrl+Alt+A arrow · Ctrl+Alt+R rectangle · Ctrl+Alt+E ellipse
• Ctrl+Alt+L line · Ctrl+Alt+P pencil · Ctrl+Alt+H highlighter · Ctrl+Alt+T text · Ctrl+Alt+K color
• Ctrl+Z / Ctrl+Y undo and redo · Ctrl+C copy · Ctrl+S download · Esc close

PRIVATE BY DESIGN
• No account needed to capture, blur, copy or download. Sign in only if you want to share.
• Nothing leaves your computer unless you click Share, and then only that one screenshot, encrypted.
• Each shared screenshot gets its own AES-256 key. The key goes only to you, the people you invite, or inside the link itself (after the #, a part browsers never send to a server).
• No tracking or analytics inside the extension. No selling data, no ads, no training AI on your screenshots.
• Five permissions, none with an install warning:
  – activeTab: captures only the tab you choose, when you ask
  – scripting: scrolls that tab during a full-page capture, then restores it
  – contextMenus: adds the capture options to the icon's right-click menu
  – storage: keeps your Screshot sign-in on this device
  – identity: opens Google sign-in when you choose to share
How the encryption works: https://www.screshot.com/security#encryption

FOR TEAMS AND IT
Deploy Screshot to every Chrome browser in your organization with the Google Admin console, Microsoft Intune or Group Policy. Capture and blur need no accounts or licenses, and sharing is opt-in for each person.
Deployment guide and security review pack: https://www.screshot.com/enterprise

BUILT FOR
Developers filing bug reports, QA engineers, designers giving feedback, support teams explaining steps, and anyone who needs to show, not tell.

Questions or ideas: https://www.screshot.com/contact
```

## Privacy practices tab

Single purpose:
```
Capture, annotate and blur screenshots of web pages, and optionally share them by end-to-end encrypted link.
```

Permission justifications:
- activeTab: `Captures the tab the user chooses, only when they click the icon, use the shortcut or the context menu.`
- scripting: `During a full-page capture, scrolls the active tab to capture each part, then restores the original scroll position.`
- contextMenus: `Adds "Capture visible area" and "Capture full page" to the toolbar icon's right-click menu.`
- storage: `Stores the user's Screshot sign-in token on the device so they stay signed in for sharing.`
- identity: `Opens Google sign-in (chrome.identity.launchWebAuthFlow) when the user chooses to share a screenshot.`
- Remote code: `No, I am not using remote code.`

Data usage (tick what applies, because sharing is now live):
- Personally identifiable information: yes (email address and name from Google sign-in, invited email addresses)
- Authentication information: yes (sign-in token)
- Website content: yes (screenshots the user chooses to share, uploaded end-to-end encrypted)
- Everything else (health, financial, location, web history, user activity, personal communications): no
- Certify all three: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

Privacy policy URL: https://www.screshot.com/privacy

## Screenshots (1280×800 JPEG, max 5, upload in this order)
Files in `store-assets/screenshots/`, generated from real captures of the current build:
1. `01-share-encrypted.jpg`: "Share a link nobody else can read" (the Share panel: Only me / Invited people / Anyone with the link)
2. `02-full-page.jpg`: "Full page screenshot in one shortcut" (capture in progress + the stitched result)
3. `03-blur.jpg`: "Blur private info before you share" (email and card blurred)
4. `04-annotate-paste.jpg`: "Point at the problem, paste it anywhere" (annotated ticket pasted into a chat)
5. `05-private.jpg`: "Not even we can see your shared screenshots" (encryption flow + the 5 permissions)

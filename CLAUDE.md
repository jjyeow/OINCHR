@AGENTS.md

# OINCHR

Leave and claims for OINC staff. One of three OINC mobile apps against one Django
server (`OINCServer`), alongside OINCOps (farm operations, currently named OINCRN)
and OINCLab (lab technicians, not built yet).

## Requires Node 20+

The machine's default `node` is v16, which cannot run Expo SDK 57. Use nvm's Node 22:

    export PATH="$HOME/.nvm/versions/node/v22.3.0/bin:$PATH"

## Commands

- `npx expo start --dev-client` - run against a dev build
- `npx expo export --platform ios` - bundle without a device; catches import and syntax errors
- `npx expo-doctor` - check dependency versions against the SDK

## Server contract

The Django views read `request.POST`, so **every request is form-encoded**, not JSON.
`src/api/client.js` handles that centrally - screens never build a body themselves.

Two status codes carry meaning beyond the usual:

- **460** - the token was invalidated by a newer login elsewhere. `client.js` clears
  the session and drops the user back to login.
- **409** - `PermissionMiddleware` rejected the endpoint because the caller's
  `SystemRole` does not hold it. Not a bug; it is the permission system working.

### Permissions

`membership/getsystempermission` returns `[{ id, title }]` - **titles only, no urls**.
So `src/permissions.js` matches on title strings, and those strings must stay in sync
with `hr/permissions.py` on the server. Change one, change the other.

Roles are one layer: a user holds exactly one `SystemRole` (`User.systemRole` is a
single FK). "HR" is a peer role alongside Director and Lab Technician, not a second
dimension. Department lives on `EmployeeProfile`, not in the role.

Permission checks in this app only decide what to *render*. The server checks again
on every request, so a hidden button is a convenience, never a security boundary.

## Dates

The server takes and returns `YYYY-MM-DD`. Use `toServerDate()` from `src/lib/dates.js`,
never `toISOString().slice(0, 10)` - that converts to UTC first, which in Malaysia
(UTC+8) yields the *previous* day before 8am.

Day counts come from the server (`hr/calculateleavedays`), not from the app. The
server is the side that knows the public holidays and which weekdays the farm works.

## Attachments

MC certificates are confidential and live in a private S3 bucket. There is no
permanent URL - call `hr/getleaveattachmenturl` for a signed link that expires in
five minutes. Do not cache it.

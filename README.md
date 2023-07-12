# multi-tab-auto-logout-sync

## Requirements
- User will be logged out after a period of inactivity
- User should see a pop up with a count down after x period from when the logout should happen
- Inactivity should also consider all tabs of the app
- Pop up should show up in all tabs and count down should be in sync
- Pop up should have an option to continue session
- An explicit logout action in one app should logout all tabs to the login screen without any feedback message
- An auto logout should logout all tabs to the login screen with a message.
- Auto logout should save redirect url so that when user logs in he is brought back to where he was

## Running the POC
```
npm i
npm run dev
```
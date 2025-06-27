# Powens Integration Fix

## Summary of Changes

Fixed the 403 error when clicking "launch powens connector" by implementing the correct Powens authentication flow based on your working `powens-banking-dashboard` project.

## Key Issues Fixed

1. **Wrong API URL format**: Changed from `https://api.powens.com` to `https://luxsy-sandbox.biapi.pro/2.0`
2. **Wrong webview URL**: Updated to use `https://webview.powens.com/2.0/auth/init`
3. **Missing domain parameter**: Added proper `domain` parameter in authorization URL
4. **Missing initialization step**: Added proper `/auth/init` API call before generating auth URL
5. **Incorrect redirect URI**: Updated to use your production URL

## Required Environment Variables

Make sure your `.env` file contains:

```bash
# Powens API Credentials
POWENS_CLIENT_ID=your_client_id_here
POWENS_CLIENT_SECRET=your_client_secret_here
POWENS_REDIRECT_URI=https://finance.dr-bosic.com
POWENS_DOMAIN=luxsy-sandbox

# Optional: Permanent access token fallback
PERMANENT_ACCESS_TOKEN=your_permanent_token_if_available
```

## Files Modified

1. **`src/services/powens/constants.js`**:
   - Updated to use `luxsy-sandbox.biapi.pro/2.0` API format
   - Changed webview URL to `/2.0/auth/init` endpoint

2. **`src/services/powens/powensService.js`**:
   - Added `initializeUser()` method for proper authentication initialization
   - Updated `generateAuthUrl()` to use correct domain-based parameters
   - Implemented multiple fallback methods for token exchange
   - Added proper error handling and logging

3. **`src/routes/auth.js`**:
   - Modified `/powens/init` endpoint to call `initializeUser()` first
   - Added fallback logic for failed initialization
   - Updated callback handling to support both `code` and `connection_id`
   - Fixed redirect URLs to use production domain

## How the New Authentication Flow Works

1. **POST `/api/auth/powens/init`**:
   - Calls Powens `/auth/init` API to initialize user
   - Generates authorization URL with proper domain parameters
   - Returns URL for user redirection

2. **User Authentication**:
   - User gets redirected to Powens webview
   - Completes bank authentication
   - Gets redirected back to your callback URL

3. **Callback Processing**:
   - Exchanges code/connection_id for access tokens
   - Tries multiple token exchange methods as fallbacks
   - Stores connection data in your database

## Testing

1. **Restart your server** to load the new configuration
2. **Click "launch powens connector"** - should now work without 403 error
3. **Monitor logs** for any authentication issues

## Authentication Flow Comparison

### Before (Broken):
```
Client -> /powens/init -> generateAuthUrl() -> Powens webview (403 error)
```

### After (Fixed):
```
Client -> /powens/init -> initializeUser() -> generateAuthUrl() -> Powens webview (success)
```

## Troubleshooting

If you still encounter issues:

1. **Check environment variables** are properly set
2. **Verify Powens dashboard configuration** matches redirect URI
3. **Check server logs** for specific error messages
4. **Ensure HTTPS** is used for production callbacks

## Additional Notes

- The code includes multiple fallback methods for token exchange
- Error handling has been improved with detailed logging
- The implementation matches your working `powens-banking-dashboard` project
- Redirect URLs have been updated to use your production domain

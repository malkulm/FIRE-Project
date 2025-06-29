// FIRE Planning Dashboard JavaScript
// CSP-compliant external JavaScript file

console.log('🔥 FIRE Planning Dashboard - JavaScript loaded');

// Show notification function
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // Auto-hide after 5 seconds for success/info
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
}

// Listen for messages from Powens popup window
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'POWENS_CONNECTION_SUCCESS') {
        showNotification(
            `🎉 Bank connection successful! Connected to ${event.data.bankName}. Now run "Full Sync" to import your data.`, 
            'success'
        );
        
        // Update connection status
        const status = document.getElementById('connectionStatus');
        status.textContent = `✅ Connected to ${event.data.bankName}`;
        status.style.color = '#27ae60';
        
        // Refresh connections display after a moment
        setTimeout(() => {
            checkConnectionStatus();
        }, 2000);
    }
});

// Launch Powens Connector function
async function launchPowensConnector() {
    const button = document.getElementById('connectBankBtn');
    const status = document.getElementById('connectionStatus');
    
    try {
        // Update UI
        button.textContent = '⏳ Getting authorization URL...';
        button.disabled = true;
        status.textContent = 'Preparing Powens connection...';
        status.style.color = '#f39c12';
        
        // Get authorization URL (using correct route path)
        const response = await fetch('/api/auth/powens/url');
        const data = await response.json();
        
        // DEBUG: Log the actual response to see what we're getting
        console.log('🔍 DEBUG: API Response:', JSON.stringify(data, null, 2));
        console.log('🔍 DEBUG: data.success:', data.success);
        console.log('🔍 DEBUG: data.data:', data.data);
        console.log('🔍 DEBUG: data.data.authUrl:', data.data ? data.data.authUrl : 'data.data is undefined');
        console.log('🔍 DEBUG: data.data.webauth_url:', data.data ? data.data.webauth_url : 'data.data is undefined');
        
        // Check for multiple possible field names
        let authUrl = null;
        if (data.success && data.data) {
            authUrl = data.data.authUrl || data.data.webauth_url || data.data.auth_url;
        }
        
        console.log('🔍 DEBUG: Final authUrl:', authUrl);
        
        if (data.success && authUrl) {
            // Update UI
            button.textContent = '🏦 Opening Powens Interface...';
            status.textContent = 'Redirecting to Powens secure interface...';
            status.style.color = '#3498db';
            
            showNotification('Opening Powens interface... Complete the bank connection in the popup window.', 'info');
            
            // Open Powens interface in new window
            const powensWindow = window.open(
                authUrl, 
                'powens-auth',
                'width=800,height=600,scrollbars=yes,resizable=yes'
            );
            
            // Check if window was blocked
            if (!powensWindow) {
                throw new Error('Pop-up blocked. Please allow pop-ups for this site and try again.');
            }
            
            // Reset button after a delay
            setTimeout(() => {
                button.textContent = '🚀 Launch Powens Connector';
                button.disabled = false;
                status.textContent = '✅ Powens interface opened! Complete the connection in the new window, then run "Full Sync" below.';
                status.style.color = '#27ae60';
            }, 3000);
            
        } else {
            // Enhanced error message with actual response data
            const errorMsg = data.error?.message || data.message || 'Failed to get authorization URL';
            throw new Error(`${errorMsg} (Response: ${JSON.stringify(data)})`);
        }
        
    } catch (error) {
        console.error('Powens connector launch failed:', error);
        
        // Update UI with error
        button.textContent = '❌ Connection Failed';
        status.textContent = `Error: ${error.message}`;
        status.style.color = '#e74c3c';
        
        showNotification(`Connection failed: ${error.message}`, 'error');
        
        // Reset button after delay
        setTimeout(() => {
            button.textContent = '🚀 Launch Powens Connector';
            button.disabled = false;
            status.textContent = '';
        }, 3000);
    }
}

// Check connection status
async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/auth/powens/connections');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            const status = document.getElementById('connectionStatus');
            const connectionCount = data.data.length;
            const bankNames = data.data.map(conn => conn.bank_name).join(', ');
            
            status.textContent = `✅ Connected: ${connectionCount} bank connection(s) - ${bankNames}`;
            status.style.color = '#27ae60';
        }
    } catch (error) {
        // Silently ignore status check errors
        console.debug('Status check failed:', error.message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥 Dashboard initializing...');
    
    // Bind click event to the Powens connector button
    const connectButton = document.getElementById('connectBankBtn');
    if (connectButton) {
        connectButton.addEventListener('click', launchPowensConnector);
        console.log('🔥 Powens connector button event listener attached');
    } else {
        console.error('❌ Powens connector button not found');
    }
    
    // Check initial connection status
    checkConnectionStatus();
    
    // Auto-refresh status every 30 seconds
    setInterval(checkConnectionStatus, 30000);
    
    console.log('🔥 Dashboard initialization complete');
});

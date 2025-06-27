-- FIRE Planning Database Schema
-- PostgreSQL migration for comprehensive banking data structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Core user information
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Optional for OAuth-only users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    phone VARCHAR(20),
    locale VARCHAR(10) DEFAULT 'en-US',
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) DEFAULT 'EUR',
    language VARCHAR(5) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    weekly_summary BOOLEAN DEFAULT true,
    monthly_reports BOOLEAN DEFAULT true,
    budget_alerts BOOLEAN DEFAULT true,
    transaction_categories JSONB DEFAULT '[]',
    dashboard_widgets JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank connections table - Powens/banking connections
CREATE TABLE IF NOT EXISTS bank_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    powens_user_id VARCHAR(255), -- Powens internal user ID
    powens_connection_id VARCHAR(255), -- Powens connection ID
    bank_name VARCHAR(255) NOT NULL,
    bank_logo_url VARCHAR(500),
    connection_type VARCHAR(50) DEFAULT 'powens', -- powens, manual, etc.
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, expired, error
    access_token_encrypted TEXT, -- Encrypted access token
    refresh_token_encrypted TEXT, -- Encrypted refresh token
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50), -- success, failed, partial
    last_error_message TEXT,
    sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, powens_connection_id)
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    powens_account_id VARCHAR(255), -- Powens internal account ID
    account_number VARCHAR(100),
    iban VARCHAR(50),
    bic VARCHAR(20),
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- checking, savings, investment, credit, loan
    currency VARCHAR(3) DEFAULT 'EUR',
    balance DECIMAL(15,2) DEFAULT 0.00,
    available_balance DECIMAL(15,2),
    credit_limit DECIMAL(15,2),
    interest_rate DECIMAL(5,4),
    bank_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    last_balance_update TIMESTAMP WITH TIME ZONE,
    account_metadata JSONB DEFAULT '{}', -- Additional Powens metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, powens_account_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    powens_transaction_id VARCHAR(255), -- Powens internal transaction ID
    transaction_date DATE NOT NULL,
    processed_date DATE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    description TEXT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- debit, credit, transfer, fee, interest
    category VARCHAR(100), -- User-defined or auto-categorized
    subcategory VARCHAR(100),
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(100),
    reference_number VARCHAR(255),
    balance_after DECIMAL(15,2),
    is_pending BOOLEAN DEFAULT false,
    is_duplicate BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]',
    notes TEXT,
    powens_metadata JSONB DEFAULT '{}', -- Raw Powens transaction data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, powens_transaction_id)
);

-- User sessions table for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync logs table for tracking data synchronization
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- full, accounts, transactions, incremental
    status VARCHAR(50) NOT NULL, -- started, completed, failed, partial
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table for transaction categorization
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for system categories
    parent_id UUID REFERENCES transaction_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget categories and limits
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES transaction_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    period VARCHAR(20) NOT NULL, -- monthly, yearly, weekly
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    alert_threshold DECIMAL(5,2) DEFAULT 0.80, -- Alert at 80% of budget
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status);
CREATE INDEX IF NOT EXISTS idx_bank_connections_last_sync ON bank_connections(last_sync_at);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_connection_id ON bank_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(is_pending);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_connection_id ON sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_transaction_categories_user_id ON transaction_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_parent ON transaction_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_system ON transaction_categories(is_system);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active);

-- Create trigger for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_connections_updated_at BEFORE UPDATE ON bank_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaction_categories_updated_at BEFORE UPDATE ON transaction_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system transaction categories
INSERT INTO transaction_categories (name, description, color, icon, is_system, sort_order) VALUES
('Income', 'All income sources', '#27ae60', 'money-bill-wave', true, 1),
('Food & Dining', 'Restaurants, groceries, food delivery', '#e74c3c', 'utensils', true, 2),
('Transportation', 'Gas, public transport, parking, car maintenance', '#3498db', 'car', true, 3),
('Shopping', 'Clothing, electronics, general shopping', '#9b59b6', 'shopping-bag', true, 4),
('Entertainment', 'Movies, games, hobbies, subscriptions', '#f39c12', 'gamepad', true, 5),
('Bills & Utilities', 'Electricity, water, internet, phone', '#34495e', 'file-invoice', true, 6),
('Healthcare', 'Medical expenses, pharmacy, insurance', '#e67e22', 'heart', true, 7),
('Education', 'Tuition, books, courses, training', '#16a085', 'graduation-cap', true, 8),
('Travel', 'Flights, hotels, vacation expenses', '#8e44ad', 'plane', true, 9),
('Investment', 'Stocks, bonds, crypto, savings', '#2ecc71', 'chart-line', true, 10),
('Transfer', 'Money transfers between accounts', '#95a5a6', 'exchange-alt', true, 11),
('Fees', 'Bank fees, service charges', '#c0392b', 'credit-card', true, 12),
('Other', 'Uncategorized transactions', '#7f8c8d', 'question', true, 13)
ON CONFLICT DO NOTHING;

-- Create a default admin user (for development/testing)
-- Note: In production, this should be created through proper registration
INSERT INTO users (id, email, first_name, last_name, is_active, email_verified) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@fire-planning.local', 'Admin', 'User', true, true)
ON CONFLICT (email) DO NOTHING;

-- Create default preferences for admin user
INSERT INTO user_preferences (user_id) VALUES
('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

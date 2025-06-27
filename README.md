# FIRE Planning - Banking Data Collection Service

A minimalist banking data collection service via Powens API, designed for FIRE (Financial Independence, Retire Early) planning and optimized for agentic AI development.

## 🎯 Project Goals

- **Data Collection**: Securely collect banking data via Powens API
- **Storage**: Persist data in PostgreSQL with comprehensive schema
- **API Access**: Provide REST API for data consumption by other services
- **Modularity**: Enable development of specialized child repositories
- **AI-Friendly**: Optimized for development by AI agents with comprehensive documentation

## 🏗️ Architecture

```
FIRE-Planning/
├── docs/                    # Comprehensive documentation
├── src/
│   ├── config/             # Configuration management
│   ├── models/             # Database models
│   ├── services/           # Business logic
│   │   ├── powens/        # Powens API integration
│   │   └── database/      # Database operations
│   ├── routes/            # REST API endpoints
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   ├── migrations/        # Database migrations
│   └── public/            # Minimal frontend for testing
├── tests/                 # Test suites
└── scripts/               # Automation scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- PostgreSQL >= 12
- Powens API credentials (optional for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/malkulm/FIRE-Planning.git
   cd FIRE-Planning
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup database**
   ```bash
   # Create database
   createdb fire_planning
   
   # Run migrations
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - API: http://localhost:3000/api
   - Testing Dashboard: http://localhost:3000
   - API Documentation: http://localhost:3000/api/docs

## 📖 Documentation

- [API Reference](docs/API_REFERENCE.md) - Complete API documentation
- [Agentic Development Guide](docs/AGENTIC_DEVELOPMENT.md) - Guidelines for AI agents
- [Database Schema](docs/DATABASE_SCHEMA.md) - Database structure and relationships
- [Powens Integration](docs/POWENS_INTEGRATION.md) - Powens API integration details
- [Change Log](docs/CHANGE_LOG.md) - Track all modifications

## 🔧 Development

### For AI Agents

This repository is optimized for development by AI agents. Before making any changes:

1. **Read the documentation** in `/docs/` directory
2. **Check dependencies** and relationships
3. **Follow the guidelines** in `docs/AGENTIC_DEVELOPMENT.md`
4. **Update documentation** for any changes
5. **Log changes** in `docs/CHANGE_LOG.md`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with test data

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/powens/init` - Initialize Powens connection
- `GET /api/auth/powens/url` - Get authorization URL
- `POST /api/auth/powens/callback` - Handle callback

### Accounts
- `GET /api/accounts` - List all accounts
- `POST /api/accounts/sync` - Sync account data

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions/sync` - Sync transaction data

### Synchronization
- `POST /api/sync/full` - Full data synchronization
- `GET /api/sync/status` - Get sync status

## 🧪 Testing

The application includes a minimal web interface for testing functionality:

- **Dashboard**: View accounts and transactions
- **Sync Controls**: Trigger data synchronization
- **API Testing**: Test individual endpoints
- **Logs Viewer**: Monitor application logs

## 📊 Database

The application uses PostgreSQL with a comprehensive schema designed for:
- Multiple bank connections per user
- Detailed transaction tracking
- Sync status monitoring
- Category management
- Data integrity and relationships

## 🔒 Security

- Encrypted token storage
- Input validation on all endpoints
- Rate limiting
- CORS protection
- Helmet security headers

## 🤝 Contributing

This project is designed for modular development. Each feature should:
- Follow the documented patterns
- Update relevant documentation
- Include comprehensive tests
- Log changes appropriately

## 📝 License

MIT License - see LICENSE file for details

---

**Note**: This is a data collection service. Frontend applications should be developed as separate repositories that consume this API.
